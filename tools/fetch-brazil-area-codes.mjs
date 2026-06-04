import { resolve } from 'node:path';
import {
  fetchJson,
  loadBundledTurf,
  resolveProjectRoot,
  simplifyFeatureWithLabel,
  writeTextFile,
  writeWindowAssignment
} from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);
const SOURCE_URL = 'https://super-duper.fr/geojson/brazil_areacodes.geojson';
const DATASET_ID = 'brazil_area_codes';
const DATASET_GLOBAL = 'BRAZIL_AREA_CODES_MUNICIPALITIES';

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

function buildSpeechReading(ddd) {
  const value = Number.parseInt(String(ddd), 10);
  if (!Number.isFinite(value)) {
    return String(ddd)
      .split('')
      .map((char) => DIGIT_READINGS[char] || char)
      .join(' ');
  }

  if (value < 10) return DIGIT_READINGS[String(value)] || String(value);
  if (value === 10) return 'じゅう';

  if (value < 20) {
    const ones = value % 10;
    return `じゅう${DIGIT_READINGS[String(ones)] || ones}`;
  }

  const tens = Math.floor(value / 10);
  const ones = value % 10;
  const tensReading = `${DIGIT_READINGS[String(tens)] || tens}じゅう`;
  if (ones === 0) return tensReading;
  return `${tensReading}${DIGIT_READINGS[String(ones)] || ones}`;
}

function fillGeometryHoles(geometry) {
  if (!geometry || !geometry.type) return geometry;
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.length ? [geometry.coordinates[0]] : []
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon) => (polygon.length ? [polygon[0]] : []))
    };
  }
  return geometry;
}

function normalizeCode(value) {
  return String(value || '').trim();
}

async function main() {
  const geojson = await fetchJson(SOURCE_URL, 'Brazil area codes GeoJSON');
  const sourceFeatures = Array.isArray(geojson.features) ? geojson.features : [];
  console.log(`   全フィーチャー数: ${sourceFeatures.length}`);

  const turf = loadBundledTurf(ROOT);
  const municipalities = [];
  const features = [];
  const speechReadings = {};

  const sortedFeatures = sourceFeatures
    .filter((feature) => normalizeCode(feature?.properties?.AreaCode))
    .sort((a, b) => Number(normalizeCode(a?.properties?.AreaCode)) - Number(normalizeCode(b?.properties?.AreaCode)));

  for (const sourceFeature of sortedFeatures) {
    const properties = sourceFeature?.properties || {};
    const code = normalizeCode(properties.AreaCode);
    const id = `brazil_area_codes_${code}`;
    const city = String(properties.City || '').trim();
    const baseName = String(properties.name || '').trim();
    const region = city || null;
    const tags = [baseName, city].filter(Boolean);
    const { geometry, labelPoint } = simplifyFeatureWithLabel(turf, {
      type: 'Feature',
      properties,
      geometry: fillGeometryHoles(sourceFeature.geometry)
    }, {
      tolerance: 0,
      name: code
    });

    municipalities.push({
      id,
      name: code,
      region,
      tags
    });

    features.push({
      type: 'Feature',
      properties: {
        id,
        name: code,
        area_code: null,
        region,
        city,
        source_name: baseName,
        tags,
        labelPoint
      },
      geometry
    });

    speechReadings[id] = buildSpeechReading(code);
    speechReadings[code] = buildSpeechReading(code);
  }

  const dataset = {
    id: DATASET_ID,
    source: SOURCE_URL,
    generatedAt: new Date().toISOString(),
    municipalities,
    features
  };

  writeWindowAssignment(
    resolve(ROOT, 'data', 'prefectures', 'brazil-area-codes.js'),
    DATASET_GLOBAL,
    dataset
  );

  writeTextFile(
    resolve(ROOT, 'data', 'brazil-area-codes', 'label-overrides.js'),
    'window.BRAZIL_AREA_CODES_LABEL_OVERRIDES = {\n  municipalities: {},\n  areaCodes: {}\n};\n'
  );

  writeWindowAssignment(
    resolve(ROOT, 'data', 'brazil-area-codes', 'speech-readings.js'),
    'BRAZIL_AREA_CODES_SPEECH_READINGS',
    speechReadings
  );

  console.log(`\n✅ 生成完了: ${municipalities.length} 問`);
  console.log('   data/prefectures/brazil-area-codes.js');
  console.log('   data/brazil-area-codes/label-overrides.js');
  console.log('   data/brazil-area-codes/speech-readings.js');
}

main().catch((error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});
