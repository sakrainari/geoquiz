/**
 * 藤沢市の町字クイズデータを e-Stat 国勢調査2020 小地域境界データから生成する。
 *
 * 前提：
 *   e-Stat > 統計地理情報システム > 境界データダウンロード
 *   https://www.e-stat.go.jp/gis/statmap-search?type=2
 *   から「令和2年（2020） > 小地域（町丁・字等別） > 神奈川県」の
 *   Shapefile をダウンロードして展開しておく。
 *   ファイル名は通常 r2ka14.shp（神奈川県）。
 *
 * 使い方:
 *   node tools/build-fujisawa-data.mjs --shp=path/to/r2ka14.shp
 *
 * 出力:
 *   data/prefectures/fujisawa.js  (window.FUJISAWA_MUNICIPALITIES = ...)
 */

import { execFile as execFileCallback } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper,
} from "./lib/simplify-with-mapshaper.mjs";

const execFile = promisify(execFileCallback);
const mapshaperBin = path.resolve("node_modules", "mapshaper", "bin", "mapshaper");

// ── CLI 引数 ──────────────────────────���───────────────────
const args = process.argv.slice(2);
const shpArg = args.find((a) => a.startsWith("--shp="));
if (!shpArg) {
  console.error("Usage: node tools/build-fujisawa-data.mjs --shp=path/to/r2ka14.shp");
  process.exit(1);
}
const shpPath = path.resolve(shpArg.replace("--shp=", ""));

const OUTPUT      = "data/prefectures/fujisawa.js";
const GLOBAL_NAME = "FUJISAWA_MUNICIPALITIES";
const CITY_CODE   = "14205"; // 藤沢市の全国市区町村コード
const AREA_CODE   = "0466";
const MA_NAME     = "藤沢MA";

// ── ヘルパー ──────────────────────────────────────────────

/**
 * e-Stat 小地域の S_NAME から丁目番号を除去して基本町名を返す。
 *   "本町一丁目"    → "本町"
 *   "辻堂駅南口二丁目" → "辻堂駅南口"
 *   "鵠沼橘1丁目"   → "鵠沼橘"
 *   "大字村岡"      → "村岡"
 *   "天神町"        → "天神町"（変化なし）
 */
function baseChomeName(name) {
  if (!name) return "";
  return name
    .replace(/^大字/, "")                              // 大字プレフィックスを除去
    .replace(/[〇一二三四五六七八九十百千\d]+丁目$/, "") // 丁目番号を除去
    .trim();
}

/** geometry の重心（平均座標）を [lat, lng] で返す */
function labelPoint(geometry) {
  const pts = [];
  function collectRing(ring) {
    ring.forEach(([lng, lat]) => pts.push([lng, lat]));
  }
  if (geometry.type === "Polygon") geometry.coordinates.forEach(collectRing);
  if (geometry.type === "MultiPolygon") geometry.coordinates.flat().forEach(collectRing);
  if (!pts.length) return [0, 0];
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  return [+lat.toFixed(6), +lng.toFixed(6)];
}

/** 町名の文字数に応じたデフォルトラベルサイズ */
function labelSize(name) {
  if (name.length >= 7) return 7.2;
  if (name.length >= 6) return 7.6;
  if (name.length >= 5) return 8.0;
  if (name.length >= 4) return 8.5;
  return 9.0;
}

/**
 * e-Stat Shapefile で使われる代表的なフィールド名を自動検出する。
 * 2020年(令和2年)データは KEY_CODE, PREF, CITY, S_NAME が標準。
 * 2015年(平成27年)データも同じフィールド名だが念のため検出する。
 */
function detectFields(sample) {
  const p = sample.properties;
  return {
    keyCode : Object.keys(p).find((k) => /KEY_?CODE/i.test(k)),
    pref    : Object.keys(p).find((k) => /^PREF$/i.test(k)),
    city    : Object.keys(p).find((k) => /^CITY$/i.test(k)),
    sName   : Object.keys(p).find((k) => /^S_?NAME$/i.test(k) || /^MOJI$/i.test(k)),
  };
}

/**
 * Feature が藤沢市かどうかを判定する。
 * KEY_CODE の先頭5文字 = "14205" を優先し、
 * KEY_CODE がなければ PREF=="14" && CITY=="205" で判定。
 */
function isFujisawa(feature, fields) {
  const p = feature.properties;
  if (fields.keyCode) {
    return String(p[fields.keyCode]).slice(0, 5) === CITY_CODE;
  }
  if (fields.pref && fields.city) {
    return String(p[fields.pref]) === "14" && String(p[fields.city]) === "205";
  }
  return false;
}

// ── メイン処理 ────────────────────────────────────────────
const tempDir = await mkdtemp(path.join(tmpdir(), "geoquiz-fujisawa-"));

