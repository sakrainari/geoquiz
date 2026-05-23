import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./simplify-with-mapshaper.mjs";
import { KYUSHU_MUNICIPALITY_SOURCE } from "./kyushu-source.mjs";

const SOURCE = "https://geolonia.github.io/japanese-admins";

export const KYUSHU_PREFECTURE_CONFIGS = {
  fukuoka: {
    prefectureName: "福岡県",
    prefectureCode: "40",
    globalName: "FUKUOKA_MUNICIPALITIES",
    center: [33.59, 130.58],
    initialView: { center: [33.59, 130.58], zoom: 8 },
    simplify: { interval: "85m", weighting: 0.78, minIslandArea: "3500m2", minSliverArea: "4000m2", sliverControl: 0.9 },
    designatedCities: {
      "北九州市": { id: "fukuoka_kitakyushu", kana: "きたきゅうしゅうし", extraTags: ["政令指定都市"] },
      "福岡市": { id: "fukuoka_fukuoka", kana: "ふくおかし", extraTags: ["県庁所在地", "政令指定都市"] }
    },
    areaCodeOverrides: { 久留米市: "0942", 筑後市: "0942", みやま市: "0944", 苅田町: "093", 築上町: "0930" },
    maDefaults: { "092": "福岡MA", "093": "北九州MA", "0930": "行橋MA", "0940": "宗像MA", "0942": "久留米MA", "0943": "八女MA", "0944": "大牟田MA", "0946": "朝倉MA", "0947": "田川MA", "0948": "飯塚MA", "0949": "直方MA", "0979": "中津MA" },
    maOverrides: { うきは市: "田主丸MA", 久留米市: "久留米MA", 広川町: "八女MA", 豊前市: "中津MA", 吉富町: "中津MA", 上毛町: "中津MA" },
    islandNames: []
  },
  saga: {
    prefectureName: "佐賀県",
    prefectureCode: "41",
    globalName: "SAGA_MUNICIPALITIES",
    center: [33.27, 130.12],
    initialView: { center: [33.27, 130.12], zoom: 8 },
    simplify: { interval: "70m", weighting: 0.78, minIslandArea: "2500m2", minSliverArea: "3000m2", sliverControl: 0.9 },
    designatedCities: {},
    areaCodeOverrides: { 基山町: "0942", 上峰町: "0952", みやき町: "0942", 大町町: "0952", 江北町: "0952", 白石町: "0952" },
    maDefaults: { "0942": "鳥栖MA", "0952": "佐賀MA", "0954": "武雄MA", "0955": "唐津MA" },
    maOverrides: { 伊万里市: "伊万里MA", 有田町: "伊万里MA", 鹿島市: "鹿島MA", 太良町: "鹿島MA", 嬉野市: "嬉野MA" },
    islandNames: []
  },
  nagasaki: {
    prefectureName: "長崎県",
    prefectureCode: "42",
    globalName: "NAGASAKI_MUNICIPALITIES",
    center: [32.87, 129.77],
    initialView: { center: [32.87, 129.77], zoom: 8 },
    simplify: { interval: "120m", weighting: 0.78, minIslandArea: "9000m2", minSliverArea: "11000m2", sliverControl: 0.93 },
    designatedCities: {},
    areaCodeOverrides: { 五島市: "0959", 長与町: "095", 時津町: "095", 新上五島町: "0959", 東彼杵町: "0957", 小値賀町: "0959" },
    maDefaults: { "0920": "郷ノ浦MA", "095": "長崎MA", "0950": "平戸MA", "0955": "松浦MA", "0956": "佐世保MA", "0957": "諫早MA", "0959": "五島MA" },
    maOverrides: {
      対馬市: "対馬MA",
      松浦市: "松浦MA",
      島原市: "島原MA",
      大村市: "大村MA",
      雲仙市: "雲仙MA",
      南島原市: "南島原MA",
      東彼杵町: "東彼杵MA",
      小値賀町: "小値賀MA",
      五島市: "五島MA",
      新上五島町: "新上五島MA",
      西海市: "大瀬戸MA"
    },
    islandNames: ["対馬市", "壱岐市", "五島市", "小値賀町", "新上五島町"]
  },
  kumamoto: {
    prefectureName: "熊本県",
    prefectureCode: "43",
    globalName: "KUMAMOTO_MUNICIPALITIES",
    center: [32.66, 130.74],
    initialView: { center: [32.66, 130.74], zoom: 8 },
    simplify: { interval: "80m", weighting: 0.78, minIslandArea: "3500m2", minSliverArea: "4200m2", sliverControl: 0.9 },
    designatedCities: {
      "熊本市": { id: "kumamoto_kumamoto", kana: "くまもとし", extraTags: ["県庁所在地", "政令指定都市"] }
    },
    areaCodeOverrides: {
      玉名市: "0968",
      合志市: "096",
      美里町: "0964",
      大津町: "096",
      菊陽町: "096",
      荒尾市: "0968",
      上天草市: "0964"
    },
    maDefaults: { "0944": "荒尾MA", "096": "熊本MA", "0964": "宇城MA", "0965": "八代MA", "0966": "人吉MA", "0967": "阿蘇MA", "0968": "山鹿MA", "0969": "天草MA" },
    maOverrides: {
      玉名市: "玉名MA",
      宇土市: "宇土MA",
      上天草市: "上天草MA",
      天草市: "天草MA",
      和水町: "和水MA",
      山都町: "山都MA",
      豊後大野市: "三重MA",
      荒尾市: "荒尾MA",
      合志市: "熊本MA",
      大津町: "熊本MA",
      菊陽町: "熊本MA",
      御船町: "熊本MA",
      嘉島町: "熊本MA",
      益城町: "熊本MA",
      甲佐町: "熊本MA",
      苓北町: "天草MA"
    },
    islandNames: ["上天草市", "天草市", "苓北町"]
  },
  oita: {
    prefectureName: "大分県",
    prefectureCode: "44",
    globalName: "OITA_MUNICIPALITIES",
    center: [33.23, 131.43],
    initialView: { center: [33.23, 131.43], zoom: 8 },
    simplify: { interval: "75m", weighting: 0.78, minIslandArea: "2500m2", minSliverArea: "3000m2", sliverControl: 0.9 },
    designatedCities: {},
    areaCodeOverrides: { 杵築市: "0977" },
    maDefaults: { "097": "大分MA", "0972": "佐伯MA", "0973": "日田MA", "0974": "三重MA", "0977": "別府MA", "0978": "国東MA", "0979": "中津MA" },
    maOverrides: {
      臼杵市: "臼杵MA",
      竹田市: "竹田MA",
      豊後高田市: "豊後高田MA",
      杵築市: "杵築MA",
      宇佐市: "宇佐MA",
      豊後大野市: "三重MA",
      由布市: "由布MA",
      姫島村: "姫島MA",
      国東市: "国東MA"
    },
    islandNames: ["姫島村"]
  },
  miyazaki: {
    prefectureName: "宮崎県",
    prefectureCode: "45",
    globalName: "MIYAZAKI_MUNICIPALITIES",
    center: [32.01, 131.31],
    initialView: { center: [32.01, 131.31], zoom: 8 },
    simplify: { interval: "80m", weighting: 0.78, minIslandArea: "2500m2", minSliverArea: "3000m2", sliverControl: 0.9 },
    designatedCities: {},
    areaCodeOverrides: { 高鍋町: "0983", 新富町: "0983", 西米良村: "0983", 木城町: "0983", 川南町: "0983", 都農町: "0983", 門川町: "0982", 諸塚村: "0982", 椎葉村: "0982", 美郷町: "0982" },
    maDefaults: { "0982": "延岡MA", "0983": "西都MA", "0984": "小林MA", "0985": "宮崎MA", "0986": "都城MA", "0987": "日南MA" },
    maOverrides: {
      日向市: "日向MA",
      高千穂町: "高千穂MA",
      日之影町: "高千穂MA",
      五ヶ瀬町: "高千穂MA",
      椎葉村: "高千穂MA",
      門川町: "日向MA",
      諸塚村: "日向MA",
      美郷町: "日向MA"
    },
    islandNames: []
  },
  kagoshima: {
    prefectureName: "鹿児島県",
    prefectureCode: "46",
    globalName: "KAGOSHIMA_MUNICIPALITIES",
    center: [31.45, 130.63],
    initialView: { center: [31.45, 130.63], zoom: 7 },
    simplify: { interval: "125m", weighting: 0.78, minIslandArea: "10000m2", minSliverArea: "12000m2", sliverControl: 0.93 },
    designatedCities: {},
    areaCodeOverrides: { 鹿屋市: "0994", 薩摩川内市: "0996", 曽於市: "0986", 霧島市: "0995", 日置市: "099", 志布志市: "099", さつま町: "0996" },
    maDefaults: { "0986": "都城MA", "099": "鹿児島MA", "09912": "十島MA", "09913": "三島MA", "0993": "指宿MA", "0994": "鹿屋MA", "0995": "加治木MA", "0996": "出水MA", "09969": "甑島MA", "0997": "名瀬MA" },
    maOverrides: {
      曽於市: "曽於MA",
      志布志市: "志布志MA",
      霧島市: "加治木MA",
      姶良市: "加治木MA",
      湧水町: "加治木MA",
      西之表市: "種子島MA",
      中種子町: "種子島MA",
      南種子町: "種子島MA",
      屋久島町: "屋久島MA",
      奄美市: "名瀬MA",
      大和村: "名瀬MA",
      宇検村: "名瀬MA",
      龍郷町: "名瀬MA",
      喜界町: "名瀬MA",
      瀬戸内町: "古仁屋MA",
      徳之島町: "徳之島MA",
      天城町: "徳之島MA",
      伊仙町: "徳之島MA",
      和泊町: "沖永良部MA",
      知名町: "沖永良部MA",
      与論町: "与論MA"
    },
    islandNames: [
      "三島村",
      "十島村",
      "薩摩川内市",
      "西之表市",
      "中種子町",
      "南種子町",
      "屋久島町",
      "奄美市",
      "大和村",
      "宇検村",
      "瀬戸内町",
      "龍郷町",
      "喜界町",
      "徳之島町",
      "天城町",
      "伊仙町",
      "和泊町",
      "知名町",
      "与論町"
    ]
  }
};

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

