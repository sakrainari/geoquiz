/**
 * tools/precompute-geo.mjs
 *
 * 使い方:
 *   node tools/precompute-geo.mjs
 *   node tools/precompute-geo.mjs saitama          ← 埼玉だけ
 *   node tools/precompute-geo.mjs saitama tokyo    ← 複数指定
 *   node tools/precompute-geo.mjs --all            ← 全データセット
 *
 * 出力先: data/<datasetId>/precomputed.js
 * ※ data/saitama/precomputed.js のように各データセットのフォルダに生成します
 *
 * 注意: turf.js は vendor/turf/turf.min.js をそのまま使います。
 *       Node.js 18 以上を推奨。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ─── turf をロード（vendor からそのまま読む）───────────────────────
function loadTurf() {
  const turfPath = resolve(ROOT, "vendor/turf/turf.min.js");
  if (!existsSync(turfPath)) {
    throw new Error(`turf.min.js が見つかりません: ${turfPath}`);
  }
  // turf は window.turf に書き出す設計なのでグローバルを偽装して eval する
  const code = readFileSync(turfPath, "utf-8");
  const fakeWindow = {};
  // eslint-disable-next-line no-new-func
  new Function("window", code)(fakeWindow);
  if (!fakeWindow.turf) {
    throw new Error("turf のロードに失敗しました（window.turf が undefined）");
  }
  return fakeWindow.turf;
}

// ─── データファイルをロード（window.XXXX = ... 形式を eval）──────────
function loadDataFile(filePath, globalName) {
  if (!existsSync(filePath)) {
    return null;
  }
  const code = readFileSync(filePath, "utf-8");
  const fakeWindow = {};
  try {
    // eslint-disable-next-line no-new-func
    new Function("window", code)(fakeWindow);
  } catch (e) {
    throw new Error(`ファイルの読み込みエラー (${filePath}): ${e.message}`);
  }
  return fakeWindow[globalName] || null;
}

// ─── turf.union ラッパー（エラーを握りつぶさず報告する）──────────
function safeUnion(turf, features, label) {
  try {
    const fc = { type: "FeatureCollection", features };
    const result = turf.union(fc);
    return result ? result.geometry : null;
  } catch (e) {
    console.warn(`  ⚠️  union失敗 [${label}]: ${e.message}`);
    return null;
  }
}

// ─── 広域市外局番コードを返す（ma-union.js と同じロジック）────────
function broadAreaCode(code) {
  const str = String(code || "");
  if (str.startsWith("049")) return "049";
  if (str.startsWith("048")) return "048";
  if (str.startsWith("04"))  return "04";
  return str;
}

// ─── ポリゴン面積スコア（turf.area の簡易版フォールバック）──────
function geometryBboxArea(geometry) {
  const pts = [];
  function collect(coords) {
    if (!coords || !coords.length) return;
    if (typeof coords[0] === "number") { pts.push(coords); return; }
    coords.forEach(collect);
  }
  collect(geometry.coordinates);
  if (!pts.length) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  pts.forEach(([x, y]) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  });
  return (maxX - minX) * (maxY - minY);
}

// ─── 分離した小ポリゴンを除去（turf.union後のゴミを消す）──────────
function filterSmallPolygons(geometry) {
  if (!geometry || geometry.type !== "MultiPolygon") return geometry;
  const MIN_AREA  = 25000;  // 面積下限（m²）
  const MIN_RATIO = 0.005;  // 最大ポリゴンに対する比率下限

  const polygons = geometry.coordinates.map((coords) => ({
    coords,
    area: geometryBboxArea({ type: "Polygon", coordinates: coords })
  }));
  if (polygons.length <= 1) return geometry;

  const maxArea = polygons.reduce((m, p) => Math.max(m, p.area), 0);
  const minArea = Math.max(MIN_AREA, maxArea * MIN_RATIO);
  const kept = polygons.filter((p) => p.area >= minArea);

  if (!kept.length) {
    const largest = polygons.reduce((a, b) => a.area >= b.area ? a : b);
    return { type: "Polygon", coordinates: largest.coords };
  }
  if (kept.length === 1) return { type: "Polygon", coordinates: kept[0].coords };
  return { type: "MultiPolygon", coordinates: kept.map((p) => p.coords) };
}

// ─── 重心点（ラベル位置）を計算────────────────────────────────────
function labelPoint(turf, feature) {
  try {
    const result = turf.centerOfMass(feature);
    const coords = result && result.geometry && result.geometry.coordinates;
    if (Array.isArray(coords)) return [+coords[1].toFixed(6), +coords[0].toFixed(6)];
  } catch {
    // fall through
  }
  return null;
}

// ─── 1データセット分を処理────────────────────────────────────────
function processDataset(turf, config) {
  const { id, dataGlobal } = config;
  console.log(`\n📍 [${id}] ${config.name || id}`);

  // データファイルのパスを探す（data/prefectures/ と data/<id>/ の両方を試す）
  const candidates = [
    resolve(ROOT, "data", "prefectures", `${id}.js`),
    resolve(ROOT, "data", id, `${id}.js`),
    resolve(ROOT, "data", `${id}.js`)
  ];
  let dataPath = null;
  for (const p of candidates) {
    if (existsSync(p)) { dataPath = p; break; }
  }
  if (!dataPath) {
    console.warn(`  ⚠️  データファイルが見つかりません（スキップ）`);
    console.warn(`     探したパス: ${candidates.join(", ")}`);
    return null;
  }

  const dataset = loadDataFile(dataPath, dataGlobal);
  if (!dataset || !Array.isArray(dataset.features)) {
    console.warn(`  ⚠️  ${dataGlobal} のロードに失敗（スキップ）`);
    return null;
  }
  console.log(`  📂 フィーチャー数: ${dataset.features.length}`);

  const features = dataset.features;

  // ── ① 市区町村フィーチャー（さいたま市区など同一IDを結合）────
  console.log("  🔧 市区町村ポリゴンを結合中...");
  const muniGroups = new Map();
  features.forEach((f) => {
    const fid = f.properties.id;
    if (!muniGroups.has(fid)) muniGroups.set(fid, []);
    muniGroups.get(fid).push(f);
  });

  const municipalityFeatures = [];
  let muniUnioned = 0;
  for (const [, group] of muniGroups) {
    if (group.length === 1) {
      municipalityFeatures.push(group[0]);
      continue;
    }
    const geom = safeUnion(turf, group, group[0].properties.id);
    municipalityFeatures.push({
      type: "Feature",
      properties: {
        ...group[0].properties,
        sourceCodes: group.map((f) => f.properties.sourceCode).filter(Boolean),
        sourceFeatureCount: group.length
      },
      geometry: geom || { type: "GeometryCollection", geometries: group.map((f) => f.geometry) }
    });
    muniUnioned++;
  }
  console.log(`  ✅ 市区町村: ${municipalityFeatures.length}件（${muniUnioned}件を結合）`);

  // ── ② 市外局番エリア（area_code 単位で結合）──────────────────
  const maGroups = new Map();
  features.forEach((f) => {
    const code = f.properties.area_code;
    if (!code) return;
    if (!maGroups.has(code)) maGroups.set(code, []);
    maGroups.get(code).push(f);
  });

  let maFeatures = null;
  if (maGroups.size > 0) {
    console.log(`  🔧 市外局番エリア(${maGroups.size}エリア)を結合中...`);
    maFeatures = [];
    for (const [code, group] of maGroups) {
      const geom = safeUnion(turf, group, `MA:${code}`);
      const filtered = geom ? filterSmallPolygons(geom) : null;
      const feature = {
        type: "Feature",
        properties: {
          area_code: code,
          id: `area_code:${code}`,
          ma_name: group[0].properties.ma_name || "",
          memberIds: group.map((f) => f.properties.id),
          labelPoint: null
        },
        geometry: filtered || geom || {
          type: "GeometryCollection",
          geometries: group.map((f) => f.geometry)
        }
      };
      feature.properties.labelPoint = labelPoint(turf, feature);
      maFeatures.push(feature);
    }
    console.log(`  ✅ 市外局番エリア: ${maFeatures.length}件`);
  }

  // ── ③ 広域市外局番エリア（broadAreaCode 単位で結合）──────────
  const broadGroups = new Map();
  features.forEach((f) => {
    const code = broadAreaCode(f.properties.area_code);
    if (!code) return;
    if (!broadGroups.has(code)) broadGroups.set(code, []);
    broadGroups.get(code).push(f);
  });

  let maBroadFeatures = null;
  if (broadGroups.size > 0 && broadGroups.size !== maGroups.size) {
    console.log(`  🔧 広域市外局番エリア(${broadGroups.size}エリア)を結合中...`);
    maBroadFeatures = [];
    for (const [code, group] of broadGroups) {
      const geom = safeUnion(turf, group, `BROAD:${code}`);
      const filtered = geom ? filterSmallPolygons(geom) : null;
      const feature = {
        type: "Feature",
        properties: {
          area_code: code,
          id: `broad_area_code:${code}`,
          memberIds: group.map((f) => f.properties.id),
          labelPoint: null
        },
        geometry: filtered || geom || {
          type: "GeometryCollection",
          geometries: group.map((f) => f.geometry)
        }
      };
      feature.properties.labelPoint = labelPoint(turf, feature);
      maBroadFeatures.push(feature);
    }
    console.log(`  ✅ 広域市外局番エリア: ${maBroadFeatures.length}件`);
  }

  return { municipalityFeatures, maFeatures, maBroadFeatures };
}

// ─── JS ファイルとして出力────────────────────────────────────────
function writeOutput(id, result) {
  const outDir = resolve(ROOT, "data", id);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
    console.log(`  📁 フォルダ作成: data/${id}/`);
  }
  const outPath = resolve(outDir, "precomputed.js");

  const lines = [
    `// 自動生成ファイル — tools/precompute-geo.mjs で生成`,
    `// 手動編集しないでください。再生成するには: node tools/precompute-geo.mjs ${id}`,
    `// 生成日時: ${new Date().toISOString()}`,
    `(function () {`,
    `  var d = window.__GEOQUIZ_PRECOMPUTED = window.__GEOQUIZ_PRECOMPUTED || {};`,
    `  d[${JSON.stringify(id)}] = {`,
    `    municipalityFeatures: ${JSON.stringify(result.municipalityFeatures)},`,
    `    maFeatures: ${result.maFeatures ? JSON.stringify(result.maFeatures) : "null"},`,
    `    maBroadFeatures: ${result.maBroadFeatures ? JSON.stringify(result.maBroadFeatures) : "null"}`,
    `  };`,
    `})();`
  ].join("\n");

  writeFileSync(outPath, lines, "utf-8");
  const kb = Math.round(lines.length / 1024);
  console.log(`  💾 出力完了: data/${id}/precomputed.js (${kb} KB)`);
  return outPath;
}

// ─── メイン────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const runAll = args.includes("--all");

  // catalog.js をロード
  const catalogPath = resolve(ROOT, "data/catalog.js");
  if (!existsSync(catalogPath)) {
    throw new Error(`catalog.js が見つかりません: ${catalogPath}`);
  }
  const catalogCode = readFileSync(catalogPath, "utf-8");
  const fakeWindow = {};
  // eslint-disable-next-line no-new-func
  new Function("window", catalogCode)(fakeWindow);
  const catalog = fakeWindow.GEOQUIZ_DATASETS;
  if (!Array.isArray(catalog)) throw new Error("GEOQUIZ_DATASETS が読み込めませんでした");

  // 処理対象を決める
  let targets;
  if (runAll) {
    targets = catalog;
    console.log(`🗺️  全 ${catalog.length} データセットを処理します`);
  } else if (args.length > 0) {
    targets = catalog.filter((c) => args.includes(c.id));
    const notFound = args.filter((a) => a !== "--all" && !catalog.find((c) => c.id === a));
    if (notFound.length) console.warn(`⚠️  見つからないデータセット: ${notFound.join(", ")}`);
    if (!targets.length) {
      console.error("処理対象がありません。ID を確認してください。");
      console.log("利用可能なID:", catalog.map((c) => c.id).join(", "));
      process.exit(1);
    }
  } else {
    // 引数なし → saitama だけ処理（デフォルト）
    targets = catalog.filter((c) => c.id === "saitama");
    console.log("引数なし → saitama を処理します（全件は --all を付けてください）");
  }

  // turf をロード
  console.log("\n📦 turf.js をロード中...");
  const turf = loadTurf();
  console.log("✅ turf.js ロード完了");

  // 各データセットを処理
  const results = [];
  for (const config of targets) {
    const result = processDataset(turf, config);
    if (result) {
      const outPath = writeOutput(config.id, result);
      results.push({ id: config.id, outPath });
    }
  }

  // 完了サマリー
  console.log("\n" + "─".repeat(60));
  console.log(`✅ 完了: ${results.length} / ${targets.length} データセット`);
  if (results.length > 0) {
    console.log("\n次のステップ:");
    console.log("1. index.html に以下を追加してください（各データファイルの直後）:");
    results.forEach(({ id }) => {
      console.log(`   <script src="data/${id}/precomputed.js"></script>`);
    });
    console.log("\n2. js/map-renderer.js の buildMunicipalityDisplayFeatures 関数（1340行目付近）に");
    console.log("   キャッシュ参照コードを追加してください（別途説明します）。");
  }
}

main().catch((e) => {
  console.error("❌ エラー:", e.message);
  process.exit(1);
});
