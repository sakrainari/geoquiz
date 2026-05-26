import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/tochigi.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const admins = [
  { id: "tochigi_utsunomiya", name: "宇都宮市", code: "09201", area_code: "028", ma_name: "宇都宮MA", region: "県央", tags: ["県庁所在地", "028", "県央"] },
  { id: "tochigi_ashikaga", name: "足利市", code: "09202", area_code: "0284", ma_name: "足利MA", region: "県南", tags: ["0284", "県南"] },
  { id: "tochigi_tochigi", name: "栃木市", code: "09203", area_code: "0282", ma_name: "栃木MA", region: "県南", tags: ["0282", "県南"] },
  { id: "tochigi_sano", name: "佐野市", code: "09204", area_code: "0283", ma_name: "佐野MA", region: "県南", tags: ["0283", "県南"] },
  { id: "tochigi_kanuma", name: "鹿沼市", code: "09205", area_code: "0289", ma_name: "鹿沼MA", region: "県央", tags: ["0289", "県央"] },
  { id: "tochigi_nikko", name: "日光市", code: "09206", area_code: "0288", ma_name: "今市MA", region: "県西", tags: ["0288", "観光地", "県西"] },
  { id: "tochigi_oyama", name: "小山市", code: "09208", area_code: "0285", ma_name: "小山MA", region: "県南", tags: ["0285", "県南"] },
  { id: "tochigi_moka", name: "真岡市", code: "09209", area_code: "0285", ma_name: "真岡MA", region: "県東", tags: ["0285", "県東"] },
  { id: "tochigi_otawara", name: "大田原市", code: "09210", area_code: "0287", ma_name: "大田原MA", region: "県北", tags: ["0287", "県北"] },
  { id: "tochigi_yaita", name: "矢板市", code: "09211", area_code: "0287", ma_name: "氏家MA", region: "県北", tags: ["0287", "県北"] },
  { id: "tochigi_nasushiobara", name: "那須塩原市", code: "09213", area_code: "0287", ma_name: "黒磯MA", region: "県北", tags: ["0287", "県北"] },
  { id: "tochigi_sakura", name: "さくら市", code: "09214", area_code: "028", ma_name: "氏家MA", region: "県北", tags: ["028", "県北"] },
  { id: "tochigi_nasukarasuyama", name: "那須烏山市", code: "09215", area_code: "0287", ma_name: "烏山MA", region: "県東", tags: ["0287", "県東"] },
  { id: "tochigi_shimotsuke", name: "下野市", code: "09216", area_code: "0285", ma_name: "石橋MA", region: "県南", tags: ["0285", "県南"] },
  { id: "tochigi_kaminokawa", name: "上三川町", code: "09301", area_code: "0285", ma_name: "石橋MA", region: "県央", tags: ["0285", "県央"] },
  { id: "tochigi_mashiko", name: "益子町", code: "09342", area_code: "0285", ma_name: "真岡MA", region: "県東", tags: ["0285", "陶芸", "県東"] },
  { id: "tochigi_motegi", name: "茂木町", code: "09343", area_code: "0285", ma_name: "真岡MA", region: "県東", tags: ["0285", "県東"] },
  { id: "tochigi_ichikai", name: "市貝町", code: "09344", area_code: "0285", ma_name: "真岡MA", region: "県東", tags: ["0285", "県東"] },
  { id: "tochigi_haga", name: "芳賀町", code: "09345", area_code: "028", ma_name: "宇都宮MA", region: "県東", tags: ["028", "県東"] },
  { id: "tochigi_mibu", name: "壬生町", code: "09361", area_code: "0282", ma_name: "栃木MA", region: "県南", tags: ["0282", "県南"] },
  { id: "tochigi_nogi", name: "野木町", code: "09364", area_code: "0280", ma_name: "古河MA", region: "県南", tags: ["0280", "県境", "県南"] },
  { id: "tochigi_shioya", name: "塩谷町", code: "09384", area_code: "0287", ma_name: "氏家MA", region: "県北", tags: ["0287", "県北"] },
  { id: "tochigi_takanezawa", name: "高根沢町", code: "09386", area_code: "028", ma_name: "宇都宮MA", region: "県北", tags: ["028", "県北"] },
  { id: "tochigi_nasu", name: "那須町", code: "09407", area_code: "0287", ma_name: "黒磯MA", region: "県北", tags: ["0287", "那須高原", "県北"] },
  { id: "tochigi_nakagawa", name: "那珂川町", code: "09411", area_code: "0287", ma_name: "烏山MA", region: "県東", tags: ["0287", "県東"] }
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
  const res = await fetch(`${SOURCE}/09/${code}.json`);
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
    id: "tochigi",
    name: "栃木県",
    code: "09"
  },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.TOCHIGI_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");

console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