function stripMaSuffix(maName) {
  return maName.replace(/MA$/, "");
}

async function loadAreaCodeMaster() {
  const source = await readFile("data/area-code-master.js", "utf8");
  const context = { window: {} };
  vm.createContext(context);
  new vm.Script(source, { filename: "data/area-code-master.js" }).runInContext(context);
  return context.window.AREA_CODE_MASTER;
}

function buildEntities(datasetId, config) {
  const sourceRows = KYUSHU_MUNICIPALITY_SOURCE[config.prefectureName];
  const usedCodes = new Set();
  const entities = [];

  for (const row of sourceRows) {
    if (usedCodes.has(row.code)) continue;
    const cityConfig = row.parent ? config.designatedCities[row.parent] : null;
    if (cityConfig) {
      const wards = sourceRows.filter((entry) => entry.parent === row.parent);
      wards.forEach((ward) => usedCodes.add(ward.code));
      entities.push({
        id: cityConfig.id,
        name: row.parent,
        kana: cityConfig.kana,
        codes: wards.map((ward) => ward.code),
        parent: null,
        extraTags: cityConfig.extraTags ?? []
      });
      continue;
    }
    usedCodes.add(row.code);
    entities.push({
      id: `${datasetId}_${row.code}`,
      name: row.name,
      kana: row.kana,
      code: row.code,
      parent: row.parent ?? null,
      extraTags: []
    });
  }

  return entities;
}

