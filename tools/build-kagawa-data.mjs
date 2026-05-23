import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/kagawa.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
kagawa_takamatsu|高松市|37201|087|高松MA|高松|県庁所在地,087,瀬戸内,島
kagawa_marugame|丸亀市|37202|0877|丸亀MA|中讃|0877,中讃
kagawa_sakaide|坂出市|37203|0877|丸亀MA|中讃|0877,中讃
kagawa_zentsuji|善通寺市|37204|0877|丸亀MA|中讃|0877,中讃
kagawa_kanonji|観音寺市|37205|0875|観音寺MA|西讃|0875,西讃
kagawa_sanuki|さぬき市|37206|087|高松MA|東讃|087,東讃
kagawa_higashikagawa|東かがわ市|37207|0879|三本松MA|東讃|0879,東讃
kagawa_mitoyo|三豊市|37208|0875|観音寺MA|西讃|0875,西讃
kagawa_tonosho|土庄町|37322|0879|土庄MA|小豆|0879,島
kagawa_shodoshima|小豆島町|37324|0879|土庄MA|小豆|0879,島
kagawa_miki|三木町|37341|087|高松MA|高松|087
kagawa_naoshima|直島町|37364|087|高松MA|高松|087,島
kagawa_utazu|宇多津町|37386|0877|丸亀MA|中讃|0877,中讃
kagawa_ayagawa|綾川町|37387|087|高松MA|高松|087
kagawa_kotohira|琴平町|37403|0877|丸亀MA|中讃|0877,こんぴら
kagawa_tadotsu|多度津町|37404|0877|丸亀MA|中讃|0877,中讃
kagawa_manno|まんのう町|37406|0877|丸亀MA|中讃|0877,満濃池
`.trim().split("\n");

const admins = ADMIN_LINES.map((line) => {
  const [id, name, codeField, area_code, ma_name, region, tagsField] = line.split("|");
  const codes = codeField.includes(",") ? codeField.split(",") : [codeField];
  return {
    id,
    name,
    ...(codes.length > 1 ? { codes } : { code: codes[0] }),
    area_code,
    ma_name,
    region,
    tags: tagsField.split(",")
  };
});

function collectCoords(geometry, out = []) {
  if (!geometry) return out;
  if (geometry.type === "Polygon") geometry.coordinates.flat(1).forEach(([lng, lat]) => out.push([lng, lat]));
  if (geometry.type === "MultiPolygon") geometry.coordinates.flat(2).forEach(([lng, lat]) => out.push([lng, lat]));
  return out;
}

function labelPoint(geometry) {
  const coords = collectCoords(geometry);
  const lngs = coords.map((coord) => coord[0]);
  const lats = coords.map((coord) => coord[1]);
  return [
    +(lats.reduce((sum, value) => sum + value, 0) / lats.length).toFixed(6),
    +(lngs.reduce((sum, value) => sum + value, 0) / lngs.length).toFixed(6)
  ];
}

function labelSize(name) {
  if (name.length >= 6) return 7.8;
  if (name.length >= 5) return 8.2;
  if (name.length >= 4) return 8.9;
  return 9.5;
}

async function fetchAdmin(code) {
  const res = await fetch(`${SOURCE}/37/${code}.json`);
  if (!res.ok) throw new Error(`${code}: ${res.status} ${res.statusText}`);
  return res.json();
}

const features = [];

for (const admin of admins) {
  const codes = admin.codes ?? [admin.code];
  for (const code of codes) {
    const collection = await fetchAdmin(code);
    for (const feature of collection.features) {
      const geometry = feature.geometry;
      const props = {
        ...admin,
        sourceCode: code,
        labelPoint: labelPoint(geometry),
        labelAngle: admin.name.length >= 5 ? -18 : -25,
        labelSize: labelSize(admin.name)
      };
      delete props.code;
      delete props.codes;
      features.push({ type: "Feature", properties: props, geometry });
    }
    console.log(`fetched ${code}`);
  }
}

const rawFeatureCollection = { type: "FeatureCollection", features };
const rawVertexCount = countFeatureVertices(rawFeatureCollection);
const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(rawFeatureCollection, {
  interval: "40m",
  weighting: 0.78,
  minIslandArea: "2000m2",
  minSliverArea: "2500m2",
  sliverControl: 0.88
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "kagawa", name: "香川県", code: "37" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.KAGAWA_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
