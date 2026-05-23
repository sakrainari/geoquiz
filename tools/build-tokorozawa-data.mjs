/**
 * 所沢市の町字クイズデータを e-Stat 国勢調査2020 小地域境界データから生成する。
 *
 * 前提：
 *   e-Stat > 統計地理情報システム > 境界データダウンロード
 *   https://www.e-stat.go.jp/gis/statmap-search?type=2
 *   から「令和2年（2020） > 小地域（町丁・字等別） > 埼玉県 > 所沢市」の
 *   Shapefile をダウンロードして展開しておく。
 *   ファイル名は通常 r2ka11208.shp（所沢市）。
 *
 * 使い方:
 *   node tools/build-tokorozawa-data.mjs --shp=path/to/r2ka11208.shp
 *
 * 出力:
 *   data/prefectures/tokorozawa.js  (window.TOKOROZAWA_MUNICIPALITIES = ...)
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

// ── CLI 引数 ──────────────────────────────────────────────
const args = process.argv.slice(2);
const shpArg = args.find((a) => a.startsWith("--shp="));
if (!shpArg) {
  console.error("Usage: node tools/build-tokorozawa-data.mjs --shp=path/to/r2ka11208.shp");
  process.exit(1);
}
const shpPath = path.resolve(shpArg.replace("--shp=", ""));

const OUTPUT      = "data/prefectures/tokorozawa.js";
const GLOBAL_NAME = "TOKOROZAWA_MUNICIPALITIES";
const CITY_CODE   = "11208"; // 所沢市の全国市区町村コード
const AREA_CODE   = "04";
const MA_NAME     = "所沢MA";

// ── ヘルパー ──────────────────────────────────────────────

/**
 * e-Stat 小地域の S_NAME から丁目番号を除去して基本町名を返す。
 *   "東町一丁目"    → "東町"
 *   "大字上安松"    → "上安松"
 *   "若松町"        → "若松町"（変化なし）
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
 * Feature が所沢市かどうかを判定する。
 * KEY_CODE の先頭5文字 = "11208" を優先し、
 * KEY_CODE がなければ PREF=="11" && CITY=="208" で判定。
 */
function isTokorozawa(feature, fields) {
  const p = feature.properties;
  if (fields.keyCode) {
    return String(p[fields.keyCode]).slice(0, 5) === CITY_CODE;
  }
  if (fields.pref && fields.city) {
    return String(p[fields.pref]) === "11" && String(p[fields.city]) === "208";
  }
  return false;
}

// ── メイン処理 ────────────────────────────────────────────
const tempDir = await mkdtemp(path.join(tmpdir(), "geoquiz-tokorozawa-"));

