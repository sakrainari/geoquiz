import { mkdir, writeFile } from "node:fs/promises";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/hiroshima.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
hiroshima_hiroshima|広島市|34101,34102,34103,34104,34105,34106,34107,34108|082|広島MA|広島|県庁所在地,政令指定都市,082
hiroshima_kure|呉市|34202|0823|呉MA|広島|0823,港
hiroshima_takehara|竹原市|34203|0846|竹原MA|広島|0846
hiroshima_mihara|三原市|34204|0848|三原MA|備後|0848
hiroshima_onomichi|尾道市|34205|0848|尾道MA|備後|0848,しまなみ
hiroshima_fukuyama|福山市|34207|084|福山MA|備後|084
hiroshima_fuchu|府中市|34208|0847|府中MA|備後|0847
hiroshima_miyoshi|三次市|34209|0824|三次MA|備北|0824
hiroshima_shobara|庄原市|34210|0824|庄原MA|備北|0824
hiroshima_otake|大竹市|34211|0827|岩国MA|広島|0827
hiroshima_higashihiroshima|東広島市|34212|082|東広島MA|広島|082
hiroshima_hatsukaichi|廿日市市|34213|0829|廿日市MA|広島|0829
hiroshima_akitakata|安芸高田市|34214|0826|安芸高田MA|備北|0826
hiroshima_etajima|江田島市|34215|0823|江田島MA|広島|0823,島
hiroshima_fuchu_cho|府中町|34302|082|広島MA|広島|082
hiroshima_kaita|海田町|34304|082|広島MA|広島|082
hiroshima_kumano|熊野町|34307|082|広島MA|広島|082
hiroshima_saka|坂町|34309|082|広島MA|広島|082
hiroshima_akiota|安芸太田町|34368|0826|安芸太田MA|広島|0826
hiroshima_kitahiroshima|北広島町|34369|0826|北広島MA|広島|0826
hiroshima_osakikamijima|大崎上島町|34431|0846|大崎上島MA|備後|0846,島
hiroshima_sera|世羅町|34462|0847|世羅MA|備後|0847
hiroshima_jinsekikogen|神石高原町|34545|0847|神石高原MA|備後|0847
`.trim().split("\n");

const admins = ADMIN_LINES.map((line) => {
  const [id, name, codeField, area_code, ma_name, region, tagsField] = line.split("|");
  const codes = codeField.includes(",") ? codeField.split(",") : [codeField];
  return { id, name, ...(codes.length > 1 ? { codes } : { code: codes[0] }), area_code, ma_name, region, tags: tagsField.split(",") };
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
  return [+(lats.reduce((sum, value) => sum + value, 0) / lats.length).toFixed(6), +(lngs.reduce((sum, value) => sum + value, 0) / lngs.length).toFixed(6)];
}
function labelSize(name) {
  if (name.length >= 6) return 7.8;
  if (name.length >= 5) return 8.2;
  if (name.length >= 4) return 8.9;
  return 9.5;
}
async function fetchAdmin(code) {
  const res = await fetch(`${SOURCE}/34/${code}.json`);
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
  interval: "80m",
  weighting: 0.78,
  minIslandArea: "5000m2",
  minSliverArea: "6000m2",
  sliverControl: 0.9
});
for (const feature of simplifiedFeatureCollection.features) feature.properties.labelPoint = labelPoint(feature.geometry);
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);
const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "hiroshima", name: "広島県", code: "34" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};
await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.HIROSHIMA_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`);
