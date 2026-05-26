import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { simplifyAllFeatures } from "./lib/simplify-all-dataset.mjs";

const DATASET_SOURCES = [
  {
    datasetFile: "data/prefectures/kagawa.js",
    datasetGlobal: "KAGAWA_MUNICIPALITIES",
    labelFile: "data/kagawa/label-overrides.js",
    labelGlobal: "KAGAWA_LABEL_OVERRIDES",
    speechFile: "data/kagawa/speech-readings.js",
    speechGlobal: "KAGAWA_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/tokushima.js",
    datasetGlobal: "TOKUSHIMA_MUNICIPALITIES",
    labelFile: "data/tokushima/label-overrides.js",
    labelGlobal: "TOKUSHIMA_LABEL_OVERRIDES",
    speechFile: "data/tokushima/speech-readings.js",
    speechGlobal: "TOKUSHIMA_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/ehime.js",
    datasetGlobal: "EHIME_MUNICIPALITIES",
    labelFile: "data/ehime/label-overrides.js",
    labelGlobal: "EHIME_LABEL_OVERRIDES",
    speechFile: "data/ehime/speech-readings.js",
    speechGlobal: "EHIME_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/kochi.js",
    datasetGlobal: "KOCHI_MUNICIPALITIES",
    labelFile: "data/kochi/label-overrides.js",
    labelGlobal: "KOCHI_LABEL_OVERRIDES",
    speechFile: "data/kochi/speech-readings.js",
    speechGlobal: "KOCHI_SPEECH_READINGS"
  }
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

const shikokuAllPayload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: {
    id: "shikoku_all",
    name: "四国全域",
    code: "shikoku"
  },
  generatedAt: new Date().toISOString(),
  municipalities: datasets.flatMap((dataset) => dataset.municipalities),
  features
};

await mkdir("data/prefectures", { recursive: true });
await mkdir("data/shikoku-all", { recursive: true });

await writeFile(
  "data/prefectures/shikoku-all.js",
  `window.SHIKOKU_ALL_MUNICIPALITIES = ${JSON.stringify(shikokuAllPayload)};\n`,
  "utf8"
);
await writeFile(
  "data/shikoku-all/label-overrides.js",
  `window.SHIKOKU_ALL_LABEL_OVERRIDES = ${JSON.stringify(labelOverrides, null, 2)};\n`,
  "utf8"
);
await writeFile(
  "data/shikoku-all/speech-readings.js",
  `window.SHIKOKU_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadings, null, 2)};\n`,
  "utf8"
);

console.log(
  `wrote data/prefectures/shikoku-all.js (${shikokuAllPayload.features.length} drawable features, ${shikokuAllPayload.municipalities.length} quiz answers, vertices ${rawCount} -> ${simplifiedCount})`
);
