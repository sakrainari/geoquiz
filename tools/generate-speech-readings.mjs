/**
 * TSVファイルから各都道府県の speech-readings.js を一括生成する。
 *
 * 使い方:
 *   node tools/generate-speech-readings.mjs --tsv="path/to/readings.tsv"
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const tsvArg = args.find(a => a.startsWith("--tsv="));
if (!tsvArg) {
  console.error("Usage: node tools/generate-speech-readings.mjs --tsv=path/to/readings.tsv");
  process.exit(1);
}
const tsvPath = path.resolve(tsvArg.replace("--tsv=", ""));

// ── TSV 読み込み ──────────────────────────────────────────
const tsv = await readFile(tsvPath, "utf8");
const lines = tsv.split(/\r?\n/).filter(l => l.trim());

// { 都道府県: { 自治体名: よみがな } }
const prefMap = new Map();
for (const line of lines.slice(1)) { // ヘッダをスキップ
  const [pref, name, reading] = line.split("\t");
  if (!pref || !name || !reading) continue;
  if (!prefMap.has(pref)) prefMap.set(pref, new Map());
  prefMap.get(pref).set(name, reading);
}
console.log(`TSV: ${prefMap.size} 都道府県, ${[...prefMap.values()].reduce((s,m)=>s+m.size,0)} 件`);

// ── データセット定義（id → 都道府県名） ───────────────────
// catalog.js を評価して dataGlobal を取得
const catalogSrc = await readFile("data/catalog.js", "utf8");
const window = {};
eval(catalogSrc);
const catalog = window.GEOQUIZ_DATASETS;

// 都道府県名マッピング（データセットid → 都道府県名）
const PREF_MAP = {
  tokyo        : "東京都",
  tokyo_all    : "東京都",
  tokyo_islands: "東京都",
  saitama      : "埼玉県",
  chiba        : "千葉県",
  kanagawa     : "神奈川県",
  ibaraki      : "茨城県",
  gunma        : "群馬県",
  tochigi      : "栃木県",
  kagawa       : "香川県",
  tokushima    : "徳島県",
  ehime        : "愛媛県",
  kochi        : "高知県",
  tottori      : "鳥取県",
  shimane      : "島根県",
  okayama      : "岡山県",
  hiroshima    : "広島県",
  yamaguchi    : "山口県",
  fukuoka      : "福岡県",
  saga         : "佐賀県",
  nagasaki     : "長崎県",
  kumamoto     : "熊本県",
  oita         : "大分県",
  miyazaki     : "宮崎県",
  kagoshima    : "鹿児島県",
  hokkaido_doo   : "北海道",
  hokkaido_donan : "北海道",
  hokkaido_dohoku: "北海道",
  hokkaido_doto  : "北海道",
  hokkaido_all   : "北海道",
  // 広域データセット（複数県）
  kanto_all   : ["東京都","神奈川県","埼玉県","千葉県","茨城県","群馬県","栃木県"],
  shikoku_all : ["香川県","徳島県","愛媛県","高知県"],
  chugoku_all : ["鳥取県","島根県","岡山県","広島県","山口県"],
  kyushu_all  : ["福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県"],
};

// globalName → よみがな Map を生成するヘルパー
function buildReadingsMap(prefNames, municipalityNames) {
  const prefs = Array.isArray(prefNames) ? prefNames : [prefNames];
  const result = {};
  for (const name of municipalityNames) {
    for (const pref of prefs) {
      const reading = prefMap.get(pref)?.get(name);
      if (reading) { result[name] = reading; break; }
    }
  }
  return result;
}

// ── 各データセットを処理 ──────────────────────────────────
let updated = 0;
for (const ds of catalog) {
  const prefNames = PREF_MAP[ds.id];
  if (!prefNames) continue; // special カテゴリ等はスキップ
  if (!ds.speechReadingsGlobal) continue;

  // データファイルを読み込んで自治体名一覧を取得
  const dataFile = "data/prefectures/" + ds.id.replace(/_/g, "-") + ".js";
  let dataSrc;
  try {
    dataSrc = await readFile(dataFile, "utf8");
  } catch {
    console.log(`  SKIP (no data file): ${ds.id}`);
    continue;
  }
  const w2 = {};
  eval(dataSrc.replace(/^window\./, "w2."));
  const data = w2[ds.dataGlobal] || Object.values(w2)[0];
  if (!data?.features) { console.log(`  SKIP (no features): ${ds.id}`); continue; }

  const names = [...new Set(data.features.map(f => f.properties.name))];
  const readings = buildReadingsMap(prefNames, names);

  // 出力ディレクトリ（data/{ds.id の _ を - に変換}/ または data/{ds.id}/）
  // 既存のパスに合わせる: speechReadingsGlobal から逆算
  const dirId = ds.id.replace(/_/g, "-");
  const outDir = path.join("data", dirId);
  await mkdir(outDir, { recursive: true });

  const outPath = path.join(outDir, "speech-readings.js");
  const entries = Object.entries(readings)
    .sort((a, b) => a[0].localeCompare(b[0], "ja"))
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`)
    .join(",\n");
  const content = `window.${ds.speechReadingsGlobal} = {\n${entries}\n};\n`;

  await writeFile(outPath, content, "utf8");

  const missing = names.filter(n => !readings[n]);
  console.log(`✅ ${ds.name.padEnd(16)} ${Object.keys(readings).length}/${names.length} 件` +
    (missing.length ? `  ⚠️ 未収録: ${missing.join(" ")}` : ""));
  updated++;
}

console.log(`\n完了: ${updated} ファイルを生成しました。`);
