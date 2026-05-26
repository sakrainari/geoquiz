import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./lib/simplify-with-mapshaper.mjs";

const DATASET_SOURCES = [
  {
    datasetFile: "data/prefectures/hokkaido-all.js",
    datasetGlobal: "HOKKAIDO_ALL_MUNICIPALITIES",
    labelFile: "data/hokkaido-all/label-overrides.js",
    labelGlobal: "HOKKAIDO_ALL_LABEL_OVERRIDES",
    speechFile: "data/hokkaido-all/speech-readings.js",
    speechGlobal: "HOKKAIDO_ALL_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/tohoku-all.js",
    datasetGlobal: "TOHOKU_ALL_MUNICIPALITIES",
    labelFile: "data/tohoku-all/label-overrides.js",
    labelGlobal: "TOHOKU_ALL_LABEL_OVERRIDES",
    speechFile: "data/tohoku-all/speech-readings.js",
    speechGlobal: "TOHOKU_ALL_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/kanto-all.js",
    datasetGlobal: "KANTO_ALL_MUNICIPALITIES",
    labelFile: "data/kanto-all/label-overrides.js",
    labelGlobal: "KANTO_ALL_LABEL_OVERRIDES",
    speechFile: "data/kanto-all/speech-readings.js",
    speechGlobal: "KANTO_ALL_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/chubu-all.js",
    datasetGlobal: "CHUBU_ALL_MUNICIPALITIES",
    labelFile: "data/chubu-all/label-overrides.js",
    labelGlobal: "CHUBU_ALL_LABEL_OVERRIDES",
    speechFile: "data/chubu-all/speech-readings.js",
    speechGlobal: "CHUBU_ALL_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/kinki-all.js",
    datasetGlobal: "KINKI_ALL_MUNICIPALITIES",
    labelFile: "data/kinki-all/label-overrides.js",
    labelGlobal: "KINKI_ALL_LABEL_OVERRIDES",
    speechFile: "data/kinki-all/speech-readings.js",
    speechGlobal: "KINKI_ALL_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/chugoku-all.js",
    datasetGlobal: "CHUGOKU_ALL_MUNICIPALITIES",
    labelFile: "data/chugoku-all/label-overrides.js",
    labelGlobal: "CHUGOKU_ALL_LABEL_OVERRIDES",
    speechFile: "data/chugoku-all/speech-readings.js",
    speechGlobal: "CHUGOKU_ALL_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/shikoku-all.js",
    datasetGlobal: "SHIKOKU_ALL_MUNICIPALITIES",
    labelFile: "data/shikoku-all/label-overrides.js",
    labelGlobal: "SHIKOKU_ALL_LABEL_OVERRIDES",
    speechFile: "data/shikoku-all/speech-readings.js",
    speechGlobal: "SHIKOKU_ALL_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/kyushu-all.js",
    datasetGlobal: "KYUSHU_ALL_MUNICIPALITIES",
    labelFile: "data/kyushu-all/label-overrides.js",
    labelGlobal: "KYUSHU_ALL_LABEL_OVERRIDES",
    speechFile: "data/kyushu-all/speech-readings.js",
    speechGlobal: "KYUSHU_ALL_SPEECH_READINGS"
  },
  {
    datasetFile: "data/prefectures/okinawa.js",
    datasetGlobal: "OKINAWA_MUNICIPALITIES",
    labelFile: "data/okinawa/label-overrides.js",
    labelGlobal: "OKINAWA_LABEL_OVERRIDES",
    speechFile: "data/okinawa/speech-readings.js",
    speechGlobal: "OKINAWA_SPEECH_READINGS"
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

const rawFeatureCollection = {
  type: "FeatureCollection",
  features: datasets.flatMap((dataset) => dataset.features)
};
const rawCount = countFeatureVertices(rawFeatureCollection);
const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(rawFeatureCollection, {
  interval: "800m",
  weighting: 0.78,
  minIslandArea: "250000m2",
  minSliverArea: "300000m2",
  sliverControl: 0.95
});
const simplifiedCount = countFeatureVertices(simplifiedFeatureCollection);

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: {
    id: "japan_all",
    name: "日本全域",
    code: "japan"
  },
  generatedAt: new Date().toISOString(),
  municipalities: datasets.flatMap((dataset) => dataset.municipalities),
  features: simplifiedFeatureCollection.features
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
  `window.JAPAN_ALL_LABEL_OVERRIDES = ${JSON.stringify(labelOverrides, null, 2)};\n`,
  "utf8"
);
await writeFile(
  "data/japan-all/speech-readings.js",
  `window.JAPAN_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadings, null, 2)};\n`,
  "utf8"
);

console.log(`wrote data/prefectures/japan-all.js (${payload.features.length} drawable features, ${payload.municipalities.length} quiz answers, vertices ${rawCount} -> ${simplifiedCount})`);
