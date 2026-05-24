import { mkdir, readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";
import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./simplify-with-mapshaper.mjs";

const SOURCE = "https://geolonia.github.io/japanese-admins";
const MUNICIPALITY_TSV_URL = "https://raw.githubusercontent.com/OtterSou/japan-municipalities/main/0-all.tsv";

export const TOHOKU_PREFECTURE_CONFIGS = {
  aomori: {
    prefectureName: "青森県",
    prefectureCode: "02",
    globalName: "AOMORI_MUNICIPALITIES",
    center: [40.82, 140.74],
    initialView: { center: [40.82, 140.74], zoom: 8 },
    simplify: { interval: "90m", weighting: 0.78, minIslandArea: "3500m2", minSliverArea: "4000m2", sliverControl: 0.9 },
    designatedCities: {},
    areaCodeOverrides: {}
  },
  iwate: {
    prefectureName: "岩手県",
    prefectureCode: "03",
    globalName: "IWATE_MUNICIPALITIES",
    center: [39.7, 141.3],
    initialView: { center: [39.7, 141.3], zoom: 8 },
    simplify: { interval: "95m", weighting: 0.78, minIslandArea: "3500m2", minSliverArea: "4200m2", sliverControl: 0.9 },
    designatedCities: {},
    areaCodeOverrides: {}
  },
  miyagi: {
    prefectureName: "宮城県",
    prefectureCode: "04",
    globalName: "MIYAGI_MUNICIPALITIES",
    center: [38.45, 140.93],
    initialView: { center: [38.45, 140.93], zoom: 8 },
    simplify: { interval: "85m", weighting: 0.78, minIslandArea: "3000m2", minSliverArea: "3500m2", sliverControl: 0.9 },
    designatedCities: {
      "仙台市": { id: "miyagi_sendai", extraTags: ["県庁所在地", "政令指定都市"] }
    },
    areaCodeOverrides: {}
  },
  akita: {
    prefectureName: "秋田県",
    prefectureCode: "05",
    globalName: "AKITA_MUNICIPALITIES",
    center: [39.75, 140.3],
    initialView: { center: [39.75, 140.3], zoom: 8 },
    simplify: { interval: "90m", weighting: 0.78, minIslandArea: "3000m2", minSliverArea: "3500m2", sliverControl: 0.9 },
    designatedCities: {},
    areaCodeOverrides: { 仙北市: "0187" }
  },
  yamagata: {
    prefectureName: "山形県",
    prefectureCode: "06",
    globalName: "YAMAGATA_MUNICIPALITIES",
    center: [38.52, 140.14],
    initialView: { center: [38.52, 140.14], zoom: 8 },
    simplify: { interval: "85m", weighting: 0.78, minIslandArea: "2800m2", minSliverArea: "3200m2", sliverControl: 0.9 },
    designatedCities: {},
    areaCodeOverrides: {}
  },
  fukushima: {
    prefectureName: "福島県",
    prefectureCode: "07",
    globalName: "FUKUSHIMA_MUNICIPALITIES",
    center: [37.41, 140.38],
    initialView: { center: [37.41, 140.38], zoom: 8 },
    simplify: { interval: "95m", weighting: 0.78, minIslandArea: "3500m2", minSliverArea: "4200m2", sliverControl: 0.9 },
    designatedCities: {},
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
      findAreaCodeCandidates(areaCodeMaster, config.prefectureName, entity)[0]?.code;
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

export async function buildTohokuPrefectureDataset(datasetId) {
  const config = TOHOKU_PREFECTURE_CONFIGS[datasetId];
  if (!config) throw new Error(`Unknown Tohoku dataset: ${datasetId}`);

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
