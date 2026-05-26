import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/ehime.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
ehime_matsuyama|松山市|38201|089|松山MA|中予|県庁所在地,089
ehime_imabari|今治市|38202|0898|今治MA|東予|0898,しまなみ
ehime_uwajima|宇和島市|38203|0895|宇和島MA|南予|0895
ehime_yawatahama|八幡浜市|38204|0894|八幡浜MA|南予|0894
ehime_niihama|新居浜市|38205|0897|新居浜MA|東予|0897
ehime_saijo|西条市|38206|0897|西条MA|東予|0897
ehime_ozu|大洲市|38207|0893|大洲MA|南予|0893
ehime_iyo|伊予市|38210|089|松山MA|中予|089
ehime_shikokuchuo|四国中央市|38213|0896|伊予三島MA|東予|0896
ehime_seiyo|西予市|38214|0894|宇和MA|南予|0894
ehime_toon|東温市|38215|089|松山MA|中予|089
ehime_kamijima|上島町|38356|0897|弓削MA|東予|0897,島
ehime_kumakogen|久万高原町|38386|0892|久万MA|中予|0892
ehime_masaki|松前町|38401|089|松山MA|中予|089
ehime_tobe|砥部町|38402|089|松山MA|中予|089
ehime_uchiko|内子町|38422|0893|内子MA|南予|0893
ehime_ikata|伊方町|38442|0894|八幡浜MA|南予|0894
ehime_matsuno|松野町|38484|0895|宇和島MA|南予|0895
ehime_kihoku|鬼北町|38488|0895|宇和島MA|南予|0895
ehime_ainan|愛南町|38506|0895|御荘MA|南予|0895
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
  const res = await fetch(`${SOURCE}/38/${code}.json`);
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
  interval: "55m",
  weighting: 0.78,
  minIslandArea: "3500m2",
  minSliverArea: "3500m2",
  sliverControl: 0.88
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "ehime", name: "愛媛県", code: "38" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.EHIME_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
