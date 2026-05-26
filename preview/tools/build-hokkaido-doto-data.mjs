import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/hokkaido-doto.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
hokkaido_doto_kushiro|釧路市|01206|0154|釧路MA|釧路|0154,港町
hokkaido_doto_obihiro|帯広市|01207|0155|帯広MA|十勝|0155,十勝
hokkaido_doto_kitami|北見市|01208|0157|北見MA|オホーツク|0157,オホーツク
hokkaido_doto_abashiri|網走市|01211|0152|網走MA|オホーツク|0152
hokkaido_doto_monbetsu|紋別市|01219|0158|紋別MA|オホーツク|0158
hokkaido_doto_nemuro|根室市|01223|0153|根室MA|根室|0153,最東端
hokkaido_doto_bihoro|美幌町|01543|0152|美幌MA|オホーツク|0152
hokkaido_doto_tsubetsu|津別町|01544|0152|美幌MA|オホーツク|0152
hokkaido_doto_shari|斜里町|01545|0152|斜里MA|オホーツク|0152,知床
hokkaido_doto_kiyosato|清里町|01546|0152|斜里MA|オホーツク|0152
hokkaido_doto_koshimizu|小清水町|01547|0152|網走MA|オホーツク|0152
hokkaido_doto_kunneppu|訓子府町|01549|0157|北見MA|オホーツク|0157
hokkaido_doto_oketo|置戸町|01550|0157|北見MA|オホーツク|0157
hokkaido_doto_saroma|佐呂間町|01552|01587|中湧別MA|オホーツク|01587
hokkaido_doto_engaru|遠軽町|01555|0158|遠軽MA|オホーツク|0158
hokkaido_doto_yubetsu|湧別町|01559|01586|中湧別MA|オホーツク|01586
hokkaido_doto_takinoue|滝上町|01560|0158|紋別MA|オホーツク|0158
hokkaido_doto_okoppe|興部町|01561|0158|興部MA|オホーツク|0158
hokkaido_doto_nishiokoppe|西興部村|01562|0158|興部MA|オホーツク|0158,村
hokkaido_doto_omu|雄武町|01563|0158|興部MA|オホーツク|0158
hokkaido_doto_ozora|大空町|01564|0152|美幌MA|オホーツク|0152
hokkaido_doto_otofuke|音更町|01631|0155|帯広MA|十勝|0155
hokkaido_doto_shihoro|士幌町|01632|01564|上士幌MA|十勝|01564
hokkaido_doto_kamishihoro|上士幌町|01633|01564|上士幌MA|十勝|01564
hokkaido_doto_shikaoi|鹿追町|01634|0156|十勝清水MA|十勝|0156
hokkaido_doto_shintoku|新得町|01635|0156|十勝清水MA|十勝|0156
hokkaido_doto_shimizu|清水町|01636|0156|十勝清水MA|十勝|0156
hokkaido_doto_memuro|芽室町|01637|0155|帯広MA|十勝|0155
hokkaido_doto_nakasatsunai|中札内村|01638|0155|帯広MA|十勝|0155,村
hokkaido_doto_sarabetsu|更別村|01639|0155|帯広MA|十勝|0155,村
hokkaido_doto_taiki|大樹町|01641|01558|広尾MA|十勝|01558
hokkaido_doto_hiroo|広尾町|01642|01558|広尾MA|十勝|01558
hokkaido_doto_makubetsu|幕別町|01643|0155|帯広MA|十勝|0155
hokkaido_doto_ikeda|池田町|01644|015|十勝池田MA|十勝|015
hokkaido_doto_toyokoro|豊頃町|01645|015|十勝池田MA|十勝|015
hokkaido_doto_honbetsu|本別町|01646|0156|本別MA|十勝|0156
hokkaido_doto_ashoro|足寄町|01647|0156|本別MA|十勝|0156
hokkaido_doto_rikubetsu|陸別町|01648|0156|本別MA|十勝|0156
hokkaido_doto_urahoro|浦幌町|01649|015|十勝池田MA|十勝|015
hokkaido_doto_kushirocho|釧路町|01661|0154|釧路MA|釧路|0154
hokkaido_doto_akkeshi|厚岸町|01662|0153|厚岸MA|釧路|0153
hokkaido_doto_hamanaka|浜中町|01663|0153|厚岸MA|釧路|0153
hokkaido_doto_shibecha|標茶町|01664|015|弟子屈MA|釧路|015
hokkaido_doto_teshikaga|弟子屈町|01665|015|弟子屈MA|釧路|015
hokkaido_doto_tsurui|鶴居村|01667|0154|釧路MA|釧路|0154,村
hokkaido_doto_shiranuka|白糠町|01668|01547|白糠MA|釧路|01547
hokkaido_doto_betsukai|別海町|01691|0153|中標津MA|根室|0153
hokkaido_doto_nakashibetsu|中標津町|01692|0153|中標津MA|根室|0153
hokkaido_doto_shibetsu|標津町|01693|0153|根室標津MA|根室|0153
hokkaido_doto_rausu|羅臼町|01694|0153|根室標津MA|根室|0153,知床
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
  interval: "160m",
  weighting: 0.75,
  minIslandArea: "9000m2",
  minSliverArea: "9000m2",
  sliverControl: 0.85
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "hokkaido_doto", name: "北海道道東", code: "01" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.HOKKAIDO_DOTO_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
