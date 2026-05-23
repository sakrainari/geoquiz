import { mkdir, writeFile } from "node:fs/promises";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/okayama.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
okayama_okayama|岡山市|33101,33102,33103,33104|086|岡山MA|備前|県庁所在地,政令指定都市,086
okayama_kurashiki|倉敷市|33202|086|倉敷MA|備中|086
okayama_tsuyama|津山市|33203|0868|津山MA|美作|0868
okayama_tamano|玉野市|33204|0863|玉野MA|備前|0863
okayama_kasaoka|笠岡市|33205|0865|笠岡MA|備中|0865
okayama_ibara|井原市|33207|0866|井原MA|備中|0866
okayama_soja|総社市|33208|0866|総社MA|備中|0866
okayama_takahashi|高梁市|33209|0866|高梁MA|備中|0866
okayama_niimi|新見市|33210|0867|新見MA|備中|0867
okayama_bizen|備前市|33211|0869|備前MA|備前|0869
okayama_setouchi|瀬戸内市|33212|0869|邑久MA|備前|0869
okayama_akaiwa|赤磐市|33213|086|岡山MA|備前|086
okayama_maniwa|真庭市|33214|0867|真庭MA|美作|0867
okayama_mimasaka|美作市|33215|0868|美作MA|美作|0868
okayama_asakuchi|浅口市|33216|0865|鴨方MA|備中|0865
okayama_wake|和気町|33346|0869|和気MA|備前|0869
okayama_hayashima|早島町|33423|086|岡山MA|備中|086
okayama_satosho|里庄町|33445|0865|笠岡MA|備中|0865
okayama_yakage|矢掛町|33461|0866|矢掛MA|備中|0866
okayama_shinjo|新庄村|33586|0867|真庭MA|美作|0867,村
okayama_kagamino|鏡野町|33606|0868|津山MA|美作|0868
okayama_shoo|勝央町|33622|0868|勝央MA|美作|0868
okayama_nagi|奈義町|33623|0868|勝央MA|美作|0868
okayama_nishiawakura|西粟倉村|33643|0868|美作MA|美作|0868,村
okayama_kumenan|久米南町|33663|086|岡山MA|美作|086
okayama_misaki|美咲町|33666|0868|美咲MA|美作|0868
okayama_kibichuo|吉備中央町|33681|0866|吉備中央MA|備中|0866
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
  const res = await fetch(`${SOURCE}/33/${code}.json`);
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
  prefecture: { id: "okayama", name: "岡山県", code: "33" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};
await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.OKAYAMA_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`);
