import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./lib/simplify-with-mapshaper.mjs";
import { buildChubuPrefectureDataset, CHUBU_PREFECTURE_CONFIGS } from "./lib/build-chubu-dataset.mjs";

const DATASET_IDS = ["niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano", "gifu", "shizuoka", "aichi"];

function readPayload(globalName, path) {
  return readFile(path, "utf8").then((source) => {
    const context = { window: {} };
    vm.createContext(context);
    new vm.Script(source, { filename: path }).runInContext(context);
    return context.window[globalName];
  });
}

function speechReadingsFromPayloads(payloads) {
  const entries = [];
  for (const payload of payloads) {
    for (const municipality of payload.municipalities) {
      const feature = payload.features.find((item) => item.properties.id === municipality.id);
      if (feature?.properties?.kana) entries.push([municipality.name, feature.properties.kana]);
    }
  }
  return Object.fromEntries(entries);
}

for (const id of DATASET_IDS) {
  await buildChubuPrefectureDataset(id);
}

const payloads = await Promise.all(
  DATASET_IDS.map((id) => readPayload(CHUBU_PREFECTURE_CONFIGS[id].globalName, `data/prefectures/${id}.js`))
);
const rawFeatureCollection = {
  type: "FeatureCollection",
  features: payloads.flatMap((payload) => payload.features)
};
const rawVertexCount = countFeatureVertices(rawFeatureCollection);
const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(rawFeatureCollection, {
  interval: "120m",
  weighting: 0.78,
  minIslandArea: "4500m2",
  minSliverArea: "5000m2",
  sliverControl: 0.9
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "chubu_all", name: "中部全域", code: "chubu" },
  generatedAt: new Date().toISOString(),
  municipalities: payloads.flatMap((dataset) => dataset.municipalities),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await mkdir("data/chubu-all", { recursive: true });
await writeFile("data/prefectures/chubu-all.js", `window.CHUBU_ALL_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
await writeFile(
  "data/chubu-all/label-overrides.js",
  `window.CHUBU_ALL_LABEL_OVERRIDES = ${JSON.stringify({ municipalities: {}, areaCodes: {} }, null, 2)};\n`,
  "utf8"
);
await writeFile(
  "data/chubu-all/speech-readings.js",
  `window.CHUBU_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadingsFromPayloads(payloads), null, 2)};\n`,
  "utf8"
);

console.log(
  `wrote data/prefectures/chubu-all.js (${simplifiedFeatureCollection.features.length} drawable features, ${payload.municipalities.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
