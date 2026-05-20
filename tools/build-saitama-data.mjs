import { mkdir, writeFile } from "node:fs/promises";

const OUTPUT = "data/prefectures/saitama.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const admins = [
  { id: "saitama_saitama", name: "さいたま市", codes: ["11101", "11102", "11103", "11104", "11105", "11106", "11107", "11108", "11109", "11110"], area_code: "048", ma_name: "浦和MA", region: "さいたま", tags: ["県庁所在地", "政令指定都市", "048"] },
  { id: "saitama_kawagoe", name: "川越市", code: "11201", area_code: "049", ma_name: "川越MA", region: "南西部", tags: ["川越MA", "小江戸"] },
  { id: "saitama_kumagaya", name: "熊谷市", code: "11202", area_code: "048", ma_name: "熊谷MA", region: "北部", tags: ["熊谷MA", "高崎線"] },
  { id: "saitama_kawaguchi", name: "川口市", code: "11203", area_code: "048", ma_name: "川口MA", region: "南部", tags: ["東京寄り", "048"] },
  { id: "saitama_gyoda", name: "行田市", code: "11206", area_code: "048", ma_name: "熊谷MA", region: "北部", tags: ["熊谷MA"] },
  { id: "saitama_chichibu", name: "秩父市", code: "11207", area_code: "0494", ma_name: "秩父MA", region: "秩父", tags: ["秩父MA", "山地"] },
  { id: "saitama_tokorozawa", name: "所沢市", code: "11208", area_code: "04", ma_name: "所沢MA", region: "南西部", tags: ["所沢MA", "西武線沿線", "東京寄り"] },
  { id: "saitama_hanno", name: "飯能市", code: "11209", area_code: "042", ma_name: "飯能MA", region: "南西部", tags: ["飯能MA", "山地"] },
  { id: "saitama_kazo", name: "加須市", code: "11210", area_code: "0480", ma_name: "久喜MA", region: "利根", tags: ["0480", "利根川"] },
  { id: "saitama_honjo", name: "本庄市", code: "11211", area_code: "0495", ma_name: "本庄MA", region: "北部", tags: ["0495", "上越新幹線"] },
  { id: "saitama_higashimatsuyama", name: "東松山市", code: "11212", area_code: "0493", ma_name: "東松山MA", region: "比企", tags: ["0493", "比企"] },
  { id: "saitama_kasukabe", name: "春日部市", code: "11214", area_code: "048", ma_name: "春日部MA", region: "東部", tags: ["東武線", "048"] },
  { id: "saitama_sayama", name: "狭山市", code: "11215", area_code: "04", ma_name: "所沢MA", region: "南西部", tags: ["所沢MA", "西武線沿線"] },
  { id: "saitama_hanyu", name: "羽生市", code: "11216", area_code: "048", ma_name: "熊谷MA", region: "北部", tags: ["利根川", "048"] },
  { id: "saitama_konosu", name: "鴻巣市", code: "11217", area_code: "048", ma_name: "熊谷MA", region: "北部", tags: ["中山道", "048"] },
  { id: "saitama_fukaya", name: "深谷市", code: "11218", area_code: "048", ma_name: "熊谷MA", region: "北部", tags: ["熊谷MA", "高崎線"] },
  { id: "saitama_ageo", name: "上尾市", code: "11219", area_code: "048", ma_name: "上尾MA", region: "県央", tags: ["048", "高崎線"] },
  { id: "saitama_soka", name: "草加市", code: "11221", area_code: "048", ma_name: "草加MA", region: "南東部", tags: ["東京寄り", "048"] },
  { id: "saitama_koshigaya", name: "越谷市", code: "11222", area_code: "048", ma_name: "越谷MA", region: "東部", tags: ["048", "東武線"] },
  { id: "saitama_warabi", name: "蕨市", code: "11223", area_code: "048", ma_name: "川口MA", region: "南部", tags: ["小面積", "048"] },
  { id: "saitama_toda", name: "戸田市", code: "11224", area_code: "048", ma_name: "川口MA", region: "南部", tags: ["荒川", "048"] },
  { id: "saitama_iruma", name: "入間市", code: "11225", area_code: "04", ma_name: "所沢MA", region: "南西部", tags: ["所沢MA", "西武線沿線"] },
  { id: "saitama_asaka", name: "朝霞市", code: "11227", area_code: "048", ma_name: "川口MA", region: "南西部", tags: ["東京寄り", "048"] },
  { id: "saitama_shiki", name: "志木市", code: "11228", area_code: "048", ma_name: "川口MA", region: "南西部", tags: ["東武東上線", "048"] },
  { id: "saitama_wako", name: "和光市", code: "11229", area_code: "048", ma_name: "川口MA", region: "南西部", tags: ["東京寄り", "048"] },
  { id: "saitama_niiza", name: "新座市", code: "11230", area_code: "048", ma_name: "川口MA", region: "南西部", tags: ["東京寄り", "048"] },
  { id: "saitama_okegawa", name: "桶川市", code: "11231", area_code: "048", ma_name: "上尾MA", region: "県央", tags: ["高崎線", "048"] },
  { id: "saitama_kuki", name: "久喜市", code: "11232", area_code: "0480", ma_name: "久喜MA", region: "東部", tags: ["0480", "東北道"] },
  { id: "saitama_kitamoto", name: "北本市", code: "11233", area_code: "048", ma_name: "上尾MA", region: "県央", tags: ["高崎線", "048"] },
  { id: "saitama_yashio", name: "八潮市", code: "11234", area_code: "048", ma_name: "草加MA", region: "南東部", tags: ["つくばエクスプレス", "048"] },
  { id: "saitama_fujimi", name: "富士見市", code: "11235", area_code: "049", ma_name: "川越MA", region: "南西部", tags: ["東武東上線", "049"] },
  { id: "saitama_misato", name: "三郷市", code: "11237", area_code: "048", ma_name: "草加MA", region: "南東部", tags: ["県境", "048"] },
  { id: "saitama_hasuda", name: "蓮田市", code: "11238", area_code: "048", ma_name: "上尾MA", region: "県央", tags: ["宇都宮線", "048"] },
  { id: "saitama_sakado", name: "坂戸市", code: "11239", area_code: "049", ma_name: "川越MA", region: "南西部", tags: ["東武東上線", "049"] },
  { id: "saitama_satte", name: "幸手市", code: "11240", area_code: "0480", ma_name: "久喜MA", region: "東部", tags: ["0480", "県境"] },
  { id: "saitama_tsurugashima", name: "鶴ヶ島市", code: "11241", area_code: "049", ma_name: "川越MA", region: "南西部", tags: ["049", "東武東上線"] },
  { id: "saitama_hidaka", name: "日高市", code: "11242", area_code: "042", ma_name: "飯能MA", region: "南西部", tags: ["042", "高麗"] },
  { id: "saitama_yoshikawa", name: "吉川市", code: "11243", area_code: "048", ma_name: "越谷MA", region: "南東部", tags: ["048", "中川"] },
  { id: "saitama_fujimino", name: "ふじみ野市", code: "11245", area_code: "049", ma_name: "川越MA", region: "南西部", tags: ["049", "東武東上線"] },
  { id: "saitama_shiraoka", name: "白岡市", code: "11246", area_code: "0480", ma_name: "久喜MA", region: "東部", tags: ["0480", "宇都宮線"] },
  { id: "saitama_ina", name: "伊奈町", code: "11301", area_code: "048", ma_name: "上尾MA", region: "県央", tags: ["ニューシャトル", "048"] },
  { id: "saitama_miyoshi", name: "三芳町", code: "11324", area_code: "049", ma_name: "川越MA", region: "南西部", tags: ["049", "所沢隣接"] },
  { id: "saitama_moroyama", name: "毛呂山町", code: "11326", area_code: "049", ma_name: "川越MA", region: "入間", tags: ["049", "八高線"] },
  { id: "saitama_ogose", name: "越生町", code: "11327", area_code: "049", ma_name: "川越MA", region: "入間", tags: ["049", "梅林"] },
  { id: "saitama_namegawa", name: "滑川町", code: "11341", area_code: "0493", ma_name: "東松山MA", region: "比企", tags: ["0493", "森林公園"] },
  { id: "saitama_ranzan", name: "嵐山町", code: "11342", area_code: "0493", ma_name: "東松山MA", region: "比企", tags: ["0493", "比企"] },
  { id: "saitama_ogawa", name: "小川町", code: "11343", area_code: "0493", ma_name: "東松山MA", region: "比企", tags: ["0493", "和紙"] },
  { id: "saitama_kawajima", name: "川島町", code: "11346", area_code: "049", ma_name: "川越MA", region: "比企", tags: ["049", "荒川"] },
  { id: "saitama_yoshimi", name: "吉見町", code: "11347", area_code: "0493", ma_name: "東松山MA", region: "比企", tags: ["0493", "比企"] },
  { id: "saitama_hatoyama", name: "鳩山町", code: "11348", area_code: "049", ma_name: "川越MA", region: "比企", tags: ["049", "比企"] },
  { id: "saitama_tokigawa", name: "ときがわ町", code: "11349", area_code: "0493", ma_name: "東松山MA", region: "比企", tags: ["0493", "山地"] },
  { id: "saitama_yokoze", name: "横瀬町", code: "11361", area_code: "0494", ma_name: "秩父MA", region: "秩父", tags: ["0494", "武甲山"] },
  { id: "saitama_minano", name: "皆野町", code: "11362", area_code: "0494", ma_name: "秩父MA", region: "秩父", tags: ["0494", "秩父"] },
  { id: "saitama_nagatoro", name: "長瀞町", code: "11363", area_code: "0494", ma_name: "秩父MA", region: "秩父", tags: ["0494", "荒川"] },
  { id: "saitama_ogano", name: "小鹿野町", code: "11365", area_code: "0494", ma_name: "秩父MA", region: "秩父", tags: ["0494", "山地"] },
  { id: "saitama_higashichichibu", name: "東秩父村", code: "11369", area_code: "0493", ma_name: "東松山MA", region: "秩父", tags: ["村", "0493"] },
  { id: "saitama_misato_town", name: "美里町", code: "11381", area_code: "0495", ma_name: "本庄MA", region: "児玉", tags: ["0495", "児玉"] },
  { id: "saitama_kamikawa", name: "神川町", code: "11383", area_code: "0495", ma_name: "本庄MA", region: "児玉", tags: ["0495", "県境"] },
  { id: "saitama_kamisato", name: "上里町", code: "11385", area_code: "0495", ma_name: "本庄MA", region: "児玉", tags: ["0495", "県境"] },
  { id: "saitama_yorii", name: "寄居町", code: "11408", area_code: "048", ma_name: "熊谷MA", region: "大里", tags: ["048", "荒川"] },
  { id: "saitama_miyashiro", name: "宮代町", code: "11442", area_code: "0480", ma_name: "久喜MA", region: "東部", tags: ["0480", "東武線"] },
  { id: "saitama_sugito", name: "杉戸町", code: "11464", area_code: "0480", ma_name: "久喜MA", region: "東部", tags: ["0480", "東武線"] },
  { id: "saitama_matsubushi", name: "松伏町", code: "11465", area_code: "048", ma_name: "越谷MA", region: "東部", tags: ["048", "中川"] }
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
  const res = await fetch(`${SOURCE}/11/${code}.json`);
  if (!res.ok) throw new Error(`${code}: ${res.status} ${res.statusText}`);
  return res.json();
}

const features = [];

for (const admin of admins) {
  const codes = admin.codes ?? [admin.code];
  for (const code of codes) {
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
      delete props.codes;
      features.push({ type: "Feature", properties: props, geometry: feature.geometry });
    }
    console.log(`fetched ${code}`);
  }
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "saitama", name: "埼玉県", code: "11" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.SAITAMA_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(`wrote ${OUTPUT} (${features.length} drawable features, ${admins.length} quiz answers)`);
