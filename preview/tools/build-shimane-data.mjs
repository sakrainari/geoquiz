import { mkdir, writeFile } from "node:fs/promises";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/shimane.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
shimane_matsue|松江市|32201|0852|松江MA|東部|県庁所在地,0852
shimane_hamada|浜田市|32202|0855|浜田MA|西部|0855
shimane_izumo|出雲市|32203|0853|出雲MA|東部|0853
shimane_masuda|益田市|32204|0856|益田MA|西部|0856
shimane_oda|大田市|32205|0854|大田MA|中部|0854
shimane_yasugi|安来市|32206|0854|安来MA|東部|0854
shimane_gotsu|江津市|32207|0855|江津MA|西部|0855
shimane_unnan|雲南市|32209|0854|雲南MA|東部|0854
shimane_okuizumo|奥出雲町|32343|0854|奥出雲MA|東部|0854
shimane_iinan|飯南町|32386|0854|飯南MA|東部|0854
shimane_kawamoto|川本町|32441|0855|川本MA|中部|0855
shimane_misato|美郷町|32448|0855|邑智MA|中部|0855
shimane_ohnan|邑南町|32449|0855|邑南MA|中部|0855
shimane_tsuwano|津和野町|32501|0856|津和野MA|西部|0856
shimane_yoshika|吉賀町|32505|0856|吉賀MA|西部|0856
shimane_ama|海士町|32525|08514|海士MA|隠岐|08514,島
shimane_nishinoshima|西ノ島町|32526|08514|西ノ島MA|隠岐|08514,島
shimane_chibu|知夫村|32527|08514|知夫MA|隠岐|08514,島,村
shimane_okinoshima|隠岐の島町|32528|08512|隠岐の島MA|隠岐|08512,島
`.trim().split("\n");

const admins = ADMIN_LINES.map((line) => {
  const [id, name, code, area_code, ma_name, region, tagsField] = line.split("|");
  return { id, name, code, area_code, ma_name, region, tags: tagsField.split(",") };
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
  const res = await fetch(`${SOURCE}/32/${code}.json`);
  if (!res.ok) throw new Error(`${code}: ${res.status} ${res.statusText}`);
  return res.json();
}
const features = [];
for (const admin of admins) {
  const collection = await fetchAdmin(admin.code);
  for (const feature of collection.features) {
    const geometry = feature.geometry;
    features.push({
      type: "Feature",
      properties: {
        id: admin.id,
        name: admin.name,
        area_code: admin.area_code,
        ma_name: admin.ma_name,
        region: admin.region,
        tags: admin.tags,
        sourceCode: admin.code,
        labelPoint: labelPoint(geometry),
        labelAngle: admin.name.length >= 5 ? -18 : -25,
        labelSize: labelSize(admin.name)
      },
      geometry
    });
  }
  console.log(`fetched ${admin.code}`);
}
const rawFeatureCollection = { type: "FeatureCollection", features };
const rawVertexCount = countFeatureVertices(rawFeatureCollection);
const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(rawFeatureCollection, {
  interval: "85m",
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
  prefecture: { id: "shimane", name: "島根県", code: "32" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};
await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.SHIMANE_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`);
