import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/hokkaido-donan.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
hokkaido_donan_hakodate|函館市|01202|0138|函館MA|渡島|0138,港町
hokkaido_donan_hokuto|北斗市|01236|0138|函館MA|渡島|0138
hokkaido_donan_matsumae|松前町|01331|0139|松前MA|渡島|0139,城下町
hokkaido_donan_fukushima|福島町|01332|0139|松前MA|渡島|0139
hokkaido_donan_shiriuchi|知内町|01333|01392|木古内MA|渡島|01392
hokkaido_donan_kikonai|木古内町|01334|01392|木古内MA|渡島|01392,北海道新幹線
hokkaido_donan_nanae|七飯町|01337|0138|函館MA|渡島|0138
hokkaido_donan_shikabe|鹿部町|01343|01372|鹿部MA|渡島|01372
hokkaido_donan_mori|森町|01345|01374|森MA|渡島|01374
hokkaido_donan_yakumo|八雲町|01346|0137|八雲MA|渡島|0137
hokkaido_donan_oshamambe|長万部町|01347|01377|八雲MA|渡島|01377
hokkaido_donan_esashi|江差町|01361|0139|江差MA|檜山|0139
hokkaido_donan_kaminokuni|上ノ国町|01362|0139|江差MA|檜山|0139
hokkaido_donan_assabu|厚沢部町|01363|0139|江差MA|檜山|0139
hokkaido_donan_otobe|乙部町|01364|0139|江差MA|檜山|0139
hokkaido_donan_okushiri|奥尻町|01367|01397|奥尻MA|檜山|01397,島
hokkaido_donan_imakane|今金町|01370|0137|今金MA|檜山|0137
hokkaido_donan_setana|せたな町|01371|0137|今金MA|檜山|0137,日本海
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
  const res = await fetch(`${SOURCE}/01/${code}.json`);
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
  interval: "120m",
  weighting: 0.75,
  minIslandArea: "6000m2",
  minSliverArea: "6000m2",
  sliverControl: 0.85
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "hokkaido_donan", name: "北海道道南", code: "01" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.HOKKAIDO_DONAN_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
