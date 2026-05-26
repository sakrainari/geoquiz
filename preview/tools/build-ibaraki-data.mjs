import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/ibaraki.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const admins = [
  { id: "ibaraki_mito", name: "水戸市", code: "08201", area_code: "029", ma_name: "水戸MA", region: "県央", tags: ["県庁所在地", "029", "県央"] },
  { id: "ibaraki_hitachi", name: "日立市", code: "08202", area_code: "0294", ma_name: "常陸太田MA", region: "県北", tags: ["0294", "沿岸", "県北"] },
  { id: "ibaraki_tsuchiura", name: "土浦市", code: "08203", area_code: "029", ma_name: "土浦MA", region: "県南", tags: ["029", "霞ヶ浦", "県南"] },
  { id: "ibaraki_koga", name: "古河市", code: "08204", area_code: "0280", ma_name: "古河MA", region: "県西", tags: ["0280", "利根川", "県西"] },
  { id: "ibaraki_ishioka", name: "石岡市", code: "08205", area_code: "0299", ma_name: "石岡MA", region: "県南", tags: ["0299", "筑波山麓", "県南"] },
  { id: "ibaraki_yuki", name: "結城市", code: "08207", area_code: "0296", ma_name: "下館MA", region: "県西", tags: ["0296", "県西"] },
  { id: "ibaraki_ryugasaki", name: "龍ケ崎市", code: "08208", area_code: "0297", ma_name: "竜ケ崎MA", region: "県南", tags: ["0297", "県南"] },
  { id: "ibaraki_shimotsuma", name: "下妻市", code: "08210", area_code: "0296", ma_name: "下館MA", region: "県西", tags: ["0296", "県西"] },
  { id: "ibaraki_joso", name: "常総市", code: "08211", area_code: "0297", ma_name: "水海道MA", region: "県西", tags: ["0297", "鬼怒川", "県西"] },
  { id: "ibaraki_hitachiota", name: "常陸太田市", code: "08212", area_code: "0294", ma_name: "常陸太田MA", region: "県北", tags: ["0294", "県北"] },
  { id: "ibaraki_takahagi", name: "高萩市", code: "08214", area_code: "0293", ma_name: "高萩MA", region: "県北", tags: ["0293", "沿岸", "県北"] },
  { id: "ibaraki_kitaibaraki", name: "北茨城市", code: "08215", area_code: "0293", ma_name: "高萩MA", region: "県北", tags: ["0293", "沿岸", "県北"] },
  { id: "ibaraki_kasama", name: "笠間市", code: "08216", area_code: "0296", ma_name: "笠間MA", region: "県央", tags: ["0296", "焼き物", "県央"] },
  { id: "ibaraki_toride", name: "取手市", code: "08217", area_code: "0297", ma_name: "竜ケ崎MA", region: "県南", tags: ["0297", "利根川", "県南"] },
  { id: "ibaraki_ushiku", name: "牛久市", code: "08219", area_code: "029", ma_name: "土浦MA", region: "県南", tags: ["029", "県南"] },
  { id: "ibaraki_tsukuba", name: "つくば市", code: "08220", area_code: "029", ma_name: "土浦MA", region: "県南", tags: ["029", "研究学園都市", "県南"] },
  { id: "ibaraki_hitachinaka", name: "ひたちなか市", code: "08221", area_code: "029", ma_name: "水戸MA", region: "県央", tags: ["029", "港", "県央"] },
  { id: "ibaraki_kashima", name: "鹿嶋市", code: "08222", area_code: "0299", ma_name: "潮来MA", region: "鹿行", tags: ["0299", "鹿行"] },
  { id: "ibaraki_itako", name: "潮来市", code: "08223", area_code: "0299", ma_name: "潮来MA", region: "鹿行", tags: ["0299", "水郷", "鹿行"] },
  { id: "ibaraki_moriya", name: "守谷市", code: "08224", area_code: "0297", ma_name: "水海道MA", region: "県南", tags: ["0297", "TX沿線", "県南"] },
  { id: "ibaraki_hitachiomiya", name: "常陸大宮市", code: "08225", area_code: "0295", ma_name: "常陸大宮MA", region: "県北", tags: ["0295", "県北"] },
  { id: "ibaraki_naka", name: "那珂市", code: "08226", area_code: "029", ma_name: "水戸MA", region: "県央", tags: ["029", "県央"] },
  { id: "ibaraki_chikusei", name: "筑西市", code: "08227", area_code: "0296", ma_name: "下館MA", region: "県西", tags: ["0296", "県西"] },
  { id: "ibaraki_bando", name: "坂東市", code: "08228", area_code: "0297", ma_name: "水海道MA", region: "県西", tags: ["0297", "県西"] },
  { id: "ibaraki_inashiki", name: "稲敷市", code: "08229", area_code: "029", ma_name: "土浦MA", region: "県南", tags: ["029", "霞ヶ浦", "県南"] },
  { id: "ibaraki_kasumigaura", name: "かすみがうら市", code: "08230", area_code: "0299", ma_name: "石岡MA", region: "県南", tags: ["0299", "霞ヶ浦", "県南"] },
  { id: "ibaraki_sakuragawa", name: "桜川市", code: "08231", area_code: "0296", ma_name: "笠間MA", region: "県西", tags: ["0296", "県西"] },
  { id: "ibaraki_kamisu", name: "神栖市", code: "08232", area_code: "0299", ma_name: "潮来MA", region: "鹿行", tags: ["0299", "臨海工業", "鹿行"] },
  { id: "ibaraki_namegata", name: "行方市", code: "08233", area_code: "0299", ma_name: "潮来MA", region: "鹿行", tags: ["0299", "霞ヶ浦", "鹿行"] },
  { id: "ibaraki_hokota", name: "鉾田市", code: "08234", area_code: "0291", ma_name: "鉾田MA", region: "鹿行", tags: ["0291", "鹿行"] },
  { id: "ibaraki_tsukubamirai", name: "つくばみらい市", code: "08235", area_code: "0297", ma_name: "水海道MA", region: "県南", tags: ["0297", "TX沿線", "県南"] },
  { id: "ibaraki_omitama", name: "小美玉市", code: "08236", area_code: "0299", ma_name: "石岡MA", region: "県央", tags: ["0299", "空港圏", "県央"] },
  { id: "ibaraki_ibaraki", name: "茨城町", code: "08302", area_code: "029", ma_name: "水戸MA", region: "県央", tags: ["029", "県央"] },
  { id: "ibaraki_oarai", name: "大洗町", code: "08309", area_code: "029", ma_name: "水戸MA", region: "県央", tags: ["029", "海岸", "県央"] },
  { id: "ibaraki_shirosato", name: "城里町", code: "08310", area_code: "029", ma_name: "水戸MA", region: "県央", tags: ["029", "県央"] },
  { id: "ibaraki_tokai", name: "東海村", code: "08341", area_code: "029", ma_name: "水戸MA", region: "県央", tags: ["029", "村", "県央"] },
  { id: "ibaraki_daigo", name: "大子町", code: "08364", area_code: "0295", ma_name: "大子MA", region: "県北", tags: ["0295", "久慈川", "県北"] },
  { id: "ibaraki_miho", name: "美浦村", code: "08442", area_code: "029", ma_name: "土浦MA", region: "県南", tags: ["029", "村", "県南"] },
  { id: "ibaraki_ami", name: "阿見町", code: "08443", area_code: "029", ma_name: "土浦MA", region: "県南", tags: ["029", "県南"] },
  { id: "ibaraki_kawachi", name: "河内町", code: "08447", area_code: "0297", ma_name: "竜ケ崎MA", region: "県南", tags: ["0297", "利根川", "県南"] },
  { id: "ibaraki_yachiyo", name: "八千代町", code: "08521", area_code: "0296", ma_name: "下館MA", region: "県西", tags: ["0296", "県西"] },
  { id: "ibaraki_goka", name: "五霞町", code: "08542", area_code: "0280", ma_name: "古河MA", region: "県西", tags: ["0280", "県境", "県西"] },
  { id: "ibaraki_sakai", name: "境町", code: "08546", area_code: "0280", ma_name: "古河MA", region: "県西", tags: ["0280", "県境", "県西"] },
  { id: "ibaraki_tone", name: "利根町", code: "08564", area_code: "0297", ma_name: "竜ケ崎MA", region: "県南", tags: ["0297", "利根川", "県南"] }
];

