import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./simplify-with-mapshaper.mjs";

const SOURCE = "https://geolonia.github.io/japanese-admins";
const MUNICIPALITY_TSV_URL = "https://raw.githubusercontent.com/OtterSou/japan-municipalities/main/0-all.tsv";

export const KINKI_PREFECTURE_CONFIGS = {
  mie: {
    prefectureName: "三重県",
    prefectureCode: "24",
    globalName: "MIE_MUNICIPALITIES",
    center: [34.52, 136.43],
    initialView: { center: [34.52, 136.43], zoom: 8 },
    simplify: { interval: "85m", weighting: 0.78, minIslandArea: "3000m2", minSliverArea: "3500m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "059",
    areaCodeOverrides: { 木曽岬町: "0567", 御浜町: "05979", 紀宝町: "0735" }
  },
  shiga: {
    prefectureName: "滋賀県",
    prefectureCode: "25",
    globalName: "SHIGA_MUNICIPALITIES",
    center: [35.17, 136.07],
    initialView: { center: [35.17, 136.07], zoom: 8 },
    simplify: { interval: "75m", weighting: 0.78, minIslandArea: "2500m2", minSliverArea: "3000m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "077",
    areaCodeOverrides: { 彦根市: "0749", 長浜市: "0749", 近江八幡市: "0748", 甲賀市: "0748", 湖南市: "0748", 東近江市: "0748", 米原市: "0749", 日野町: "0748", 竜王町: "0748", 愛荘町: "0749", 豊郷町: "0749", 甲良町: "0749", 多賀町: "0749", 高島市: "0740" }
  },
  kyoto: {
    prefectureName: "京都府",
    prefectureCode: "26",
    globalName: "KYOTO_MUNICIPALITIES",
    center: [35.15, 135.47],
    initialView: { center: [35.15, 135.47], zoom: 8 },
    simplify: { interval: "85m", weighting: 0.78, minIslandArea: "3000m2", minSliverArea: "3500m2", sliverControl: 0.9 },
    designatedCities: {
      "京都市": { id: "kyoto_kyoto", extraTags: ["府庁所在地", "政令指定都市"] }
    },
    fallbackAreaCode: "075",
    areaCodeOverrides: {}
  },
  osaka: {
    prefectureName: "大阪府",
    prefectureCode: "27",
    globalName: "OSAKA_MUNICIPALITIES",
    center: [34.69, 135.52],
    initialView: { center: [34.69, 135.52], zoom: 9 },
    simplify: { interval: "65m", weighting: 0.78, minIslandArea: "2000m2", minSliverArea: "2500m2", sliverControl: 0.9 },
    designatedCities: {
      "大阪市": { id: "osaka_osaka", extraTags: ["府庁所在地", "政令指定都市"] },
      "堺市": { id: "osaka_sakai", extraTags: ["政令指定都市"] }
    },
    fallbackAreaCode: "072",
    areaCodeOverrides: { 岸和田市: "072", 豊中市: "06", 吹田市: "06", 守口市: "06", 門真市: "06", 池田市: "072", 箕面市: "072", 高槻市: "072", 茨木市: "072", 枚方市: "072", 八尾市: "072", 寝屋川市: "072", 大東市: "072", 柏原市: "072", 泉大津市: "0725", 和泉市: "0725", 富田林市: "0721", 河内長野市: "0721" }
  },
  hyogo: {
    prefectureName: "兵庫県",
    prefectureCode: "28",
    globalName: "HYOGO_MUNICIPALITIES",
    center: [34.87, 134.89],
    initialView: { center: [34.87, 134.89], zoom: 8 },
    simplify: { interval: "90m", weighting: 0.78, minIslandArea: "3200m2", minSliverArea: "3800m2", sliverControl: 0.9 },
    designatedCities: {
      "神戸市": { id: "hyogo_kobe", extraTags: ["県庁所在地", "政令指定都市"] }
    },
    fallbackAreaCode: "079",
    areaCodeOverrides: { 尼崎市: "06", 伊丹市: "072", 西宮市: "0798", 芦屋市: "0797", 宝塚市: "0797", 川西市: "072", 明石市: "078", 洲本市: "0799", 南あわじ市: "0799", 淡路市: "0799", 豊岡市: "0796", 三木市: "0794", 小野市: "0794", 西脇市: "0795", 丹波市: "0795", 加東市: "0795", 宍粟市: "0790", 相生市: "0791", 赤穂市: "0791" }
  },
  nara: {
    prefectureName: "奈良県",
    prefectureCode: "29",
    globalName: "NARA_MUNICIPALITIES",
    center: [34.31, 135.87],
    initialView: { center: [34.31, 135.87], zoom: 8 },
    simplify: { interval: "75m", weighting: 0.78, minIslandArea: "2500m2", minSliverArea: "3000m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "0745",
    areaCodeOverrides: { 大和郡山市: "0743", 山添村: "0743", 奈良市: "0742", 生駒市: "0743", 天理市: "0743", 橿原市: "0744", 桜井市: "0744", 香芝市: "0745", 葛城市: "0745", 御所市: "0745", 大和高田市: "0745", 五條市: "0747", 吉野町: "0746", 十津川村: "0746", 上北山村: "07468", 下北山村: "07468" }
  },
  wakayama: {
    prefectureName: "和歌山県",
    prefectureCode: "30",
    globalName: "WAKAYAMA_MUNICIPALITIES",
    center: [33.95, 135.42],
    initialView: { center: [33.95, 135.42], zoom: 8 },
    simplify: { interval: "85m", weighting: 0.78, minIslandArea: "2800m2", minSliverArea: "3200m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "073",
    areaCodeOverrides: {}
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

async function loadMunicipalitySource(prefectureCode) {
  const res = await fetch(MUNICIPALITY_TSV_URL);
  if (!res.ok) throw new Error(`Failed to load municipality source TSV: ${res.status}`);
  const text = await res.text();
  const [headerLine, ...bodyLines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split("\t");
  const rows = bodyLines.map((line) => Object.fromEntries(line.split("\t").map((value, index) => [headers[index], value])));

  const municipalityCodeToName = new Map(
    rows
      .filter((row) => row.pref === prefectureCode && row.level === "3")
      .map((row) => [row.code, row["full-ja"]])
  );
  const countyCodeToName = new Map(
    rows
      .filter((row) => row.pref === prefectureCode && row.type === "24")
      .map((row) => [row.code, row["full-ja"]])
  );

  const municipalities = rows
    .filter((row) => row.pref === prefectureCode && row.level === "3" && row.type !== "31")
    .map((row) => ({
      code: row.code,
      name: row["full-ja"],
      kana: row["full-ja-hira"],
      parent: row.county ? countyCodeToName.get(row.county) ?? null : null
    }));

  const wards = rows
    .filter((row) => row.pref === prefectureCode && row.level === "4")
    .map((row) => ({
      code: row.code,
      name: row["full-ja"],
      kana: row["full-ja-hira"],
      parent: municipalityCodeToName.get(row.muni) ?? null
    }));

  return [...municipalities, ...wards];
}

function buildEntities(datasetId, sourceRows, config) {
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
        codes: wards.map((ward) => ward.code),
        parent: null,
        extraTags: cityConfig.extraTags ?? [],
        kana: row.kana ?? null
      });
      continue;
    }
    usedCodes.add(row.code);
    entities.push({
      id: `${datasetId}_${row.code}`,
      name: row.name,
      kana: row.kana ?? null,
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

function buildMunicipalityMeta(config, areaCodeMaster, entities) {
  return entities.map((entity) => {
    const area_code =
      config.areaCodeOverrides[entity.name] ??
      findAreaCodeCandidates(areaCodeMaster, config.prefectureName, entity)[0]?.code ??
      config.fallbackAreaCode;
    if (!area_code) throw new Error(`No area code candidate for ${config.prefectureName} ${entity.name}`);

    const ma_name = `${area_code}MA`;
    const region = stripMaSuffix(ma_name);
    const tags = [area_code, region, ...entity.extraTags];
    if (entity.name.endsWith("村")) tags.push("村");

    return {
      id: entity.id,
      name: entity.name,
      kana: entity.kana ?? null,
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
  return Object.fromEntries(
    municipalities
      .filter((municipality) => municipality.kana)
      .map((municipality) => [municipality.name, municipality.kana])
  );
}

export async function buildKinkiPrefectureDataset(datasetId) {
  const config = KINKI_PREFECTURE_CONFIGS[datasetId];
  if (!config) throw new Error(`Unknown Kinki dataset: ${datasetId}`);

  const areaCodeMaster = await loadAreaCodeMaster();
  const sourceRows = await loadMunicipalitySource(config.prefectureCode);
  const entities = buildEntities(datasetId, sourceRows, config);
  const municipalities = buildMunicipalityMeta(config, areaCodeMaster, entities);
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
