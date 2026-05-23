import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { simplifyAllFeatures } from "./lib/simplify-all-dataset.mjs";

const DATASET_SOURCES = [
  { datasetFile: "data/prefectures/tottori.js", datasetGlobal: "TOTTORI_MUNICIPALITIES", labelFile: "data/tottori/label-overrides.js", labelGlobal: "TOTTORI_LABEL_OVERRIDES", speechFile: "data/tottori/speech-readings.js", speechGlobal: "TOTTORI_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/shimane.js", datasetGlobal: "SHIMANE_MUNICIPALITIES", labelFile: "data/shimane/label-overrides.js", labelGlobal: "SHIMANE_LABEL_OVERRIDES", speechFile: "data/shimane/speech-readings.js", speechGlobal: "SHIMANE_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/okayama.js", datasetGlobal: "OKAYAMA_MUNICIPALITIES", labelFile: "data/okayama/label-overrides.js", labelGlobal: "OKAYAMA_LABEL_OVERRIDES", speechFile: "data/okayama/speech-readings.js", speechGlobal: "OKAYAMA_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/hiroshima.js", datasetGlobal: "HIROSHIMA_MUNICIPALITIES", labelFile: "data/hiroshima/label-overrides.js", labelGlobal: "HIROSHIMA_LABEL_OVERRIDES", speechFile: "data/hiroshima/speech-readings.js", speechGlobal: "HIROSHIMA_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/yamaguchi.js", datasetGlobal: "YAMAGUCHI_MUNICIPALITIES", labelFile: "data/yamaguchi/label-overrides.js", labelGlobal: "YAMAGUCHI_LABEL_OVERRIDES", speechFile: "data/yamaguchi/speech-readings.js", speechGlobal: "YAMAGUCHI_SPEECH_READINGS" }
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

const { features, rawCount, simplifiedCount } = await simplifyAllFeatures(datasets.flatMap((dataset) => dataset.features));

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "chugoku_all", name: "中国全域", code: "chugoku" },
  generatedAt: new Date().toISOString(),
  municipalities: datasets.flatMap((dataset) => dataset.municipalities),
  features
};

await mkdir("data/prefectures", { recursive: true });
await mkdir("data/chugoku-all", { recursive: true });
await writeFile("data/prefectures/chugoku-all.js", `window.CHUGOKU_ALL_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
await writeFile("data/chugoku-all/label-overrides.js", `window.CHUGOKU_ALL_LABEL_OVERRIDES = ${JSON.stringify(labelOverrides, null, 2)};\n`, "utf8");
await writeFile("data/chugoku-all/speech-readings.js", `window.CHUGOKU_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadings, null, 2)};\n`, "utf8");
console.log(`wrote data/prefectures/chugoku-all.js (${payload.features.length} drawable features, ${payload.municipalities.length} quiz answers, vertices ${rawCount} -> ${simplifiedCount})`);