try {
  // ===== Step 1: SHP → GeoJSON =====
  console.log("Step 1: SHP → GeoJSON...");
  const rawPath = path.join(tempDir, "raw.geojson");
  await execFile(
    process.execPath,
    [mapshaperBin, shpPath, "-o", "format=geojson", rawPath],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 200 },
  );
  const rawGeoJson = JSON.parse(await readFile(rawPath, "utf8"));
  console.log(`  全 feature 数: ${rawGeoJson.features.length}`);

  // ===== Step 2: 所沢市（11208）でフィルタ =====
  console.log("Step 2: 所沢市フィルタ...");
  if (!rawGeoJson.features.length) throw new Error("Shapefile に feature がありません");

  const fields = detectFields(rawGeoJson.features[0]);
  console.log(`  検出フィールド: ${JSON.stringify(fields)}`);
  if (!fields.sName) throw new Error("町名フィールド（S_NAME/MOJI）が見つかりません");

  const tokorozawaFeatures = rawGeoJson.features.filter((f) => isTokorozawa(f, fields));
  console.log(`  所沢市 feature 数: ${tokorozawaFeatures.length}`);
  if (!tokorozawaFeatures.length) throw new Error("所沢市の feature が0件です。CITY_CODE または SHP のパスを確認してください。");

  // ===== Step 3: 丁目番号を除去して _chome プロパティを付加 =====
  console.log("Step 3: 町名から丁目番号を除去...");
  for (const f of tokorozawaFeatures) {
    const rawName = f.properties[fields.sName] || "";
    f.properties._chome = baseChomeName(rawName);
  }

  // _chome ごとの元 S_NAME を確認表示
  const chomeMap = new Map();
  for (const f of tokorozawaFeatures) {
    const chome = f.properties._chome;
    if (!chomeMap.has(chome)) chomeMap.set(chome, new Set());
    chomeMap.get(chome).add(f.properties[fields.sName]);
  }
  const mergedCount = [...chomeMap.values()].filter((s) => s.size > 1).length;
  console.log(`  ${tokorozawaFeatures.length} 小地域 → ${chomeMap.size} 町字（うち ${mergedCount} 町が丁目合体対象）`);

  // ===== Step 4: mapshaper dissolve で同名丁目を合体 =====
  console.log("Step 4: 丁目合体（dissolve）...");
  const preDissolvePath = path.join(tempDir, "pre_dissolve.geojson");
  const dissolvedPath   = path.join(tempDir, "dissolved.geojson");

  await writeFile(preDissolvePath, JSON.stringify({
    type: "FeatureCollection",
    features: tokorozawaFeatures,
  }));

  await execFile(
    process.execPath,
    [
      mapshaperBin,
      preDissolvePath,
      "-snap",                                         // 近接頂点を吸着（JGD2011座標精度の問題を解消）
      "-clean",                                        // 自己交差・重複リングを除去
      "-dissolve", "_chome",
      "-filter-islands", "min-area=500m2", "remove-empty",
      "-o", "format=geojson", dissolvedPath,
    ],
    { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 50 },
  );
  const dissolved = JSON.parse(await readFile(dissolvedPath, "utf8"));
  console.log(`  dissolve 後: ${dissolved.features.length} 町字`);

  // ===== Step 4b: dissolve で脱落した町字を救済 =====
  // mapshaper の dissolve がトポロジー処理で null geometry を生成することがある。
  // pre-dissolve に存在して post-dissolve に存在しない _chome を特定し、
  // 元のポリゴンをそのまま（または再 dissolve して）追加する。
  {
    const dissolvedNames = new Set(dissolved.features.map((f) => f.properties._chome));
    const chomeGroups = new Map();
    for (const f of tokorozawaFeatures) {
      const chome = f.properties._chome;
      if (!dissolvedNames.has(chome)) {
        if (!chomeGroups.has(chome)) chomeGroups.set(chome, []);
        chomeGroups.get(chome).push(f);
      }
    }
    if (chomeGroups.size > 0) {
      const rescuedNames = [...chomeGroups.keys()];
      console.log(`  ⚠️  dissolve で脱落した町字を救済 (${rescuedNames.length}件): ${rescuedNames.join(", ")}`);
      let rescueIdx = 0;
      for (const [chome, raws] of chomeGroups) {
        if (raws.length === 1 && raws[0].geometry) {
          // 単一 feature → そのままコピー
          dissolved.features.push({ type: "Feature", properties: { _chome: chome }, geometry: raws[0].geometry });
        } else {
          // 複数 feature → mapshaper で再 dissolve
          const rescueSrc  = path.join(tempDir, `rescue_${rescueIdx}_src.geojson`);
          const rescueDst  = path.join(tempDir, `rescue_${rescueIdx}_dst.geojson`);
          rescueIdx++;
          await writeFile(rescueSrc, JSON.stringify({ type: "FeatureCollection", features: raws }));
          try {
            await execFile(
              process.execPath,
              [mapshaperBin, rescueSrc, "-dissolve", "_chome", "-o", "format=geojson", rescueDst],
              { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 10 },
            );
            const rescued = JSON.parse(await readFile(rescueDst, "utf8"));
            if (rescued.features.length > 0 && rescued.features[0].geometry) {
              dissolved.features.push(rescued.features[0]);
            } else {
              console.warn(`    ⚠️  "${chome}" の再 dissolve も失敗 → 最大面積ポリゴンを使用`);
              const largest = raws.reduce((a, b) => (b.geometry && (!a.geometry)) ? b : a);
              if (largest.geometry) dissolved.features.push({ type: "Feature", properties: { _chome: chome }, geometry: largest.geometry });
            }
          } catch (e) {
            console.warn(`    ⚠️  "${chome}" の再 dissolve でエラー: ${e.message}`);
          }
        }
      }
      console.log(`  救済後: ${dissolved.features.length} 町字`);
    }
  }

  // ===== Step 5: GeoQuiz 用プロパティを付加 =====
  console.log("Step 5: GeoQuiz プロパティ付加...");
  const withProps = {
    type: "FeatureCollection",
    features: dissolved.features.map((f) => {
      const chome = f.properties._chome || "（不明）";
      return {
        type: "Feature",
        properties: {
          id        : `tokorozawa_${chome}`,
          name      : chome,
          area_code : AREA_CODE,
          ma_name   : MA_NAME,
          region    : "所沢市",
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
    city        : { id: "tokorozawa", name: "所沢市", code: "11208", prefecture: "埼玉県" },
    generatedAt : new Date().toISOString(),
    municipalities,
    features    : simplified.features,
  };

  await mkdir("data/prefectures", { recursive: true });
  await writeFile(OUTPUT, `window.${GLOBAL_NAME} = ${JSON.stringify(payload)};\n`, "utf8");

  console.log(`\n✅ 完了: ${OUTPUT}`);
  console.log(`   ${simplified.features.length} 町字, 頂点数 ${rawVertexCount} → ${simplifiedVertexCount}`);
  console.log("\n次のステップ:");
  console.log("  1. node tools/precompute-ma-features.mjs --only=tokorozawa");
  console.log("  2. node tools/validate-data.mjs --file=data/prefectures/tokorozawa.js");
  console.log("  3. catalog.js に tokorozawa エントリを追加");

} finally {
  await rm(tempDir, { recursive: true, force: true });
}
