import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./simplify-with-mapshaper.mjs";

const SOURCE = "https://geolonia.github.io/japanese-admins";
const MUNICIPALITY_TSV_URL = "https://raw.githubusercontent.com/OtterSou/japan-municipalities/main/0-all.tsv";

export const CHUBU_PREFECTURE_CONFIGS = {
  niigata: {
    prefectureName: "新潟県",
    prefectureCode: "15",
    globalName: "NIIGATA_MUNICIPALITIES",
    center: [37.88, 138.97],
    initialView: { center: [37.88, 138.97], zoom: 8 },
    simplify: { interval: "95m", weighting: 0.78, minIslandArea: "4000m2", minSliverArea: "4500m2", sliverControl: 0.9 },
    designatedCities: {
      "新潟市": { id: "niigata_niigata", extraTags: ["県庁所在地", "政令指定都市"] }
    },
    fallbackAreaCode: "025",
    areaCodeOverrides: {
      佐渡市: "0259",
      妙高市: "0255",
      柏崎市: "0257",
      魚沼市: "02579"
    }
  },
  toyama: {
    prefectureName: "富山県",
    prefectureCode: "16",
    globalName: "TOYAMA_MUNICIPALITIES",
    center: [36.69, 137.21],
    initialView: { center: [36.69, 137.21], zoom: 8 },
    simplify: { interval: "75m", weighting: 0.78, minIslandArea: "2500m2", minSliverArea: "3000m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "076",
    areaCodeOverrides: {}
  },
  ishikawa: {
    prefectureName: "石川県",
    prefectureCode: "17",
    globalName: "ISHIKAWA_MUNICIPALITIES",
    center: [36.82, 136.8],
    initialView: { center: [36.82, 136.8], zoom: 8 },
    simplify: { interval: "80m", weighting: 0.78, minIslandArea: "2800m2", minSliverArea: "3200m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "076",
    areaCodeOverrides: {}
  },
  fukui: {
    prefectureName: "福井県",
    prefectureCode: "18",
    globalName: "FUKUI_MUNICIPALITIES",
    center: [35.8, 136.22],
    initialView: { center: [35.8, 136.22], zoom: 8 },
    simplify: { interval: "80m", weighting: 0.78, minIslandArea: "2800m2", minSliverArea: "3200m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "0776",
    areaCodeOverrides: {}
  },
  yamanashi: {
    prefectureName: "山梨県",
    prefectureCode: "19",
    globalName: "YAMANASHI_MUNICIPALITIES",
    center: [35.61, 138.61],
    initialView: { center: [35.61, 138.61], zoom: 8 },
    simplify: { interval: "75m", weighting: 0.78, minIslandArea: "2500m2", minSliverArea: "3000m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "055",
    areaCodeOverrides: {
      丹波山村: "0428"
    }
  },
  nagano: {
    prefectureName: "長野県",
    prefectureCode: "20",
    globalName: "NAGANO_MUNICIPALITIES",
    center: [36.13, 138.04],
    initialView: { center: [36.13, 138.04], zoom: 8 },
    simplify: { interval: "85m", weighting: 0.78, minIslandArea: "2800m2", minSliverArea: "3200m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "026",
    areaCodeOverrides: {}
  },
  gifu: {
    prefectureName: "岐阜県",
    prefectureCode: "21",
    globalName: "GIFU_MUNICIPALITIES",
    center: [35.78, 136.9],
    initialView: { center: [35.78, 136.9], zoom: 8 },
    simplify: { interval: "85m", weighting: 0.78, minIslandArea: "3000m2", minSliverArea: "3500m2", sliverControl: 0.9 },
    designatedCities: {},
    fallbackAreaCode: "058",
    areaCodeOverrides: {
      飛騨市: "0577",
      白川村: "05769"
    }
  },
  shizuoka: {
    prefectureName: "静岡県",
    prefectureCode: "22",
    globalName: "SHIZUOKA_MUNICIPALITIES",
    center: [35.0, 138.38],
    initialView: { center: [35.0, 138.38], zoom: 8 },
    simplify: { interval: "90m", weighting: 0.78, minIslandArea: "3000m2", minSliverArea: "3500m2", sliverControl: 0.9 },
    designatedCities: {
      "静岡市": { id: "shizuoka_shizuoka", extraTags: ["県庁所在地", "政令指定都市"] },
      "浜松市": {
        id: "shizuoka_hamamatsu",
        extraTags: ["政令指定都市"],
        codes: ["22131", "22132", "22133", "22134", "22135", "22136", "22137"]
      }
    },
    fallbackAreaCode: "054",
    areaCodeOverrides: {
      湖西市: "053",
      下田市: "0558",
      熱海市: "0557",
      伊東市: "0557"
    }
  },
  aichi: {
    prefectureName: "愛知県",
    prefectureCode: "23",
    globalName: "AICHI_MUNICIPALITIES",
    center: [35.03, 137.03],
    initialView: { center: [35.03, 137.03], zoom: 8 },
    simplify: { interval: "85m", weighting: 0.78, minIslandArea: "2800m2", minSliverArea: "3200m2", sliverControl: 0.9 },
    designatedCities: {
      "名古屋市": { id: "aichi_nagoya", extraTags: ["県庁所在地", "政令指定都市"] }
    },
    fallbackAreaCode: "052",
    areaCodeOverrides: {
      豊橋市: "0532",
      豊川市: "0533",
      田原市: "0531",
      岡崎市: "0564",
      豊田市: "0565",
      一宮市: "0586"
    }
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
  const usedDesignatedCities = new Set();
  const entities = [];

  for (const row of sourceRows) {
    if (usedCodes.has(row.code)) continue;
    const cityConfig = row.parent ? config.designatedCities[row.parent] : null;
    if (cityConfig) {
      if (usedDesignatedCities.has(row.parent)) continue;
      usedDesignatedCities.add(row.parent);
      const wardCodes = cityConfig.codes ?? sourceRows.filter((entry) => entry.parent === row.parent).map((entry) => entry.code);
      wardCodes.forEach((code) => usedCodes.add(code));
      entities.push({
        id: cityConfig.id,
        name: row.parent,
        codes: wardCodes,
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

export async function buildChubuPrefectureDataset(datasetId) {
  const config = CHUBU_PREFECTURE_CONFIGS[datasetId];
  if (!config) throw new Error(`Unknown Chubu dataset: ${datasetId}`);

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
