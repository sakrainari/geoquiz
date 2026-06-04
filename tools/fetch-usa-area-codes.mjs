import { resolve } from 'node:path';
import {
  fetchJson,
  resolveProjectRoot,
  writeTextFile,
  writeWindowAssignment
} from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);
const SOURCE_URL = 'https://super-duper.fr/geojson/usa_areacodes.geojson';
const EXCLUDED_STATES = new Set(['AS', 'GU', 'MP', 'PR', 'VI']);
const DIGIT_READINGS = {
  '0': 'ゼロ',
  '1': 'いち',
  '2': 'に',
  '3': 'さん',
  '4': 'よん',
  '5': 'ご',
  '6': 'ろく',
  '7': 'なな',
  '8': 'はち',
  '9': 'きゅう'
};

function areaCodeLabel(areaCodes) {
  return areaCodes.map(String).join(' / ');
}

function areaCodeId(areaCodes) {
  return `usa_area_codes_${areaCodes.map(String).join('_')}`;
}

function geometryToPolygons(geometry) {
  if (!geometry || !geometry.type) return [];
  if (geometry.type === 'Polygon') return [geometry.coordinates];
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.slice();
  return [];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function average(values) {
  if (!values.length) return null;
  const sum = values.reduce((total, value) => total + value, 0);
  return +(sum / values.length).toFixed(6);
}

function buildSpeechReading(name) {
  return name
    .split('/')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.split('').map((char) => DIGIT_READINGS[char] || char).join(' '))
    .join(' と ');
}

async function main() {
  const geojson = await fetchJson(SOURCE_URL, 'USA area codes GeoJSON');
  const sourceFeatures = Array.isArray(geojson.features) ? geojson.features : [];
  console.log(`   全フィーチャー数: ${sourceFeatures.length}`);

  const grouped = new Map();

  for (const feature of sourceFeatures) {
    const properties = feature?.properties || {};
    const state = String(properties.STATE || '').trim();
    if (!state || EXCLUDED_STATES.has(state)) continue;

    const areaCodes = Array.isArray(properties.AreaCode)
      ? properties.AreaCode.map((code) => String(code).trim()).filter(Boolean)
      : [String(properties.AreaCode || '').trim()].filter(Boolean);

    if (!areaCodes.length) continue;

    const key = areaCodeLabel(areaCodes);
    const existing = grouped.get(key) || {
      areaCodes,
      states: new Set(),
      cities: [],
      polygons: [],
      labelXs: [],
      labelYs: []
    };

    existing.states.add(state);
    if (properties.City) existing.cities.push(String(properties.City));
    existing.polygons.push(...geometryToPolygons(feature.geometry));
    if (Number.isFinite(properties.labelx)) existing.labelXs.push(properties.labelx);
    if (Number.isFinite(properties.labely)) existing.labelYs.push(properties.labely);
    grouped.set(key, existing);
  }

  const groups = [...grouped.values()].sort((a, b) => {
    const aFirst = Number(a.areaCodes[0]);
    const bFirst = Number(b.areaCodes[0]);
    if (aFirst !== bFirst) return aFirst - bFirst;
    return areaCodeLabel(a.areaCodes).localeCompare(areaCodeLabel(b.areaCodes));
  });

  const municipalities = [];
  const features = [];
  const speechReadings = {};

  for (const group of groups) {
    const name = areaCodeLabel(group.areaCodes);
    const id = areaCodeId(group.areaCodes);
    const states = [...group.states].sort();
    const cities = uniqueStrings(group.cities);
    const labelPoint = [average(group.labelYs), average(group.labelXs)];

    municipalities.push({
      id,
      name,
      region: states.join(', '),
      tags: cities.slice(0, 6)
    });

    features.push({
      type: 'Feature',
      properties: {
        id,
        name,
        area_code: null,
        region: states.join(', '),
        cities,
        tags: [...states, ...cities].slice(0, 10),
        labelPoint
      },
      geometry: {
        type: 'MultiPolygon',
        coordinates: group.polygons
      }
    });

    speechReadings[name] = buildSpeechReading(name);
  }

  const dataset = {
    id: 'usa_area_codes',
    source: SOURCE_URL,
    generatedAt: new Date().toISOString(),
    municipalities,
    features
  };

  const prefDir = resolve(ROOT, 'data', 'prefectures');
  const datasetDir = resolve(ROOT, 'data', 'usa-area-codes');

  writeWindowAssignment(
    resolve(prefDir, 'usa-area-codes.js'),
    'USA_AREA_CODES_MUNICIPALITIES',
    dataset
  );

  writeTextFile(
    resolve(datasetDir, 'label-overrides.js'),
    'window.USA_AREA_CODES_LABEL_OVERRIDES = {\n  municipalities: {},\n  areaCodes: {}\n};\n'
  );

  writeWindowAssignment(
    resolve(datasetDir, 'speech-readings.js'),
    'USA_AREA_CODES_SPEECH_READINGS',
    speechReadings
  );

  console.log(`\n✅ 生成完了: ${municipalities.length} 問`);
  console.log(`   data/prefectures/usa-area-codes.js`);
  console.log(`   data/usa-area-codes/label-overrides.js`);
  console.log(`   data/usa-area-codes/speech-readings.js`);
}

main().catch((error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});
