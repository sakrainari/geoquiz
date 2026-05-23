import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/gunma.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const admins = [
  { id: "gunma_maebashi", name: "前橋市", code: "10201", area_code: "027", ma_name: "前橋MA", region: "中毛", tags: ["県庁所在地", "027", "中毛"] },
  { id: "gunma_takasaki", name: "高崎市", code: "10202", area_code: "027", ma_name: "高崎MA", region: "西毛", tags: ["027", "新幹線", "西毛"] },
  { id: "gunma_kiryu", name: "桐生市", code: "10203", area_code: "0277", ma_name: "桐生MA", region: "東毛", tags: ["0277", "織物", "東毛"] },
  { id: "gunma_isesaki", name: "伊勢崎市", code: "10204", area_code: "0270", ma_name: "伊勢崎MA", region: "東毛", tags: ["0270", "東毛"] },
  { id: "gunma_ota", name: "太田市", code: "10205", area_code: "0276", ma_name: "太田MA", region: "東毛", tags: ["0276", "工業", "東毛"] },
  { id: "gunma_numata", name: "沼田市", code: "10206", area_code: "0278", ma_name: "沼田MA", region: "利根沼田", tags: ["0278", "利根沼田"] },
  { id: "gunma_tatebayashi", name: "館林市", code: "10207", area_code: "0276", ma_name: "太田MA", region: "東毛", tags: ["0276", "東毛"] },
  { id: "gunma_shibukawa", name: "渋川市", code: "10208", area_code: "0279", ma_name: "渋川MA", region: "中毛", tags: ["0279", "伊香保", "中毛"] },
  { id: "gunma_fujioka", name: "藤岡市", code: "10209", area_code: "0274", ma_name: "藤岡MA", region: "西毛", tags: ["0274", "西毛"] },
  { id: "gunma_tomioka", name: "富岡市", code: "10210", area_code: "0274", ma_name: "富岡MA", region: "西毛", tags: ["0274", "製糸場", "西毛"] },
  { id: "gunma_annaka", name: "安中市", code: "10211", area_code: "027", ma_name: "高崎MA", region: "西毛", tags: ["027", "碓氷", "西毛"] },
  { id: "gunma_midori", name: "みどり市", code: "10212", area_code: "0277", ma_name: "桐生MA", region: "東毛", tags: ["0277", "東毛"] },
  { id: "gunma_shinto", name: "榛東村", code: "10344", area_code: "0279", ma_name: "渋川MA", region: "中毛", tags: ["0279", "村", "中毛"] },
  { id: "gunma_yoshioka", name: "吉岡町", code: "10345", area_code: "0279", ma_name: "渋川MA", region: "中毛", tags: ["0279", "中毛"] },
  { id: "gunma_ueno", name: "上野村", code: "10366", area_code: "0274", ma_name: "藤岡MA", region: "西毛", tags: ["0274", "村", "西毛"] },
  { id: "gunma_kanna", name: "神流町", code: "10367", area_code: "0274", ma_name: "藤岡MA", region: "西毛", tags: ["0274", "西毛"] },
  { id: "gunma_shimonita", name: "下仁田町", code: "10382", area_code: "0274", ma_name: "富岡MA", region: "西毛", tags: ["0274", "ねぎ", "西毛"] },
  { id: "gunma_nanmoku", name: "南牧村", code: "10383", area_code: "0274", ma_name: "富岡MA", region: "西毛", tags: ["0274", "村", "西毛"] },
  { id: "gunma_kanra", name: "甘楽町", code: "10384", area_code: "0274", ma_name: "富岡MA", region: "西毛", tags: ["0274", "西毛"] },
  { id: "gunma_nakanojo", name: "中之条町", code: "10421", area_code: "0279", ma_name: "渋川MA", region: "吾妻", tags: ["0279", "四万温泉", "吾妻"] },
  { id: "gunma_naganohara", name: "長野原町", code: "10424", area_code: "0279", ma_name: "長野原MA", region: "吾妻", tags: ["0279", "八ッ場", "吾妻"] },
  { id: "gunma_tsumagoi", name: "嬬恋村", code: "10425", area_code: "0279", ma_name: "長野原MA", region: "吾妻", tags: ["0279", "キャベツ", "吾妻"] },
  { id: "gunma_kusatsu", name: "草津町", code: "10426", area_code: "0279", ma_name: "長野原MA", region: "吾妻", tags: ["0279", "温泉", "吾妻"] },
  { id: "gunma_takayama", name: "高山村", code: "10428", area_code: "0279", ma_name: "渋川MA", region: "吾妻", tags: ["0279", "村", "吾妻"] },
  { id: "gunma_higashiagatsuma", name: "東吾妻町", code: "10429", area_code: "0279", ma_name: "渋川MA", region: "吾妻", tags: ["0279", "吾妻"] },
  { id: "gunma_katashina", name: "片品村", code: "10443", area_code: "0278", ma_name: "沼田MA", region: "利根沼田", tags: ["0278", "尾瀬", "利根沼田"] },
  { id: "gunma_kawaba", name: "川場村", code: "10444", area_code: "0278", ma_name: "沼田MA", region: "利根沼田", tags: ["0278", "村", "利根沼田"] },
  { id: "gunma_showa", name: "昭和村", code: "10448", area_code: "0278", ma_name: "沼田MA", region: "利根沼田", tags: ["0278", "村", "利根沼田"] },
  { id: "gunma_minakami", name: "みなかみ町", code: "10449", area_code: "0278", ma_name: "沼田MA", region: "利根沼田", tags: ["0278", "温泉", "利根沼田"] },
  { id: "gunma_tamamura", name: "玉村町", code: "10464", area_code: "0270", ma_name: "伊勢崎MA", region: "中毛", tags: ["0270", "中毛"] },
  { id: "gunma_itakura", name: "板倉町", code: "10521", area_code: "0276", ma_name: "太田MA", region: "東毛", tags: ["0276", "渡良瀬", "東毛"] },
  { id: "gunma_meiwa", name: "明和町", code: "10522", area_code: "0276", ma_name: "太田MA", region: "東毛", tags: ["0276", "東毛"] },
  { id: "gunma_chiyoda", name: "千代田町", code: "10523", area_code: "0276", ma_name: "太田MA", region: "東毛", tags: ["0276", "東毛"] },
  { id: "gunma_oizumi", name: "大泉町", code: "10524", area_code: "0276", ma_name: "太田MA", region: "東毛", tags: ["0276", "工業", "東毛"] },
  { id: "gunma_ora", name: "邑楽町", code: "10525", area_code: "0276", ma_name: "太田MA", region: "東毛", tags: ["0276", "東毛"] }
];

