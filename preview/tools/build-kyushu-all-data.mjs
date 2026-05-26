import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { simplifyAllFeatures, countFeatureVertices } from "./lib/simplify-all-dataset.mjs";

const DATASET_SOURCES = [
  {
    datasetFile: "data/prefectures/fukuoka.js",
    datasetGlobal: "FUKUOKA_MUNICIPALITIES",
    labelFile: "data/fukuoka/label-overrides.js",
    labelGlobal: "FUKUOKA_LABEL_OVERRIDES",
    speechFile: "data/fukuoka/speech-readings.js",
    speechGlobal: "FUKUOKA_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/saga.js",
    datasetGlobal: "SAGA_MUNICIPALITIES",
    labelFile: "data/saga/label-overrides.js",
    labelGlobal: "SAGA_LABEL_OVERRIDES",
    speechFile: "data/saga/speech-readings.js",
    speechGlobal: "SAGA_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/nagasaki.js",
    datasetGlobal: "NAGASAKI_MUNICIPALITIES",
    labelFile: "data/nagasaki/label-overrides.js",
    labelGlobal: "NAGASAKI_LABEL_OVERRIDES",
    speechFile: "data/nagasaki/speech-readings.js",
    speechGlobal: "NAGASAKI_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/kumamoto.js",
    datasetGlobal: "KUMAMOTO_MUNICIPALITIES",
    labelFile: "data/kumamoto/label-overrides.js",
    labelGlobal: "KUMAMOTO_LABEL_OVERRIDES",
    speechFile: "data/kumamoto/speech-readings.js",
    speechGlobal: "KUMAMOTO_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/oita.js",
    datasetGlobal: "OITA_MUNICIPALITIES",
    labelFile: "data/oita/label-overrides.js",
    labelGlobal: "OITA_LABEL_OVERRIDES",
    speechFile: "data/oita/speech-readings.js",
    speechGlobal: "OITA_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/miyazaki.js",
    datasetGlobal: "MIYAZAKI_MUNICIPALITIES",
    labelFile: "data/miyazaki/label-overrides.js",
    labelGlobal: "MIYAZAKI_LABEL_OVERRIDES",
    speechFile: "data/miyazaki/speech-readings.js",
    speechGlobal: "MIYAZAKI_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/kagoshima.js",
    datasetGlobal: "KAGOSHIMA_MUNICIPALITIES",
    labelFile: "data/kagoshima/label-overrides.js",
    labelGlobal: "KAGOSHIMA_LABEL_OVERRIDES",
    speechFile: "data/kagoshima/speech-readings.js",
    speechGlobal: "KAGOSHIMA_SPEECH_READINGS"
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

const rawFeatures = datasets.flatMap((dataset) => dataset.features);
const { features, rawCount, simplifiedCount } = await simplifyAllFeatures(rawFeatures);

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: {
    id: "kyushu_all",
    name: "九州全域",
    code: "kyushu"
  },
  generatedAt: new Date().toISOString(),
  municipalities: datasets.flatMap((dataset) => dataset.municipalities),
  features
};

await mkdir("data/prefectures", { recursive: true });
await mkdir("data/kyushu-all", { recursive: true });

await writeFile("data/prefectures/kyushu-all.js", `window.KYUSHU_ALL_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
await writeFile("data/kyushu-all/label-overrides.js", `window.KYUSHU_ALL_LABEL_OVERRIDES = ${JSON.stringify(labelOverrides, null, 2)};\n`, "utf8");
await writeFile("data/kyushu-all/speech-readings.js", `window.KYUSHU_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadings, null, 2)};\n`, "utf8");

console.log(`wrote data/prefectures/kyushu-all.js (${payload.features.length} drawable features, ${payload.municipalities.length} quiz answers, vertices ${rawCount} -> ${simplifiedCount})`);
