import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { simplifyAllFeatures } from "./lib/simplify-all-dataset.mjs";

const DATASET_SOURCES = [
  {
    datasetFile: "data/prefectures/tokyo-all.js",
    datasetGlobal: "TOKYO_ALL_MUNICIPALITIES",
    labelFile: "data/tokyo-all/label-overrides.js",
    labelGlobal: "TOKYO_ALL_LABEL_OVERRIDES",
    speechFile: "data/tokyo-all/speech-readings.js",
    speechGlobal: "TOKYO_ALL_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/saitama.js",
    datasetGlobal: "SAITAMA_MUNICIPALITIES",
    labelFile: "data/saitama/label-overrides.js",
    labelGlobal: "SAITAMA_LABEL_OVERRIDES",
    speechFile: "data/saitama/speech-readings.js",
    speechGlobal: "SAITAMA_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/chiba.js",
    datasetGlobal: "CHIBA_MUNICIPALITIES",
    labelFile: "data/chiba/label-overrides.js",
    labelGlobal: "CHIBA_LABEL_OVERRIDES",
    speechFile: "data/chiba/speech-readings.js",
    speechGlobal: "CHIBA_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/kanagawa.js",
    datasetGlobal: "KANAGAWA_MUNICIPALITIES",
    labelFile: "data/kanagawa/label-overrides.js",
    labelGlobal: "KANAGAWA_LABEL_OVERRIDES",
    speechFile: "data/kanagawa/speech-readings.js",
    speechGlobal: "KANAGAWA_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/ibaraki.js",
    datasetGlobal: "IBARAKI_MUNICIPALITIES",
    labelFile: "data/ibaraki/label-overrides.js",
    labelGlobal: "IBARAKI_LABEL_OVERRIDES",
    speechFile: "data/ibaraki/speech-readings.js",
    speechGlobal: "IBARAKI_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/gunma.js",
    datasetGlobal: "GUNMA_MUNICIPALITIES",
    labelFile: "data/gunma/label-overrides.js",
    labelGlobal: "GUNMA_LABEL_OVERRIDES",
    speechFile: "data/gunma/speech-readings.js",
    speechGlobal: "GUNMA_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/tochigi.js",
    datasetGlobal: "TOCHIGI_MUNICIPALITIES",
    labelFile: "data/tochigi/label-overrides.js",
    labelGlobal: "TOCHIGI_LABEL_OVERRIDES",
    speechFile: "data/tochigi/speech-readings.js",
    speechGlobal: "TOCHIGI_SPEECH_READINGS"
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

const kantoAllPayload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: {
    id: "kanto_all",
    name: "関東全域",
    code: "kanto"
  },
  generatedAt: new Date().toISOString(),
  municipalities: datasets.flatMap((dataset) => dataset.municipalities),
  features
};

await mkdir("data/prefectures", { recursive: true });
await mkdir("data/kanto-all", { recursive: true });

await writeFile(
  "data/prefectures/kanto-all.js",
  `window.KANTO_ALL_MUNICIPALITIES = ${JSON.stringify(kantoAllPayload)};\n`,
  "utf8"
);

await writeFile(
  "data/kanto-all/label-overrides.js",
  `window.KANTO_ALL_LABEL_OVERRIDES = ${JSON.stringify(labelOverrides, null, 2)};\n`,
  "utf8"
);

await writeFile(
  "data/kanto-all/speech-readings.js",
  `window.KANTO_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadings, null, 2)};\n`,
  "utf8"
);

console.log(
  `wrote data/prefectures/kanto-all.js (${kantoAllPayload.features.length} drawable features, ${kantoAllPayload.municipalities.length} quiz answers, vertices ${rawCount} -> ${simplifiedCount})`
);
