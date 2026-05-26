/**
 * 既存の data/prefectures/*.js を読み込み、頂点数削減のため再 simplify して上書きする。
 * API 再取得不要。*-all.js（広域データ）はスキップ。
 * Usage: node tools/resimplify-prefectures.mjs [--only=ibaraki,saitama,...]
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { simplifyPrefectureFeatures } from "./lib/simplify-all-dataset.mjs";

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
const REGIONAL_ALL = new Set(["kanto-all.js", "kyushu-all.js", "chugoku-all.js", "shikoku-all.js", "hokkaido-all.js"]);

const files = (await readdir(dir))
  .filter((f) => f.endsWith(".js") && !REGIONAL_ALL.has(f))
  .sort();

let processed = 0;
let skipped = 0;

for (const file of files) {
  const name = file.replace(".js", "");
  if (only && !only.has(name)) { skipped++; continue; }

  const filePath = `${dir}/${file}`;
  const { dataset, globalName } = await loadDataset(filePath);

  const { features, rawCount, simplifiedCount } = await simplifyPrefectureFeatures(dataset.features);

  const updated = {
    ...dataset,
    generatedAt: new Date().toISOString(),
    features
  };

  await writeFile(filePath, `window.${globalName} = ${JSON.stringify(updated)};\n`, "utf8");
  console.log(`${file}: ${rawCount} -> ${simplifiedCount} vertices (${dataset.features.length} -> ${features.length} features)`);
  processed++;
}

console.log(`\ndone: ${processed} files processed, ${skipped} skipped`);
