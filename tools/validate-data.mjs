import { readFile } from "node:fs/promises";

const REQUIRED_DATASET_KEYS = ["type", "prefecture", "municipalities", "features"];
const REQUIRED_MUNICIPALITY_KEYS = ["id", "name", "area_code", "ma_name", "region", "tags"];
const REQUIRED_FEATURE_KEYS = ["id", "name", "area_code", "ma_name", "labelPoint", "labelAngle", "labelSize"];

async function loadWindowAssignment(path, globalName) {
  const source = await readFile(path, "utf8");
  const prefix = `window.${globalName} = `;
  if (!source.startsWith(prefix)) {
    throw new Error(`${path}: expected ${prefix}`);
  }
  return JSON.parse(source.slice(prefix.length).replace(/;\s*$/, ""));
}

function assertKeys(target, keys, label) {
  const missing = keys.filter((key) => !(key in target));
  if (missing.length) {
    throw new Error(`${label}: missing ${missing.join(", ")}`);
  }
}

function validateDataset(dataset) {
  assertKeys(dataset, REQUIRED_DATASET_KEYS, "dataset");
  if (dataset.type !== "FeatureCollection") {
    throw new Error(`dataset: expected FeatureCollection, got ${dataset.type}`);
  }
  if (!Array.isArray(dataset.municipalities) || !dataset.municipalities.length) {
    throw new Error("dataset: municipalities must be a non-empty array");
  }
  if (!Array.isArray(dataset.features) || !dataset.features.length) {
    throw new Error("dataset: features must be a non-empty array");
  }

  const municipalityIds = new Set();
  dataset.municipalities.forEach((item, index) => {
    assertKeys(item, REQUIRED_MUNICIPALITY_KEYS, `municipalities[${index}]`);
    if (municipalityIds.has(item.id)) {
      throw new Error(`municipalities[${index}]: duplicate id ${item.id}`);
    }
    municipalityIds.add(item.id);
  });

  dataset.features.forEach((feature, index) => {
    if (feature.type !== "Feature") {
      throw new Error(`features[${index}]: expected Feature`);
    }
    assertKeys(feature.properties || {}, REQUIRED_FEATURE_KEYS, `features[${index}].properties`);
    if (!municipalityIds.has(feature.properties.id)) {
      throw new Error(`features[${index}]: unknown municipality id ${feature.properties.id}`);
    }
    if (!Array.isArray(feature.properties.labelPoint) || feature.properties.labelPoint.length !== 2) {
      throw new Error(`features[${index}]: labelPoint must be [lat, lng]`);
    }
    if (!feature.geometry || !["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
      throw new Error(`features[${index}]: geometry must be Polygon or MultiPolygon`);
    }
  });

  return {
    prefecture: dataset.prefecture.name,
    municipalities: dataset.municipalities.length,
    features: dataset.features.length,
    areaCodes: new Set(dataset.municipalities.map((item) => item.area_code)).size,
    maNames: new Set(dataset.municipalities.map((item) => item.ma_name)).size
  };
}

const dataset = await loadWindowAssignment("data/prefectures/saitama.js", "SAITAMA_MUNICIPALITIES");
const result = validateDataset(dataset);
console.log(JSON.stringify(result, null, 2));
