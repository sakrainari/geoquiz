import { mkdir, writeFile } from "node:fs/promises";

const OUTPUT = "data/prefectures/tokyo.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

// 東京都（島しょ部を除く）の自治体リスト
const admins = [
  // 23区
  { id: "tokyo_chiyoda", name: "千代田区", code: "13101", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "都心"] },
  { id: "tokyo_chuo", name: "中央区", code: "13102", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "都心"] },
  { id: "tokyo_minato", name: "港区", code: "13103", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "都心"] },
  { id: "tokyo_shinjuku", name: "新宿区", code: "13104", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "副都心"] },
  { id: "tokyo_bunkyo", name: "文京区", code: "13105", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_taito", name: "台東区", code: "13106", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_sumida", name: "墨田区", code: "13107", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_koto", name: "江東区", code: "13108", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_shinagawa", name: "品川区", code: "13109", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_meguro", name: "目黒区", code: "13110", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_ota", name: "大田区", code: "13111", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_setagaya", name: "世田谷区", code: "13112", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_shibuya", name: "渋谷区", code: "13113", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "副都心"] },
  { id: "tokyo_nakano", name: "中野区", code: "13114", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_suginami", name: "杉並区", code: "13115", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_toshima", name: "豊島区", code: "13116", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "副都心"] },
  { id: "tokyo_kita", name: "北区", code: "13117", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_arakawa", name: "荒川区", code: "13118", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_itabashi", name: "板橋区", code: "13119", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_nerima", name: "練馬区", code: "13120", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_adachi", name: "足立区", code: "13121", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_katsushika", name: "葛飾区", code: "13122", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_edogawa", name: "江戸川区", code: "13123", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  // 多摩地域
  { id: "tokyo_hachioji", name: "八王子市", code: "13201", area_code: "042", ma_name: "八王子MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_tachikawa", name: "立川市", code: "13202", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_musashino", name: "武蔵野市", code: "13203", area_code: "0422", ma_name: "武蔵野三鷹MA", region: "多摩", tags: ["多摩", "吉祥寺"] },
  { id: "tokyo_mitaka", name: "三鷹市", code: "13204", area_code: "0422", ma_name: "武蔵野三鷹MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_ome", name: "青梅市", code: "13205", area_code: "0428", ma_name: "青梅MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_fuchu", name: "府中市", code: "13206", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_akishima", name: "昭島市", code: "13207", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_chofu", name: "調布市", code: "13208", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_machida", name: "町田市", code: "13209", area_code: "042", ma_name: "町田MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_koganei", name: "小金井市", code: "13210", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_kodaira", name: "小平市", code: "13211", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_hino", name: "日野市", code: "13212", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_higashimurayama", name: "東村山市", code: "13213", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_kokubunji", name: "国分寺市", code: "13214", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_kunitachi", name: "国立市", code: "13215", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_fussa", name: "福生市", code: "13218", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_komae", name: "狛江市", code: "13219", area_code: "03", ma_name: "東京MA", region: "多摩", tags: ["多摩", "03地区"] },
  { id: "tokyo_higashiyamato", name: "東大和市", code: "13220", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_kiyose", name: "清瀬市", code: "13221", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_higashikurume", name: "東久留米市", code: "13222", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_musashimurayama", name: "武蔵村山市", code: "13223", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_tama", name: "多摩市", code: "13224", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_inagi", name: "稲城市", code: "13225", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_hamura", name: "羽村市", code: "13227", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_akiruno", name: "あきる野市", code: "13228", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_nishitokyo", name: "西東京市", code: "13229", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_mizuho", name: "瑞穂町", code: "13303", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_hinode", name: "日の出町", code: "13305", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_hinohara", name: "檜原村", code: "13307", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩", "村"] },
  { id: "tokyo_okutama", name: "奥多摩町", code: "13308", area_code: "0428", ma_name: "青梅MA", region: "多摩", tags: ["多摩"] }
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
  if (name.length >= 5) return 8.2;
  if (name.length >= 4) return 8.8;
  return 9.6;
}

async function fetchAdmin(code) {
  const res = await fetch(`${SOURCE}/13/${code}.json`);
  if (!res.ok) throw new Error(`${code}: ${res.status} ${res.statusText}`);
  return res.json();
}

const features = [];

for (const admin of admins) {
  const code = admin.code;
  try {
    const collection = await fetchAdmin(code);
    for (const feature of collection.features) {
      const props = {
        ...admin,
        sourceCode: code,
        labelPoint: labelPoint(feature.geometry),
        labelAngle: admin.name.length >= 5 ? -18 : -25,
        labelSize: labelSize(admin.name)
      };
      delete props.code;
      features.push({ type: "Feature", properties: props, geometry: feature.geometry });
    }
    console.log(`fetched ${code} (${admin.name})`);
  } catch (e) {
    console.error(`failed to fetch ${code} (${admin.name}): ${e.message}`);
  }
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "tokyo", name: "東京都", code: "13" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, ...rest }) => rest),
  features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.TOKYO_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`wrote ${OUTPUT} (${features.length} drawable features, ${admins.length} quiz answers)`);
