import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const targets = process.argv.slice(2);

function loadWindowGlobal(path) {
  const source = readFileSync(path, "utf8");
  const fakeWindow = {};
  new Function("window", source)(fakeWindow);
  return fakeWindow;
}

function toHyphen(id) {
  return id.replace(/_/g, "-");
}

function datasetPath(id) {
  const hyphen = toHyphen(id);
  const candidates = [
    resolve(ROOT, "data", "prefectures", `${hyphen}.js`),
    resolve(ROOT, "data", "prefectures", `${id}.js`)
  ];
  return candidates.find((item) => existsSync(item));
}

function speechPath(id) {
  const hyphen = toHyphen(id);
  return resolve(ROOT, "data", hyphen, "speech-readings.js");
}

const catalog = loadWindowGlobal(resolve(ROOT, "data", "catalog.js")).GEOQUIZ_DATASETS || [];
const rows = [];
let hasMissing = false;

for (const config of catalog) {
  if (targets.length && !targets.includes(config.id)) continue;
  if (!config.speechReadingsGlobal) continue;

  const dataFile = datasetPath(config.id);
  const speechFile = speechPath(config.id);
  if (!dataFile || !existsSync(speechFile)) continue;

  const dataset = loadWindowGlobal(dataFile)[config.dataGlobal];
  const speech = loadWindowGlobal(speechFile)[config.speechReadingsGlobal] || {};
  const municipalities = dataset && Array.isArray(dataset.municipalities) ? dataset.municipalities : [];
  const missing = municipalities.filter((item) => !speech[item.id] && !speech[item.name]);
  if (missing.length) hasMissing = true;
  rows.push({
    id: config.id,
    total: municipalities.length,
    readings: Object.keys(speech).length,
    missing: missing.length,
    examples: missing.slice(0, 8).map((item) => item.id)
  });
}

for (const row of rows) {
  const status = row.missing ? "NG" : "OK";
  console.log(`${status} ${row.id}: ${row.readings}/${row.total} readings, missing ${row.missing}`);
  if (row.examples.length) console.log(`   examples: ${row.examples.join(", ")}`);
}

if (hasMissing) process.exit(1);
