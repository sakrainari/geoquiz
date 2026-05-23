import { mkdir, writeFile } from "node:fs/promises";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/tottori.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
tottori_tottori|鳥取市|31201|0857|鳥取MA|東部|県庁所在地,0857
tottori_yonago|米子市|31202|0859|米子MA|西部|0859
tottori_kurayoshi|倉吉市|31203|0858|倉吉MA|中部|0858
tottori_sakaiminato|境港市|31204|0859|境港MA|西部|0859,港
tottori_iwami|岩美町|31302|0857|鳥取MA|東部|0857
tottori_wakasa|若桜町|31325|0858|若桜MA|東部|0858
tottori_chizu|智頭町|31328|0858|智頭MA|東部|0858
tottori_yazu|八頭町|31329|0858|郡家MA|東部|0858
tottori_misasa|三朝町|31364|0858|倉吉MA|中部|0858,温泉
tottori_yurihama|湯梨浜町|31370|0858|倉吉MA|中部|0858
tottori_kotoura|琴浦町|31371|0858|倉吉MA|中部|0858
tottori_hokuei|北栄町|31372|0858|倉吉MA|中部|0858
tottori_hiezu|日吉津村|31384|0859|米子MA|西部|0859,村
tottori_daisen|大山町|31386|0858|大山MA|西部|0858
tottori_nanbu|南部町|31389|0859|米子MA|西部|0859
tottori_hoki|伯耆町|31390|0859|米子MA|西部|0859
tottori_nichinan|日南町|31401|0859|日南MA|西部|0859
tottori_hino|日野町|31402|0859|日南MA|西部|0859
tottori_kofu|江府町|31403|0859|江府MA|西部|0859
`.trim().split("\n");

const admins = ADMIN_LINES.map((line) => {
  const parts = line.split("|");
  const [id, maybeName, maybeCode, maybeAreaCode, maybeMaName, maybeRegion, maybeTags] = parts;
  const [name, code, area_code, ma_name, region, tagsField] = parts.length === 7
    ? [maybeName, maybeCode, maybeAreaCode, maybeMaName, maybeRegion, maybeTags]
    : [parts[4], parts[1], parts[2], parts[3], parts[5], parts[6]];
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
  const res = await fetch(`${SOURCE}/31/${code}.json`);
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
  interval: "65m",
  weighting: 0.78,
  minIslandArea: "3500m2",
  minSliverArea: "4000m2",
  sliverControl: 0.9
});
for (const feature of simplifiedFeatureCollection.features) feature.properties.labelPoint = labelPoint(feature.geometry);
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "tottori", name: "鳥取県", code: "31" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.TOTTORI_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`);
