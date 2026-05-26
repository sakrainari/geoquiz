import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/kanagawa.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const admins = [
  {
    id: "kanagawa_yokohama",
    name: "横浜市",
    codes: ["14101", "14102", "14103", "14104", "14105", "14106", "14107", "14108", "14109", "14110", "14111", "14112", "14113", "14114", "14115", "14116", "14117", "14118"],
    area_code: "045",
    ma_name: "横浜MA",
    region: "横浜",
    tags: ["県庁所在地", "政令指定都市", "045"]
  },
  {
    id: "kanagawa_kawasaki",
    name: "川崎市",
    codes: ["14131", "14132", "14133", "14134", "14135", "14136", "14137"],
    area_code: "044",
    ma_name: "川崎MA",
    region: "川崎",
    tags: ["政令指定都市", "044", "東京寄り"]
  },
  {
    id: "kanagawa_sagamihara",
    name: "相模原市",
    codes: ["14151", "14152", "14153"],
    area_code: "042",
    ma_name: "相模原MA",
    region: "県央",
    tags: ["政令指定都市", "042"]
  },
  { id: "kanagawa_yokosuka", name: "横須賀市", code: "14201", area_code: "046", ma_name: "横須賀MA", region: "横須賀三浦", tags: ["046", "三浦半島"] },
  { id: "kanagawa_hiratsuka", name: "平塚市", code: "14203", area_code: "0463", ma_name: "平塚MA", region: "湘南", tags: ["0463", "湘南"] },
  { id: "kanagawa_kamakura", name: "鎌倉市", code: "14204", area_code: "0467", ma_name: "藤沢MA", region: "横須賀三浦", tags: ["0467", "古都"] },
  { id: "kanagawa_fujisawa", name: "藤沢市", code: "14205", area_code: "0466", ma_name: "藤沢MA", region: "湘南", tags: ["0466", "湘南"] },
  { id: "kanagawa_odawara", name: "小田原市", code: "14206", area_code: "0465", ma_name: "小田原MA", region: "県西", tags: ["0465", "城下町"] },
  { id: "kanagawa_chigasaki", name: "茅ヶ崎市", code: "14207", area_code: "0467", ma_name: "藤沢MA", region: "湘南", tags: ["0467", "湘南"] },
  { id: "kanagawa_zushi", name: "逗子市", code: "14208", area_code: "046", ma_name: "横須賀MA", region: "横須賀三浦", tags: ["046", "三浦半島"] },
  { id: "kanagawa_miura", name: "三浦市", code: "14210", area_code: "046", ma_name: "横須賀MA", region: "横須賀三浦", tags: ["046", "三浦半島"] },
  { id: "kanagawa_hadano", name: "秦野市", code: "14211", area_code: "0463", ma_name: "平塚MA", region: "湘南", tags: ["0463", "丹沢"] },
  { id: "kanagawa_atsugi", name: "厚木市", code: "14212", area_code: "046", ma_name: "厚木MA", region: "県央", tags: ["046", "県央"] },
  { id: "kanagawa_yamato", name: "大和市", code: "14213", area_code: "046", ma_name: "厚木MA", region: "県央", tags: ["046", "県央"] },
  { id: "kanagawa_isehara", name: "伊勢原市", code: "14214", area_code: "0463", ma_name: "平塚MA", region: "湘南", tags: ["0463", "大山"] },
  { id: "kanagawa_ebina", name: "海老名市", code: "14215", area_code: "046", ma_name: "厚木MA", region: "県央", tags: ["046", "県央"] },
  { id: "kanagawa_zama", name: "座間市", code: "14216", area_code: "046", ma_name: "厚木MA", region: "県央", tags: ["046", "県央"] },
  { id: "kanagawa_minamiashigara", name: "南足柄市", code: "14217", area_code: "0465", ma_name: "小田原MA", region: "県西", tags: ["0465", "足柄"] },
  { id: "kanagawa_ayase", name: "綾瀬市", code: "14218", area_code: "0467", ma_name: "藤沢MA", region: "県央", tags: ["0467", "県央"] },
  { id: "kanagawa_hayama", name: "葉山町", code: "14301", area_code: "046", ma_name: "横須賀MA", region: "横須賀三浦", tags: ["046", "三浦半島"] },
  { id: "kanagawa_samukawa", name: "寒川町", code: "14321", area_code: "0467", ma_name: "藤沢MA", region: "湘南", tags: ["0467", "湘南"] },
  { id: "kanagawa_oiso", name: "大磯町", code: "14341", area_code: "0463", ma_name: "平塚MA", region: "湘南", tags: ["0463", "湘南"] },
  { id: "kanagawa_ninomiya", name: "二宮町", code: "14342", area_code: "0463", ma_name: "平塚MA", region: "湘南", tags: ["0463", "湘南"] },
  { id: "kanagawa_nakai", name: "中井町", code: "14361", area_code: "0465", ma_name: "小田原MA", region: "県西", tags: ["0465", "足柄上"] },
  { id: "kanagawa_oi", name: "大井町", code: "14362", area_code: "0465", ma_name: "小田原MA", region: "県西", tags: ["0465", "足柄上"] },
  { id: "kanagawa_matsuda", name: "松田町", code: "14363", area_code: "0465", ma_name: "小田原MA", region: "県西", tags: ["0465", "足柄上"] },
  { id: "kanagawa_yamakita", name: "山北町", code: "14364", area_code: "0465", ma_name: "小田原MA", region: "県西", tags: ["0465", "足柄上"] },
  { id: "kanagawa_kaisei", name: "開成町", code: "14366", area_code: "0465", ma_name: "小田原MA", region: "県西", tags: ["0465", "足柄上"] },
  { id: "kanagawa_hakone", name: "箱根町", code: "14382", area_code: "0460", ma_name: "小田原MA", region: "県西", tags: ["0460", "観光地"] },
  { id: "kanagawa_manazuru", name: "真鶴町", code: "14383", area_code: "0465", ma_name: "小田原MA", region: "県西", tags: ["0465", "真鶴半島"] },
  { id: "kanagawa_yugawara", name: "湯河原町", code: "14384", area_code: "0465", ma_name: "小田原MA", region: "県西", tags: ["0465", "温泉"] },
  { id: "kanagawa_aikawa", name: "愛川町", code: "14401", area_code: "046", ma_name: "厚木MA", region: "県央", tags: ["046", "県央"] },
  { id: "kanagawa_kiyokawa", name: "清川村", code: "14402", area_code: "046", ma_name: "厚木MA", region: "県央", tags: ["046", "村"] }
];

function collectCoords(geometry, out = []) {
  if (!geometry) return out;
  if (geometry.type === "Polygon") geometry.coordinates.flat(1).forEach(([lng, lat]) => out.push([lng, lat]));
  if (geometry.type === "MultiPolygon") geometry.coordinates.flat(2).forEach(([lng, lat]) => out.push([lng, lat]));
  return out;
}

function labelPoint(geometry) {
  const coords = collectCoords(geometry);
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    +(lats.reduce((a, b) => a + b, 0) / lats.length).toFixed(6),
    +(lngs.reduce((a, b) => a + b, 0) / lngs.length).toFixed(6)
  ];
}

function labelSize(name) {
  if (name.length >= 6) return 7.8;
  if (name.length >= 5) return 8.2;
  if (name.length >= 4) return 8.8;
  return 9.6;
}

async function fetchAdmin(code) {
  const res = await fetch(`${SOURCE}/14/${code}.json`);
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
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "kanagawa", name: "神奈川県", code: "14" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.KANAGAWA_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
