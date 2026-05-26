import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { simplifyAllFeatures } from "./lib/simplify-all-dataset.mjs";

const DATASET_SOURCES = [
  {
    datasetFile: "data/prefectures/hokkaido-doo.js",
    datasetGlobal: "HOKKAIDO_DOO_MUNICIPALITIES",
    labelFile: "data/hokkaido-doo/label-overrides.js",
    labelGlobal: "HOKKAIDO_DOO_LABEL_OVERRIDES",
    speechFile: "data/hokkaido-doo/speech-readings.js",
    speechGlobal: "HOKKAIDO_DOO_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/hokkaido-donan.js",
    datasetGlobal: "HOKKAIDO_DONAN_MUNICIPALITIES",
    labelFile: "data/hokkaido-donan/label-overrides.js",
    labelGlobal: "HOKKAIDO_DONAN_LABEL_OVERRIDES",
    speechFile: "data/hokkaido-donan/speech-readings.js",
    speechGlobal: "HOKKAIDO_DONAN_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/hokkaido-dohoku.js",
    datasetGlobal: "HOKKAIDO_DOHOKU_MUNICIPALITIES",
    labelFile: "data/hokkaido-dohoku/label-overrides.js",
    labelGlobal: "HOKKAIDO_DOHOKU_LABEL_OVERRIDES",
    speechFile: "data/hokkaido-dohoku/speech-readings.js",
    speechGlobal: "HOKKAIDO_DOHOKU_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/hokkaido-doto.js",
    datasetGlobal: "HOKKAIDO_DOTO_MUNICIPALITIES",
    labelFile: "data/hokkaido-doto/label-overrides.js",
    labelGlobal: "HOKKAIDO_DOTO_LABEL_OVERRIDES",
    speechFile: "data/hokkaido-doto/speech-readings.js",
    speechGlobal: "HOKKAIDO_DOTO_SPEECH_READINGS"
  }
];

async function loadWindowGlobal(filePath, globalName) {
  const source = await readFile(filePath, "utf8");
  const context = { window: {} };
  vm.createContext(context);
  new vm.Script(source, { filename: filePath }).runInContext(context);
  const value = context.window[globalName];
  if (!value) {
    throw new Error(`Missing ${globalName} in ${filePath}`);
  }
  return value;
}

const datasets = [];
const labelOverrides = {
  municipalities: {},
  areaCodes: {}
};
const speechReadings = {};

for (const source of DATASET_SOURCES) {
  datasets.push(await loadWindowGlobal(source.datasetFile, source.datasetGlobal));

  const overrides = await loadWindowGlobal(source.labelFile, source.labelGlobal);
  if (overrides.municipalities) Object.assign(labelOverrides.municipalities, overrides.municipalities);
  if (overrides.areaCodes) Object.assign(labelOverrides.areaCodes, overrides.areaCodes);

  Object.assign(speechReadings, await loadWindowGlobal(source.speechFile, source.speechGlobal));
}

const { features, rawCount, simplifiedCount } = await simplifyAllFeatures(datasets.flatMap((dataset) => dataset.features));

const hokkaidoAllPayload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: {
    id: "hokkaido_all",
    name: "北海道全域",
    code: "01"
  },
  generatedAt: new Date().toISOString(),
  municipalities: datasets.flatMap((dataset) => dataset.municipalities),
  features
};

await mkdir("data/prefectures", { recursive: true });
await mkdir("data/hokkaido-all", { recursive: true });

await writeFile(
  "data/prefectures/hokkaido-all.js",
  `window.HOKKAIDO_ALL_MUNICIPALITIES = ${JSON.stringify(hokkaidoAllPayload)};\n`,
  "utf8"
);

await writeFile(
  "data/hokkaido-all/label-overrides.js",
  `window.HOKKAIDO_ALL_LABEL_OVERRIDES = ${JSON.stringify(labelOverrides, null, 2)};\n`,
  "utf8"
);

await writeFile(
  "data/hokkaido-all/speech-readings.js",
  `window.HOKKAIDO_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadings, null, 2)};\n`,
  "utf8"
);

console.log(
  `wrote data/prefectures/hokkaido-all.js (${hokkaidoAllPayload.features.length} drawable features, ${hokkaidoAllPayload.municipalities.length} quiz answers, vertices ${rawCount} -> ${simplifiedCount})`
);
