import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/tokushima.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
tokushima_tokushima|徳島市|36201|088|徳島MA|東部|県庁所在地,088
tokushima_naruto|鳴門市|36202|088|徳島MA|東部|088,鳴門海峡
tokushima_komatsushima|小松島市|36203|0885|小松島MA|東部|0885
tokushima_anan|阿南市|36204|0884|阿南MA|南部|0884
tokushima_yoshinogawa|吉野川市|36205|0883|鴨島MA|西部|0883
tokushima_awa|阿波市|36206|0883|阿波MA|西部|0883
tokushima_mima|美馬市|36207|0883|脇町MA|西部|0883
tokushima_miyoshi|三好市|36208|0883|池田MA|西部|0883
tokushima_katsuura|勝浦町|36301|0885|小松島MA|東部|0885
tokushima_kamikatsu|上勝町|36302|0885|小松島MA|東部|0885
tokushima_sanagochi|佐那河内村|36321|088|徳島MA|東部|088,村
tokushima_ishii|石井町|36341|088|徳島MA|東部|088
tokushima_kamiyama|神山町|36342|088|徳島MA|東部|088
tokushima_naka|那賀町|36368|0884|阿南MA|南部|0884
tokushima_mugi|牟岐町|36383|0884|牟岐MA|南部|0884
tokushima_minami|美波町|36387|0884|牟岐MA|南部|0884
tokushima_kaiyo|海陽町|36388|0884|牟岐MA|南部|0884
tokushima_matsushige|松茂町|36401|088|徳島MA|東部|088
tokushima_kitajima|北島町|36402|088|徳島MA|東部|088
tokushima_aizumi|藍住町|36403|088|徳島MA|東部|088
tokushima_itano|板野町|36404|088|徳島MA|東部|088
tokushima_kamiita|上板町|36405|088|徳島MA|西部|088
tokushima_tsurugi|つるぎ町|36468|0883|貞光MA|西部|0883
tokushima_higashimiyoshi|東みよし町|36489|0883|池田MA|西部|0883
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
  const res = await fetch(`${SOURCE}/36/${code}.json`);
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
  interval: "45m",
  weighting: 0.78,
  minIslandArea: "2500m2",
  minSliverArea: "3000m2",
  sliverControl: 0.88
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "tokushima", name: "徳島県", code: "36" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.TOKUSHIMA_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
