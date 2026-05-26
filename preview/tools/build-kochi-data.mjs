import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/kochi.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
kochi_kochi|高知市|39201|088|高知MA|中部|県庁所在地,088
kochi_muroto|室戸市|39202|0887|室戸MA|東部|0887
kochi_aki|安芸市|39203|0887|安芸MA|東部|0887
kochi_nankoku|南国市|39204|088|高知MA|中部|088
kochi_tosa|土佐市|39205|088|高知MA|中部|088
kochi_susaki|須崎市|39206|0889|須崎MA|中西部|0889
kochi_sukumo|宿毛市|39208|0880|宿毛MA|西部|0880
kochi_tosashimizu|土佐清水市|39209|0880|清水MA|西部|0880
kochi_shimanto|四万十市|39210|0880|中村MA|西部|0880
kochi_konan|香南市|39211|0887|赤岡MA|東部|0887
kochi_kami|香美市|39212|0887|山田MA|東部|0887
kochi_toyo|東洋町|39301|0887|甲浦MA|東部|0887
kochi_nahari|奈半利町|39302|0887|奈半利MA|東部|0887
kochi_tano|田野町|39303|0887|田野MA|東部|0887
kochi_yasuda|安田町|39304|0887|安田MA|東部|0887
kochi_kitagawa|北川村|39305|0887|奈半利MA|東部|0887,村
kochi_umaji|馬路村|39306|0887|安芸MA|東部|0887,村
kochi_geisei|芸西村|39307|0887|安芸MA|東部|0887,村
kochi_motoyama|本山町|39341|0887|本山MA|中部|0887
kochi_otoyo|大豊町|39344|0887|本山MA|中部|0887
kochi_tosa_cho|土佐町|39363|0887|本山MA|中部|0887
kochi_okawa|大川村|39364|0887|本山MA|中部|0887,村
kochi_ino|いの町|39386|088|高知MA|中部|088
kochi_niyodogawa|仁淀川町|39387|0889|佐川MA|中西部|0889
kochi_nakatosa|中土佐町|39401|0889|久礼MA|中西部|0889
kochi_sakawa|佐川町|39402|0889|佐川MA|中西部|0889
kochi_ochi|越知町|39403|0889|佐川MA|中西部|0889
kochi_yusuhara|檮原町|39405|0889|梼原MA|中西部|0889
kochi_hidaka|日高村|39410|0889|佐川MA|中西部|0889,村
kochi_tsuno|津野町|39411|0889|葉山MA|中西部|0889
kochi_shimanto_cho|四万十町|39412|0880|窪川MA|西部|0880
kochi_otsuki|大月町|39424|0880|宿毛MA|西部|0880
kochi_mihara|三原村|39427|0880|中村MA|西部|0880,村
kochi_kuroshio|黒潮町|39428|0880|佐賀MA|西部|0880
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
  const res = await fetch(`${SOURCE}/39/${code}.json`);
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
  prefecture: { id: "kochi", name: "高知県", code: "39" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.KOCHI_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
