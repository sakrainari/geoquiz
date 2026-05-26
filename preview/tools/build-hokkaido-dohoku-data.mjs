import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/hokkaido-dohoku.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
hokkaido_dohoku_asahikawa|旭川市|01204|0166|旭川MA|上川|0166,中核市
hokkaido_dohoku_shibetsu|士別市|01220|0165|士別MA|上川|0165
hokkaido_dohoku_nayoro|名寄市|01221|01654|名寄MA|上川|01654
hokkaido_dohoku_furano|富良野市|01229|0167|富良野MA|上川|0167
hokkaido_dohoku_takasu|鷹栖町|01452|0166|旭川MA|上川|0166
hokkaido_dohoku_higashikagura|東神楽町|01453|0166|旭川MA|上川|0166
hokkaido_dohoku_toma|当麻町|01454|0166|旭川MA|上川|0166
hokkaido_dohoku_pippu|比布町|01455|0166|旭川MA|上川|0166
hokkaido_dohoku_aibetsu|愛別町|01456|01658|上川MA|上川|01658
hokkaido_dohoku_kamikawa|上川町|01457|01658|上川MA|上川|01658
hokkaido_dohoku_higashikawa|東川町|01458|0166|旭川MA|上川|0166
hokkaido_dohoku_biei|美瑛町|01459|0166|旭川MA|上川|0166
hokkaido_dohoku_kamifurano|上富良野町|01460|0167|富良野MA|上川|0167
hokkaido_dohoku_nakafurano|中富良野町|01461|0167|富良野MA|上川|0167
hokkaido_dohoku_minamifurano|南富良野町|01462|0167|富良野MA|上川|0167
hokkaido_dohoku_shimukappu|占冠村|01463|0167|富良野MA|上川|0167,村
hokkaido_dohoku_wassamu|和寒町|01464|0165|士別MA|上川|0165
hokkaido_dohoku_kenbuchi|剣淵町|01465|0165|士別MA|上川|0165
hokkaido_dohoku_shimokawa|下川町|01468|01655|名寄MA|上川|01655
hokkaido_dohoku_bifuka|美深町|01469|01656|美深MA|上川|01656
hokkaido_dohoku_otoineppu|音威子府村|01470|01656|美深MA|上川|01656,村
hokkaido_dohoku_nakagawa|中川町|01471|01656|美深MA|上川|01656
hokkaido_dohoku_horokanai|幌加内町|01472|0165|士別MA|上川|0165
hokkaido_dohoku_rumoi|留萌市|01212|0164|留萌MA|留萌|0164
hokkaido_dohoku_mashike|増毛町|01481|0164|留萌MA|留萌|0164
hokkaido_dohoku_obira|小平町|01482|0164|留萌MA|留萌|0164
hokkaido_dohoku_tomamae|苫前町|01483|0164|羽幌MA|留萌|0164
hokkaido_dohoku_haboro|羽幌町|01484|0164|羽幌MA|留萌|0164
hokkaido_dohoku_shosanbetsu|初山別村|01485|0164|羽幌MA|留萌|0164,村
hokkaido_dohoku_embetsu|遠別町|01486|01632|天塩MA|留萌|01632
hokkaido_dohoku_teshio|天塩町|01487|01632|天塩MA|留萌|01632
hokkaido_dohoku_wakkanai|稚内市|01214|0162|稚内MA|宗谷|0162,宗谷岬
hokkaido_dohoku_sarufutsu|猿払村|01511|01635|浜頓別MA|宗谷|01635,村
hokkaido_dohoku_hamatonbetsu|浜頓別町|01512|01634|浜頓別MA|宗谷|01634
hokkaido_dohoku_nakatonbetsu|中頓別町|01513|01634|浜頓別MA|宗谷|01634
hokkaido_dohoku_esashi|枝幸町|01514|0163|北見枝幸MA|宗谷|0163
hokkaido_dohoku_toyotomi|豊富町|01516|0162|稚内MA|宗谷|0162
hokkaido_dohoku_rebun|礼文町|01517|0163|利尻礼文MA|宗谷|0163,島
hokkaido_dohoku_rishiri|利尻町|01518|0163|利尻礼文MA|宗谷|0163,島
hokkaido_dohoku_rishirifuji|利尻富士町|01519|0163|利尻礼文MA|宗谷|0163,島
hokkaido_dohoku_horonobe|幌延町|01520|01632|天塩MA|宗谷|01632
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
  interval: "140m",
  weighting: 0.75,
  minIslandArea: "7000m2",
  minSliverArea: "7000m2",
  sliverControl: 0.85
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "hokkaido_dohoku", name: "北海道道北", code: "01" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.HOKKAIDO_DOHOKU_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
