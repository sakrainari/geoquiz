import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { simplifyAllFeatures, countFeatureVertices } from "./lib/simplify-all-dataset.mjs";

const DATASET_SOURCES = [
  { datasetFile: "data/prefectures/aomori.js", datasetGlobal: "AOMORI_MUNICIPALITIES", labelFile: "data/aomori/label-overrides.js", labelGlobal: "AOMORI_LABEL_OVERRIDES", speechFile: "data/aomori/speech-readings.js", speechGlobal: "AOMORI_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/iwate.js", datasetGlobal: "IWATE_MUNICIPALITIES", labelFile: "data/iwate/label-overrides.js", labelGlobal: "IWATE_LABEL_OVERRIDES", speechFile: "data/iwate/speech-readings.js", speechGlobal: "IWATE_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/miyagi.js", datasetGlobal: "MIYAGI_MUNICIPALITIES", labelFile: "data/miyagi/label-overrides.js", labelGlobal: "MIYAGI_LABEL_OVERRIDES", speechFile: "data/miyagi/speech-readings.js", speechGlobal: "MIYAGI_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/akita.js", datasetGlobal: "AKITA_MUNICIPALITIES", labelFile: "data/akita/label-overrides.js", labelGlobal: "AKITA_LABEL_OVERRIDES", speechFile: "data/akita/speech-readings.js", speechGlobal: "AKITA_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/yamagata.js", datasetGlobal: "YAMAGATA_MUNICIPALITIES", labelFile: "data/yamagata/label-overrides.js", labelGlobal: "YAMAGATA_LABEL_OVERRIDES", speechFile: "data/yamagata/speech-readings.js", speechGlobal: "YAMAGATA_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/fukushima.js", datasetGlobal: "FUKUSHIMA_MUNICIPALITIES", labelFile: "data/fukushima/label-overrides.js", labelGlobal: "FUKUSHIMA_LABEL_OVERRIDES", speechFile: "data/fukushima/speech-readings.js", speechGlobal: "FUKUSHIMA_SPEECH_READINGS" }
];

async function loadWindowGlobal(filePath, globalName) {
  const source = await readFile(filePath, "utf8");
  const context = { window: {} };
  vm.createContext(context);
  new vm.Script(source, { filename: filePath }).runInContext(context);
  const value = context.window[globalName];
  if (!value) throw new Error(`Missing ${globalName} in ${filePath}`);
  return value;
}

const datasets = [];
const labelOverrides = { municipalities: {}, areaCodes: {} };
const speechReadings = {};

for (const source of DATASET_SOURCES) {
  datasets.push(await loadWindowGlobal(source.datasetFile, source.datasetGlobal));
  const overrides = await loadWindowGlobal(source.labelFile, source.labelGlobal);
  if (overrides.municipalities) Object.assign(labelOverrides.municipalities, overrides.municipalities);
  if (overrides.areaCodes) Object.assign(labelOverrides.areaCodes, overrides.areaCodes);
  Object.assign(speechReadings, await loadWindowGlobal(source.speechFile, source.speechGlobal));
}

const rawFeatures = datasets.flatMap((dataset) => dataset.features);
const { features, rawCount, simplifiedCount } = await simplifyAllFeatures(rawFeatures);

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "tohoku_all", name: "東北全域", code: "tohoku" },
  generatedAt: new Date().toISOString(),
  municipalities: datasets.flatMap((dataset) => dataset.municipalities),
  features
};

await mkdir("data/prefectures", { recursive: true });
await mkdir("data/tohoku-all", { recursive: true });
await writeFile("data/prefectures/tohoku-all.js", `window.TOHOKU_ALL_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
await writeFile("data/tohoku-all/label-overrides.js", `window.TOHOKU_ALL_LABEL_OVERRIDES = ${JSON.stringify(labelOverrides, null, 2)};\n`, "utf8");
await writeFile("data/tohoku-all/speech-readings.js", `window.TOHOKU_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadings, null, 2)};\n`, "utf8");
console.log(`wrote data/prefectures/tohoku-all.js (${payload.features.length} drawable features, ${payload.municipalities.length} quiz answers, vertices ${rawCount} -> ${simplifiedCount})`);