function collectCoords(geometry) {
  const coords = [];
  const walk = (value) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      coords.push(value);
      return;
    }
    value.forEach(walk);
  };
  walk(geometry.coordinates);
  return coords;
}

function labelPoint(geometry) {
  const coords = collectCoords(geometry);
  if (!coords.length) return null;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / coords.length, sumLat / coords.length];
}

function labelSize(geometry) {
  const coords = collectCoords(geometry);
  if (!coords.length) return 1;
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const span = Math.max(maxLon - minLon, maxLat - minLat);
  if (span > 0.4) return 1.4;
  if (span > 0.25) return 1.25;
  if (span > 0.14) return 1.1;
  return 1;
}

async function fetchAdmin(code) {
  const res = await fetch(`${SOURCE}/10/${code}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${code}: ${res.status}`);
  }
  console.log(`fetched ${code}`);
  return res.json();
}

const features = [];

for (const admin of admins) {
  const { code, ...meta } = admin;
  const collection = await fetchAdmin(code);
  for (const feature of collection.features) {
    const geometry = feature.geometry;
    features.push({
      type: "Feature",
      properties: {
        ...meta,
        sourceCode: code,
        labelPoint: labelPoint(geometry),
        labelAngle: admin.name.length >= 5 ? -18 : -25,
        labelSize: labelSize(geometry)
      },
      geometry
    });
  }
}

const rawFeatureCollection = { type: "FeatureCollection", features };
const rawVertexCount = countFeatureVertices(rawFeatureCollection);
const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(rawFeatureCollection, {
  interval: "35m",
  weighting: 0.75,
  minIslandArea: "1500m2",
  minSliverArea: "1500m2",
  sliverControl: 0.85
});

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);
const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: {
    id: "gunma",
    name: "群馬県",
    code: "10"
  },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.GUNMA_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");

console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
