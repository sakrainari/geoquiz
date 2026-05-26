import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { simplifyAllFeatures } from "./lib/simplify-all-dataset.mjs";

const DATASET_SOURCES = [
  { datasetFile: "data/prefectures/mie.js", datasetGlobal: "MIE_MUNICIPALITIES", labelFile: "data/mie/label-overrides.js", labelGlobal: "MIE_LABEL_OVERRIDES", speechFile: "data/mie/speech-readings.js", speechGlobal: "MIE_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/shiga.js", datasetGlobal: "SHIGA_MUNICIPALITIES", labelFile: "data/shiga/label-overrides.js", labelGlobal: "SHIGA_LABEL_OVERRIDES", speechFile: "data/shiga/speech-readings.js", speechGlobal: "SHIGA_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/kyoto.js", datasetGlobal: "KYOTO_MUNICIPALITIES", labelFile: "data/kyoto/label-overrides.js", labelGlobal: "KYOTO_LABEL_OVERRIDES", speechFile: "data/kyoto/speech-readings.js", speechGlobal: "KYOTO_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/osaka.js", datasetGlobal: "OSAKA_MUNICIPALITIES", labelFile: "data/osaka/label-overrides.js", labelGlobal: "OSAKA_LABEL_OVERRIDES", speechFile: "data/osaka/speech-readings.js", speechGlobal: "OSAKA_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/hyogo.js", datasetGlobal: "HYOGO_MUNICIPALITIES", labelFile: "data/hyogo/label-overrides.js", labelGlobal: "HYOGO_LABEL_OVERRIDES", speechFile: "data/hyogo/speech-readings.js", speechGlobal: "HYOGO_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/nara.js", datasetGlobal: "NARA_MUNICIPALITIES", labelFile: "data/nara/label-overrides.js", labelGlobal: "NARA_LABEL_OVERRIDES", speechFile: "data/nara/speech-readings.js", speechGlobal: "NARA_SPEECH_READINGS" },
  { datasetFile: "data/prefectures/wakayama.js", datasetGlobal: "WAKAYAMA_MUNICIPALITIES", labelFile: "data/wakayama/label-overrides.js", labelGlobal: "WAKAYAMA_LABEL_OVERRIDES", speechFile: "data/wakayama/speech-readings.js", speechGlobal: "WAKAYAMA_SPEECH_READINGS" }
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
  prefecture: { id: "kinki_all", name: "近畿全域", code: "kinki" },
  generatedAt: new Date().toISOString(),
  municipalities: datasets.flatMap((dataset) => dataset.municipalities),
  features
};

await mkdir("data/prefectures", { recursive: true });
await mkdir("data/kinki-all", { recursive: true });
await writeFile("data/prefectures/kinki-all.js", `window.KINKI_ALL_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
await writeFile("data/kinki-all/label-overrides.js", `window.KINKI_ALL_LABEL_OVERRIDES = ${JSON.stringify(labelOverrides, null, 2)};\n`, "utf8");
await writeFile("data/kinki-all/speech-readings.js", `window.KINKI_ALL_SPEECH_READINGS = ${JSON.stringify(speechReadings, null, 2)};\n`, "utf8");

console.log(`wrote data/prefectures/kinki-all.js (${payload.features.length} drawable features, ${payload.municipalities.length} quiz answers, vertices ${rawCount} -> ${simplifiedCount})`);
