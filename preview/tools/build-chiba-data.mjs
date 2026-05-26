import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/chiba.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const admins = [
  { id: "chiba_chiba", name: "千葉市", codes: ["12101", "12102", "12103", "12104", "12105", "12106"], area_code: "043", ma_name: "千葉MA", region: "千葉", tags: ["県庁所在地", "政令指定都市", "043"] },
  { id: "chiba_choshi", name: "銚子市", code: "12202", area_code: "0479", ma_name: "銚子MA", region: "香取海匝", tags: ["0479", "犬吠埼"] },
  { id: "chiba_ichikawa", name: "市川市", code: "12203", area_code: "047", ma_name: "市川MA", region: "葛南", tags: ["047", "東京寄り"] },
  { id: "chiba_funabashi", name: "船橋市", code: "12204", area_code: "047", ma_name: "船橋MA", region: "葛南", tags: ["047", "ベイエリア"] },
  { id: "chiba_tateyama", name: "館山市", code: "12205", area_code: "0470", ma_name: "館山MA", region: "安房", tags: ["0470", "房総半島"] },
  { id: "chiba_kisarazu", name: "木更津市", code: "12206", area_code: "0438", ma_name: "木更津MA", region: "君津", tags: ["0438", "東京湾岸"] },
  { id: "chiba_matsudo", name: "松戸市", code: "12207", area_code: "047", ma_name: "市川MA", region: "東葛飾", tags: ["047", "常磐線"] },
  { id: "chiba_noda", name: "野田市", code: "12208", area_code: "04", ma_name: "柏MA", region: "東葛飾", tags: ["04", "利根川"] },
  { id: "chiba_mobara", name: "茂原市", code: "12210", area_code: "0475", ma_name: "茂原MA", region: "長生", tags: ["0475", "外房"] },
  { id: "chiba_narita", name: "成田市", code: "12211", area_code: "0476", ma_name: "成田MA", region: "印旛", tags: ["0476", "成田空港"] },
  { id: "chiba_sakura", name: "佐倉市", code: "12212", area_code: "043", ma_name: "千葉MA", region: "印旛", tags: ["043", "城下町"] },
  { id: "chiba_togane", name: "東金市", code: "12213", area_code: "0475", ma_name: "東金MA", region: "山武", tags: ["0475", "九十九里"] },
  { id: "chiba_asahi", name: "旭市", code: "12215", area_code: "0479", ma_name: "銚子MA", region: "香取海匝", tags: ["0479", "海匝"] },
  { id: "chiba_narashino", name: "習志野市", code: "12216", area_code: "047", ma_name: "船橋MA", region: "葛南", tags: ["047", "ベイエリア"] },
  { id: "chiba_kashiwa", name: "柏市", code: "12217", area_code: "04", ma_name: "柏MA", region: "東葛飾", tags: ["04", "東葛"] },
  { id: "chiba_katsuura", name: "勝浦市", code: "12218", area_code: "0470", ma_name: "大原MA", region: "夷隅", tags: ["0470", "外房"] },
  { id: "chiba_ichihara", name: "市原市", code: "12219", area_code: "0436", ma_name: "市原MA", region: "市原", tags: ["0436", "工業地帯"] },
  { id: "chiba_nagareyama", name: "流山市", code: "12220", area_code: "04", ma_name: "柏MA", region: "東葛飾", tags: ["04", "TX沿線"] },
  { id: "chiba_yachiyo", name: "八千代市", code: "12221", area_code: "047", ma_name: "船橋MA", region: "印旛", tags: ["047", "新川"] },
  { id: "chiba_abiko", name: "我孫子市", code: "12222", area_code: "04", ma_name: "柏MA", region: "東葛飾", tags: ["04", "手賀沼"] },
  { id: "chiba_kamogawa", name: "鴨川市", code: "12223", area_code: "04", ma_name: "鴨川MA", region: "安房", tags: ["04", "南房総"] },
  { id: "chiba_kamagaya", name: "鎌ケ谷市", code: "12224", area_code: "047", ma_name: "船橋MA", region: "東葛飾", tags: ["047", "新京成"] },
  { id: "chiba_kimitsu", name: "君津市", code: "12225", area_code: "0439", ma_name: "木更津MA", region: "君津", tags: ["0439", "内房"] },
  { id: "chiba_futtsu", name: "富津市", code: "12226", area_code: "0439", ma_name: "木更津MA", region: "君津", tags: ["0439", "内房"] },
  { id: "chiba_urayasu", name: "浦安市", code: "12227", area_code: "047", ma_name: "市川MA", region: "葛南", tags: ["047", "東京ディズニーリゾート"] },
  { id: "chiba_yotsukaido", name: "四街道市", code: "12228", area_code: "043", ma_name: "千葉MA", region: "印旛", tags: ["043", "総武本線"] },
  { id: "chiba_sodegaura", name: "袖ケ浦市", code: "12229", area_code: "0438", ma_name: "木更津MA", region: "君津", tags: ["0438", "内房"] },
  { id: "chiba_yachimata", name: "八街市", code: "12230", area_code: "043", ma_name: "千葉MA", region: "印旛", tags: ["043", "落花生"] },
  { id: "chiba_inzai", name: "印西市", code: "12231", area_code: "0476", ma_name: "成田MA", region: "印旛", tags: ["0476", "北総"] },
  { id: "chiba_shiroi", name: "白井市", code: "12232", area_code: "047", ma_name: "市川MA", region: "印旛", tags: ["047", "北総"] },
  { id: "chiba_tomisato", name: "富里市", code: "12233", area_code: "0476", ma_name: "成田MA", region: "印旛", tags: ["0476", "成田空港周辺"] },
  { id: "chiba_minamiboso", name: "南房総市", code: "12234", area_code: "0470", ma_name: "館山MA", region: "安房", tags: ["0470", "南房総"] },
  { id: "chiba_sosa", name: "匝瑳市", code: "12235", area_code: "0479", ma_name: "八日市場MA", region: "香取海匝", tags: ["0479", "八日市場"] },
  { id: "chiba_katori", name: "香取市", code: "12236", area_code: "0478", ma_name: "佐原MA", region: "香取海匝", tags: ["0478", "佐原"] },
  { id: "chiba_sammu", name: "山武市", code: "12237", area_code: "0475", ma_name: "東金MA", region: "山武", tags: ["0475", "九十九里"] },
  { id: "chiba_isumi", name: "いすみ市", code: "12238", area_code: "0470", ma_name: "大原MA", region: "夷隅", tags: ["0470", "外房"] },
  { id: "chiba_oamishirasato", name: "大網白里市", code: "12239", area_code: "0475", ma_name: "東金MA", region: "山武", tags: ["0475", "外房線"] },
  { id: "chiba_shisui", name: "酒々井町", code: "12322", area_code: "043", ma_name: "千葉MA", region: "印旛", tags: ["043", "印旛"] },
  { id: "chiba_sakae", name: "栄町", code: "12329", area_code: "0476", ma_name: "成田MA", region: "印旛", tags: ["0476", "利根川"] },
  { id: "chiba_kozaki", name: "神崎町", code: "12342", area_code: "0478", ma_name: "佐原MA", region: "香取海匝", tags: ["0478", "利根川"] },
  { id: "chiba_tako", name: "多古町", code: "12347", area_code: "0479", ma_name: "八日市場MA", region: "香取海匝", tags: ["0479", "空港圏"] },
  { id: "chiba_tonosho", name: "東庄町", code: "12349", area_code: "0478", ma_name: "佐原MA", region: "香取海匝", tags: ["0478", "利根川"] },
  { id: "chiba_kujukuri", name: "九十九里町", code: "12403", area_code: "0475", ma_name: "東金MA", region: "山武", tags: ["0475", "九十九里浜"] },
  { id: "chiba_shibayama", name: "芝山町", code: "12409", area_code: "0479", ma_name: "八日市場MA", region: "山武", tags: ["0479", "成田空港周辺"] },
  { id: "chiba_yokoshibahikari", name: "横芝光町", code: "12410", area_code: "0479", ma_name: "八日市場MA", region: "山武", tags: ["0479", "九十九里"] },
  { id: "chiba_ichinomiya", name: "一宮町", code: "12421", area_code: "0475", ma_name: "茂原MA", region: "長生", tags: ["0475", "外房"] },
  { id: "chiba_mutsuzawa", name: "睦沢町", code: "12422", area_code: "0475", ma_name: "茂原MA", region: "長生", tags: ["0475", "長生"] },
  { id: "chiba_chosei", name: "長生村", code: "12423", area_code: "0475", ma_name: "茂原MA", region: "長生", tags: ["0475", "村"] },
  { id: "chiba_shirako", name: "白子町", code: "12424", area_code: "0475", ma_name: "茂原MA", region: "長生", tags: ["0475", "九十九里浜"] },
  { id: "chiba_nagara", name: "長柄町", code: "12426", area_code: "0475", ma_name: "茂原MA", region: "長生", tags: ["0475", "長生"] },
  { id: "chiba_chonan", name: "長南町", code: "12427", area_code: "0475", ma_name: "茂原MA", region: "長生", tags: ["0475", "長生"] },
  { id: "chiba_otaki", name: "大多喜町", code: "12441", area_code: "0470", ma_name: "大原MA", region: "夷隅", tags: ["0470", "養老渓谷"] },
  { id: "chiba_onjuku", name: "御宿町", code: "12443", area_code: "0470", ma_name: "大原MA", region: "夷隅", tags: ["0470", "外房"] },
  { id: "chiba_kyonan", name: "鋸南町", code: "12463", area_code: "0470", ma_name: "館山MA", region: "安房", tags: ["0470", "内房"] }
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
  const res = await fetch(`${SOURCE}/12/${code}.json`);
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
  interval: "50m",
  weighting: 0.75,
  minIslandArea: "2500m2",
  minSliverArea: "2500m2",
  sliverControl: 0.85
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "chiba", name: "千葉県", code: "12" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.CHIBA_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