function collectCoords(geometry) {
  const coords = [];

  const walk = (value) => {
    if (!Array.isArray(value)) return;
    if (typeof value[0] === "number" && typeof value[1] === "number") {
      coords.push(value);
      return;
    }
    value.forEach(walk);
  };

  walk(geometry.coordinates);
  return coords;
}

function labelPoint(geometry) {
  const coords = collectCoords(geometry);
  if (!coords.length) return null;
  let sumLon = 0;
  let sumLat = 0;
  for (const [lon, lat] of coords) {
    sumLon += lon;
    sumLat += lat;
  }
  return [sumLon / coords.length, sumLat / coords.length];
}

function labelSize(geometry) {
  const coords = collectCoords(geometry);
  if (!coords.length) return 1;

  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  const span = Math.max(maxLon - minLon, maxLat - minLat);
  if (span > 0.4) return 1.4;
  if (span > 0.25) return 1.25;
  if (span > 0.14) return 1.1;
  return 1;
}

async function fetchAdmin(code) {
  const res = await fetch(`${SOURCE}/08/${code}.json`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${code}: ${res.status}`);
  }
  console.log(`fetched ${code}`);
  return res.json();
}

const features = [];

for (const admin of admins) {
  const { code, ...meta } = admin;
  const collection = await fetchAdmin(code);

  for (const feature of collection.features) {
    const geometry = feature.geometry;
    const props = {
      ...meta,
      sourceCode: code,
      labelPoint: labelPoint(geometry),
      labelAngle: admin.name.length >= 5 ? -18 : -25,
      labelSize: labelSize(geometry)
    };
    features.push({ type: "Feature", properties: props, geometry });
  }
}

const rawFeatureCollection = {
  type: "FeatureCollection",
  features
};

const rawVertexCount = countFeatureVertices(rawFeatureCollection);
const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(rawFeatureCollection, {
  interval: "35m",
  weighting: 0.75,
  minIslandArea: "1500m2",
  minSliverArea: "1500m2",
  sliverControl: 0.85
});

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);
const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: {
    id: "ibaraki",
    name: "茨城県",
    code: "08"
  },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.IBARAKI_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");

console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