function findAreaCodeCandidates(areaCodeMaster, prefectureName, entity) {
  const county = entity.parent && /郡$/.test(entity.parent) ? entity.parent : "";
  return areaCodeMaster
    .filter((entry) => entry.prefectures.includes(prefectureName))
    .map((entry) => {
      let score = 0;
      if (entry.summary.includes(`${prefectureName}${entity.name}`)) score += 10;
      if (county && entry.summary.includes(county)) score += 6;
      if (entry.summary.includes(entity.name)) score += 3;
      return score ? { code: entry.code, score } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.code.localeCompare(b.code));
}

function buildMunicipalityMeta(config, areaCodeMaster) {
  return buildEntities(config.prefectureCode, config).map((entity) => {
    const area_code =
      config.areaCodeOverrides[entity.name] ??
      findAreaCodeCandidates(areaCodeMaster, config.prefectureName, entity)[0]?.code;
    if (!area_code) throw new Error(`No area code candidate for ${config.prefectureName} ${entity.name}`);

    const ma_name =
      config.maOverrides[entity.name] ??
      config.maDefaults[area_code] ??
      `${entity.name.replace(/[市町村]$/, "")}MA`;
    const region = stripMaSuffix(ma_name);
    const tags = [area_code, region, ...entity.extraTags];
    if (config.islandNames.includes(entity.name)) tags.push("島");
    if (entity.name.endsWith("村")) tags.push("村");

    return {
      id: entity.id,
      name: entity.name,
      kana: entity.kana,
      ...(entity.codes ? { codes: entity.codes } : { code: entity.code }),
      area_code,
      ma_name,
      region,
      tags: [...new Set(tags)]
    };
  });
}

async function fetchAdmin(prefectureCode, code) {
  const res = await fetch(`${SOURCE}/${prefectureCode}/${code}.json`);
  if (!res.ok) throw new Error(`${prefectureCode}/${code}: ${res.status} ${res.statusText}`);
  return res.json();
}

function speechReadingsFromMunicipalities(municipalities) {
  return Object.fromEntries(municipalities.map((municipality) => [municipality.name, municipality.kana]));
}

export async function buildKyushuPrefectureDataset(datasetId) {
  const config = KYUSHU_PREFECTURE_CONFIGS[datasetId];
  if (!config) throw new Error(`Unknown Kyushu dataset: ${datasetId}`);

  const areaCodeMaster = await loadAreaCodeMaster();
  const municipalities = buildMunicipalityMeta(config, areaCodeMaster);
  const features = [];

  for (const municipality of municipalities) {
    const codes = municipality.codes ?? [municipality.code];
    for (const code of codes) {
      const collection = await fetchAdmin(config.prefectureCode, code);
      for (const feature of collection.features) {
        const geometry = feature.geometry;
        const properties = {
          ...municipality,
          sourceCode: code,
          labelPoint: labelPoint(geometry),
          labelAngle: municipality.name.length >= 5 ? -18 : -25,
          labelSize: labelSize(municipality.name)
        };
        delete properties.code;
        delete properties.codes;
        delete properties.kana;
        features.push({ type: "Feature", properties, geometry });
      }
      console.log(`fetched ${datasetId} ${code}`);
    }
  }

  const rawFeatureCollection = { type: "FeatureCollection", features };
  const rawVertexCount = countFeatureVertices(rawFeatureCollection);
  const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(rawFeatureCollection, config.simplify);
  for (const feature of simplifiedFeatureCollection.features) feature.properties.labelPoint = labelPoint(feature.geometry);
  const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

  const payload = {
    type: "FeatureCollection",
    source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
    prefecture: { id: datasetId, name: config.prefectureName, code: config.prefectureCode },
    generatedAt: new Date().toISOString(),
    municipalities: municipalities.map(({ code, codes, kana, ...rest }) => rest),
    features: simplifiedFeatureCollection.features
  };

  await mkdir("data/prefectures", { recursive: true });
  await mkdir(`data/${datasetId}`, { recursive: true });
  await writeFile(`data/prefectures/${datasetId}.js`, `window.${config.globalName} = ${JSON.stringify(payload)};\n`, "utf8");
  await writeFile(
    `data/${datasetId}/label-overrides.js`,
    `window.${config.globalName.replace("_MUNICIPALITIES", "_LABEL_OVERRIDES")} = ${JSON.stringify({ municipalities: {}, areaCodes: {} }, null, 2)};\n`,
    "utf8"
  );
  await writeFile(
    `data/${datasetId}/speech-readings.js`,
    `window.${config.globalName.replace("_MUNICIPALITIES", "_SPEECH_READINGS")} = ${JSON.stringify(
      speechReadingsFromMunicipalities(municipalities),
      null,
      2
    )};\n`,
    "utf8"
  );

  console.log(
    `wrote data/prefectures/${datasetId}.js (${simplifiedFeatureCollection.features.length} drawable features, ${municipalities.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
  );
}
