import { readFile, readdir } from "node:fs/promises";

const DEFAULT_PATH = "data/prefectures/saitama.js";
const DEFAULT_GLOBAL = "SAITAMA_MUNICIPALITIES";
const REQUIRED_DATASET_KEYS = ["type", "prefecture", "municipalities", "features"];
const REQUIRED_MUNICIPALITY_KEYS = ["id", "name", "area_code", "ma_name", "region", "tags"];
const REQUIRED_FEATURE_KEYS = ["id", "name", "area_code", "ma_name", "labelPoint", "labelAngle", "labelSize"];
const REQUIRED_IMAGE_QUESTION_KEYS = ["id", "type", "question", "image", "answerId", "answerName", "tags"];

async function loadWindowAssignment(path, globalName) {
  const source = await readFile(path, "utf8");
  const resolvedGlobalName = globalName || inferGlobalName(source, path);
  const prefix = `window.${resolvedGlobalName} = `;
  if (!source.startsWith(prefix)) {
    throw new Error(`${path}: expected ${prefix}`);
  }
  return JSON.parse(source.slice(prefix.length).replace(/;\s*$/, ""));
}

function inferGlobalName(source, path) {
  const match = source.match(/^window\.([A-Z0-9_]+)\s*=/);
  if (!match) {
    throw new Error(`${path}: expected a window.GLOBAL_NAME assignment`);
  }
  return match[1];
}

function countVertices(features) {
  let count = 0;
  for (const feature of features) {
    const geom = feature.geometry;
    if (!geom) continue;
    const polygons = geom.type === "MultiPolygon" ? geom.coordinates : [geom.coordinates];
    for (const polygon of polygons) {
      for (const ring of polygon) count += ring.length;
    }
  }
  return count;
}

function parseArgs(argv) {
  const options = {
    path: DEFAULT_PATH,
    globalName: DEFAULT_GLOBAL,
    imagePath: null,
    imageGlobalName: null,
    all: false
  };

  argv.forEach((arg) => {
    if (arg.startsWith("--global=")) {
      options.globalName = arg.slice("--global=".length);
    } else if (arg.startsWith("--image=")) {
      options.imagePath = arg.slice("--image=".length);
    } else if (arg.startsWith("--image-global=")) {
      options.imageGlobalName = arg.slice("--image-global=".length);
    } else if (arg === "--infer-global") {
      options.globalName = null;
    } else if (arg === "--all") {
      options.all = true;
    } else if (!arg.startsWith("--")) {
      options.path = arg;
    }
  });

  return options;
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
    vertices: countVertices(dataset.features),
    areaCodes: new Set(dataset.municipalities.map((item) => item.area_code)).size,
    maNames: new Set(dataset.municipalities.map((item) => item.ma_name)).size
  };
}

function validateImageQuestions(items) {
  if (!Array.isArray(items)) {
    throw new Error("image questions must be an array");
  }
  const ids = new Set();
  items.forEach((item, index) => {
    assertKeys(item, REQUIRED_IMAGE_QUESTION_KEYS, `imageQuestions[${index}]`);
    if (ids.has(item.id)) {
      throw new Error(`imageQuestions[${index}]: duplicate id ${item.id}`);
    }
    ids.add(item.id);
    if (!Array.isArray(item.tags)) {
      throw new Error(`imageQuestions[${index}]: tags must be an array`);
    }
  });
  return {
    imageQuestions: items.length,
    enabledImageQuestions: items.filter((item) => item.enabled).length
  };
}

const options = parseArgs(process.argv.slice(2));

if (options.all) {
  const files = (await readdir("data/prefectures")).filter((f) => f.endsWith(".js")).sort();
  const rows = [];
  for (const file of files) {
    const path = `data/prefectures/${file}`;
    try {
      const dataset = await loadWindowAssignment(path, null);
      const result = validateDataset(dataset);
      rows.push({ file, ...result });
    } catch (e) {
      rows.push({ file, error: e.message });
    }
  }
  const nameW = Math.max(8, ...rows.map((r) => (r.file || "").length));
  const prefW = Math.max(10, ...rows.map((r) => (r.prefecture || "").length));
  const header = [
    "file".padEnd(nameW),
    "prefecture".padEnd(prefW),
    "munis".padStart(6),
    "features".padStart(9),
    "vertices".padStart(9),
    "MAs".padStart(5)
  ].join("  ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const row of rows) {
    if (row.error) {
      console.log(`${row.file.padEnd(nameW)}  ERROR: ${row.error}`);
    } else {
      console.log([
        row.file.padEnd(nameW),
        row.prefecture.padEnd(prefW),
        String(row.municipalities).padStart(6),
        String(row.features).padStart(9),
        String(row.vertices).padStart(9),
        String(row.areaCodes).padStart(5)
      ].join("  "));
    }
  }
} else {
  const dataset = await loadWindowAssignment(options.path, options.globalName);
  const result = validateDataset(dataset);
  if (options.imagePath) {
    const imageQuestions = await loadWindowAssignment(options.imagePath, options.imageGlobalName);
    Object.assign(result, validateImageQuestions(imageQuestions));
  }
  console.log(JSON.stringify(result, null, 2));
}
