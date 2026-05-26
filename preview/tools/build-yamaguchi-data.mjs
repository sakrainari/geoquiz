import { mkdir, writeFile } from "node:fs/promises";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/yamaguchi.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
yamaguchi_shimonoseki|下関市|35201|083|下関MA|西部|083
yamaguchi_ube|宇部市|35202|0836|宇部MA|西部|0836
yamaguchi_yamaguchi|山口市|35203|083|山口MA|中部|県庁所在地,083
yamaguchi_hagi|萩市|35204|0838|萩MA|北部|0838
yamaguchi_hofu|防府市|35206|0835|防府MA|中部|0835
yamaguchi_kudamatsu|下松市|35207|0833|下松MA|東部|0833
yamaguchi_iwakuni|岩国市|35208|0827|岩国MA|東部|0827
yamaguchi_hikari|光市|35210|0833|光MA|東部|0833
yamaguchi_nagato|長門市|35211|0837|長門MA|北部|0837
yamaguchi_yanai|柳井市|35212|0820|柳井MA|東部|0820
yamaguchi_mine|美祢市|35213|0837|美祢MA|中部|0837
yamaguchi_shunan|周南市|35215|0834|周南MA|東部|0834
yamaguchi_sanyoonoda|山陽小野田市|35216|0836|宇部MA|西部|0836
yamaguchi_suooshima|周防大島町|35305|0820|周防大島MA|東部|0820,島
yamaguchi_waki|和木町|35321|0827|岩国MA|東部|0827
yamaguchi_kaminoseki|上関町|35341|0820|上関MA|東部|0820
yamaguchi_tabuse|田布施町|35343|0820|柳井MA|東部|0820
yamaguchi_hirao|平生町|35344|0820|柳井MA|東部|0820
yamaguchi_abu|阿武町|35502|08388|阿武MA|北部|08388
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
  const res = await fetch(`${SOURCE}/35/${code}.json`);
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
  prefecture: { id: "yamaguchi", name: "山口県", code: "35" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};
await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.YAMAGUCHI_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`);
