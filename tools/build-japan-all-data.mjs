/**
 * 日本全域データセットを生成する。
 * 各広域データ（hokkaido-all〜okinawa）をマージし、日本全域スケールで簡略化。
 *
 * 使い方:
 *   node tools/build-japan-all-data.mjs
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./lib/simplify-with-mapshaper.mjs";

// 結合する広域データセット（地理的順序）
const REGION_IDS = [
  "hokkaido-all",
  "tohoku-all",
  "kanto-all",
  "chubu-all",
  "kinki-all",
  "chugoku-all",
  "shikoku-all",
  "kyushu-all",
  "okinawa",
];

function readPayload(path) {
  return readFile(path, "utf8").then((source) => {
    const context = { window: {} };
    vm.createContext(context);
    new vm.Script(source, { filename: path }).runInContext(context);
    return Object.values(context.window)[0];
  });
}

function buildSpeechReadings(payloads) {
  const entries = [];
  for (const payload of payloads) {
    for (const municipality of payload.municipalities) {
      const feature = payload.features.find((f) => f.properties.id === municipality.id);
      if (feature?.properties?.kana) entries.push([municipality.name, feature.properties.kana]);
    }
  }
  return Object.fromEntries(entries);
}

// 各広域データを読み込む
console.log("広域データを読み込み中...");
const payloads = await Promise.all(
  REGION_IDS.map((id) => readPayload(`data/prefectures/${id}.js`))
);

for (let i = 0; i < REGION_IDS.length; i++) {
  const p = payloads[i];
  console.log(`  ${REGION_IDS[i].padEnd(16)} 市区町村 ${p.municipalities.length} 件 / features ${p.features.length} 件`);
}

// 全featuresをマージ
const rawFeatureCollection = {
  type: "FeatureCollection",
  features: payloads.flatMap((p) => p.features),
};
const rawVertexCount = countFeatureVertices(rawFeatureCollection);
console.log(`\nマージ後: ${rawFeatureCollection.features.length} features, ${rawVertexCount} 頂点`);

// 日本全域スケールで簡略化（800m: 全国俯瞰ズームに最適化）
console.log("簡略化中 (interval=800m)...");
const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(rawFeatureCollection, {
  interval: "800m",
  weighting: 0.78,
  minIslandArea: "40000m2",
  minSliverArea: "50000m2",
  sliverControl: 0.9,
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);
console.log(`簡略化後: ${simplifiedFeatureCollection.features.length} features, ${simplifiedVertexCount} 頂点`);

// 出力データを組み立てる
const allMunicipalities = payloads.flatMap((p) => p.municipalities);
const speechReadings = buildSpeechReadings(payloads);

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "japan_all", name: "日本全域", code: "japan" },
  generatedAt: new Date().toISOString(),
  municipalities: allMunicipalities,
  features: simplifiedFeatureCollection.features,
};

await mkdir("data/prefectures", { recursive: true });
await mkdir("data/japan-all", { recursive: true });

await writeFile(
  "data/prefectures/japan-all.js",
  `window.JAPAN_ALL_MUNICIPALITIES = ${JSON.stringify(payload)};\n`,
  "utf8"
);
await writeFile(
  "data/japan-all/label-overrides.js",
  `window.JAPAN_ALL_LABEL_OVERRIDES = ${JSON.stringify({ municipalities: {}, areaCodes: {} }, null, 2)};\n`,
  "utf8"
);
await writeFile(
  "data/japan-all/speech-readings.js",
  `window.JAPAN_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadings, null, 2)};\n`,
  "utf8"
);

console.log(`\n✅ 完了`);
console.log(`   data/prefectures/japan-all.js`);
console.log(`     ${simplifiedFeatureCollection.features.length} features`);
console.log(`     ${allMunicipalities.length} 市区町村`);
console.log(`     頂点数: ${rawVertexCount} → ${simplifiedVertexCount} (${Math.round(simplifiedVertexCount / rawVertexCount * 100)}%)`);
console.log(`   data/japan-all/speech-readings.js: ${Object.keys(speechReadings).length} 件`);