try {
  // ===== Step 1: SHP → GeoJSON（神奈川県全体） =====
  console.log("Step 1: SHP → GeoJSON...");
  const rawPath = path.join(tempDir, "raw.geojson");
  await execFile(
    process.execPath,
    [mapshaperBin, shpPath, "-o", "format=geojson", rawPath],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 200 },
  );
  const rawGeoJson = JSON.parse(await readFile(rawPath, "utf8"));
  console.log(`  全 feature 数: ${rawGeoJson.features.length}`);

  // ===== Step 2: 藤沢市（14205）でフィルタ =====
  console.log("Step 2: 藤沢市フィルタ...");
  if (!rawGeoJson.features.length) throw new Error("Shapefile に feature がありません");

  const fields = detectFields(rawGeoJson.features[0]);
  console.log(`  検出フィールド: ${JSON.stringify(fields)}`);
  if (!fields.sName) throw new Error("町名フィールド（S_NAME/MOJI）が見つかりません");

  const fujisawaFeatures = rawGeoJson.features.filter((f) => isFujisawa(f, fields));
  console.log(`  藤沢市 feature 数: ${fujisawaFeatures.length}`);
  if (!fujisawaFeatures.length) throw new Error("藤沢市の feature が0件です。CITY_CODE または SHP のパスを確認してください。");

  // ===== Step 3: 丁目番号を除去して _chome プロパティを付加 =====
  console.log("Step 3: 町名から丁目番号を除去...");
  for (const f of fujisawaFeatures) {
    const rawName = f.properties[fields.sName] || "";
    f.properties._chome = baseChomeName(rawName);
  }

  // _chome ごとの元 S_NAME を確認表示
  const chomeMap = new Map();
  for (const f of fujisawaFeatures) {
    const chome = f.properties._chome;
    if (!chomeMap.has(chome)) chomeMap.set(chome, new Set());
    chomeMap.get(chome).add(f.properties[fields.sName]);
  }
  const mergedCount = [...chomeMap.values()].filter((s) => s.size > 1).length;
  console.log(`  ${fujisawaFeatures.length} 小地域 → ${chomeMap.size} 町字（うち ${mergedCount} 町が丁目合体対象）`);

  // ===== Step 4: mapshaper dissolve で同名丁目を合体 =====
  console.log("Step 4: 丁目合体（dissolve）...");
  const preDissolvePath = path.join(tempDir, "pre_dissolve.geojson");
  const dissolvedPath   = path.join(tempDir, "dissolved.geojson");

  await writeFile(preDissolvePath, JSON.stringify({
    type: "FeatureCollection",
    features: fujisawaFeatures,
  }));

  await execFile(
    process.execPath,
    [
      mapshaperBin,
      preDissolvePath,
      "-dissolve", "_chome",
      "-filter-islands", "min-area=500m2", "remove-empty",
      "-o", "format=geojson", dissolvedPath,
    ],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 50 },
  );
  const dissolved = JSON.parse(await readFile(dissolvedPath, "utf8"));
  console.log(`  dissolve 後: ${dissolved.features.length} 町字`);

  // ===== Step 5: GeoQuiz 用プロパティを付加 =====
  console.log("Step 5: GeoQuiz プロパティ付加...");
  const withProps = {
    type: "FeatureCollection",
    features: dissolved.features.map((f) => {
      const chome = f.properties._chome || "（不明）";
      return {
        type: "Feature",
        properties: {
          id        : `fujisawa_${chome}`,
          name      : chome,
          area_code : AREA_CODE,
          ma_name   : MA_NAME,
          region    : "藤沢市",
          labelPoint: labelPoint(f.geometry),
          labelSize : labelSize(chome),
        },
        geometry: f.geometry,
      };
    }),
  };

  // 町字一覧を表示
  const names = withProps.features.map((f) => f.properties.name).sort();
  console.log("  町字一覧（五十音順）:");
  for (let i = 0; i < names.length; i += 8) {
    console.log("    " + names.slice(i, i + 8).join("  "));
  }

  // ===== Step 6: Simplify =====
  console.log("Step 6: Simplify（interval=40m）...");
  const rawVertexCount = countFeatureVertices(withProps);
  const simplified = await simplifyFeatureCollectionWithMapshaper(withProps, {
    interval    : "40m",
    weighting   : 0.75,
    minIslandArea: "500m2",
    minSliverArea: "500m2",
    sliverControl: 0.85,
  });
  const simplifiedVertexCount = countFeatureVertices(simplified);

  // simplify 後に labelPoint を再計算
  for (const f of simplified.features) {
    f.properties.labelPoint = labelPoint(f.geometry);
  }

  // ===== Step 7: 出力 =====
  console.log("Step 7: ファイル出力...");
  const municipalities = simplified.features.map(({ properties: { labelPoint: _lp, labelSize: _ls, ...rest } }) => rest);

  const payload = {
    type        : "FeatureCollection",
    source      : "e-Stat 国勢調査2020 小地域（町丁・字等別）境界データ, CC BY 4.0 総務省統計局",
    city        : { id: "fujisawa", name: "藤沢市", code: "14205", prefecture: "神奈川県" },
    generatedAt : new Date().toISOString(),
    municipalities,
    features    : simplified.features,
  };

  await mkdir("data/prefectures", { recursive: true });
  await writeFile(OUTPUT, `window.${GLOBAL_NAME} = ${JSON.stringify(payload)};\n`, "utf8");

  console.log(`\n✅ 完了: ${OUTPUT}`);
  console.log(`   ${simplified.features.length} 町字, 頂点数 ${rawVertexCount} → ${simplifiedVertexCount}`);
  console.log("\n次のステップ:");
  console.log("  1. node tools/precompute-ma-features.mjs --only=fujisawa");
  console.log("  2. node tools/validate-data.mjs --file=data/prefectures/fujisawa.js");
  console.log("  3. catalog.js に fujisawa エントリを追加");

} finally {
  await rm(tempDir, { recursive: true, force: true });
}
