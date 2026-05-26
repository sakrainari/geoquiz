/**
 * 既存の data/prefectures/*.js に maFeatures / maBroadFeatures を事前計算して埋め込む。
 * 実行時の turf.union() を完全になくすためのビルドステップ。
 * Usage: node tools/precompute-ma-features.mjs [--only=kanto-all,kyushu-all,...]
 */
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import vm from "node:vm";

const execFile = promisify(execFileCallback);
const mapshaperBin = path.resolve("node_modules", "mapshaper", "bin", "mapshaper");

// ma-union.js と同じロジック（Node 側で再実装）
function broadAreaCode(code) {
  const str = String(code || "");
  if (str.startsWith("049")) return "049";
  if (str.startsWith("048")) return "048";
  if (str.startsWith("04")) return "04";
  return str;
}

function geometryPoints(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return geometry.coordinates.flat();
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
  return [];
}

function geometryScore(geometry) {
  const pts = geometryPoints(geometry);
  if (!pts.length) return 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return Math.max((maxX - minX) * (maxY - minY), 0.000001);
}

function preferredLabelPoint(features) {
  const candidates = features
    .map((f) => ({ point: f.properties.labelPoint, score: geometryScore(f.geometry) }))
    .filter((c) => Array.isArray(c.point) && c.point.length === 2)
    .sort((a, b) => b.score - a.score);
  if (!candidates.length) return null;
  const picked = candidates.slice(0, Math.min(4, candidates.length));
  const total = picked.reduce((s, c) => s + Math.max(c.score, 0.000001), 0);
  const lat = picked.reduce((s, c) => s + c.point[0] * Math.max(c.score, 0.000001), 0) / total;
  const lng = picked.reduce((s, c) => s + c.point[1] * Math.max(c.score, 0.000001), 0) / total;
  return [+lat.toFixed(6), +lng.toFixed(6)];
}

async function dissolveFeaturesByKey(features, keyFn) {
  // keyFn(feature) → group key string
  const groups = new Map();
  for (const f of features) {
    const key = keyFn(f);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }

  // mapshaper dissolve で union
  const tempDir = await mkdtemp(path.join(tmpdir(), "geoquiz-dissolve-"));
  const inputPath = path.join(tempDir, "input.geojson");
  const outputPath = path.join(tempDir, "output.geojson");

  const fc = {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      properties: { _key: keyFn(f) },
      geometry: f.geometry
    }))
  };

  try {
    await writeFile(inputPath, JSON.stringify(fc), "utf8");
    await execFile(
      process.execPath,
      [
        mapshaperBin,
        inputPath,
        "-dissolve", "_key",
        "-filter-islands", "min-area=25000m2", "remove-empty",
        "-o", "format=geojson", outputPath
      ],
      { cwd: process.cwd(), maxBuffer: 1024 * 1024 * 50 }
    );
    const dissolved = JSON.parse(await readFile(outputPath, "utf8"));

    return dissolved.features.map((df) => {
      const key = df.properties._key;
      const memberFeatures = groups.get(key) || [];
      const first = memberFeatures[0];
      return {
        type: "Feature",
        properties: {
          area_code: first.properties.area_code,
          ma_name: first.properties.ma_name,
          memberIds: memberFeatures.map((f) => f.properties.id),
          labelPoint: preferredLabelPoint(memberFeatures)
        },
        geometry: df.geometry
      };
    });
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function loadDataset(filePath) {
  const source = await readFile(filePath, "utf8");
  const match = source.match(/^window\.([A-Z0-9_]+)\s*=/);
  if (!match) throw new Error(`No global assignment found in ${filePath}`);
  const globalName = match[1];
  const context = { window: {} };
  vm.createContext(context);
  new vm.Script(source, { filename: filePath }).runInContext(context);
  const dataset = context.window[globalName];
  if (!dataset) throw new Error(`Missing ${globalName} in ${filePath}`);
  return { dataset, globalName };
}

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith("--only="));
const only = onlyArg ? new Set(onlyArg.slice("--only=".length).split(",")) : null;

const dir = "data/prefectures";
const files = (await readdir(dir)).filter((f) => f.endsWith(".js")).sort();

for (const file of files) {
  const name = file.replace(".js", "");
  if (only && !only.has(name)) continue;

  const filePath = `${dir}/${file}`;
  const { dataset, globalName } = await loadDataset(filePath);

  process.stdout.write(`${file}: computing maFeatures...`);
  const maFeatures = await dissolveFeaturesByKey(
    dataset.features,
    (f) => f.properties.area_code
  );

  process.stdout.write(` ${maFeatures.length} MAs`);

  // broad_area_code がある場合のみ maBroadFeatures を生成
  const broadCodes = new Set(dataset.features.map((f) => broadAreaCode(f.properties.area_code)));
  let maBroadFeatures = null;
  if (broadCodes.size < new Set(dataset.features.map((f) => f.properties.area_code)).size) {
    maBroadFeatures = await dissolveFeaturesByKey(
      dataset.features,
      (f) => broadAreaCode(f.properties.area_code)
    );
    process.stdout.write(` / ${maBroadFeatures.size ?? maBroadFeatures.length} broad MAs`);
  }

  const updated = {
    ...dataset,
    generatedAt: new Date().toISOString(),
    maFeatures,
    ...(maBroadFeatures ? { maBroadFeatures } : {})
  };

  await writeFile(filePath, `window.${globalName} = ${JSON.stringify(updated)};\n`, "utf8");
  console.log(" -> done");
}

console.log("\nall done");
