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
const SOURCE_URL = 'https://super-duper.fr/geojson/france_areacodes.geojson';
const DATASET_ID = 'france_area_codes';
const DATASET_GLOBAL = 'FRANCE_AREA_CODES_MUNICIPALITIES';

function buildSpeechReading(code) {
  const readings = {
    '0': 'まる',
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
  return String(code)
    .trim()
    .replace(/[^0-9]/g, '')
    .split('')
    .map((digit) => readings[digit] || digit)
    .join(' ');
}

async function main() {
  const geojson = await fetchJson(SOURCE_URL, 'France area codes GeoJSON');
  const sourceFeatures = Array.isArray(geojson.features) ? geojson.features : [];
  console.log(`   全フィーチャー数: ${sourceFeatures.length}`);

  const turf = loadBundledTurf(ROOT);
  const municipalities = [];
  const features = [];
  const speechReadings = {};

  const sorted = sourceFeatures
    .filter((feature) => String(feature?.properties?.AreaCode || '').trim())
    .sort((a, b) => String(a?.properties?.AreaCode || '').localeCompare(String(b?.properties?.AreaCode || '')));

  for (const sourceFeature of sorted) {
    const properties = sourceFeature?.properties || {};
    const code = String(properties.AreaCode || '').trim();
    const regionCode = String(properties.code || '').trim() || null;
    const city = String(properties.City || '').trim() || null;
    const id = `france_area_codes_${code.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
    const { geometry, labelPoint: computedLabelPoint } = simplifyFeatureWithLabel(turf, sourceFeature, {
      tolerance: 0,
      name: code
    });
    const labelX = Number(properties.labelx);
    const labelY = Number(properties.labely);
    const labelPoint = Number.isFinite(labelX) && Number.isFinite(labelY)
      ? [+labelY.toFixed(6), +labelX.toFixed(6)]
      : computedLabelPoint;

    municipalities.push({
      id,
      name: code,
      region: regionCode,
      tags: [city].filter(Boolean)
    });

    features.push({
      type: 'Feature',
      properties: {
        id,
        name: code,
        area_code: null,
        region: regionCode,
        city,
        tags: [city].filter(Boolean),
        labelPoint
      },
      geometry
    });

    speechReadings[id] = buildSpeechReading(code);
    speechReadings[code] = buildSpeechReading(code);
    process.stdout.write(`  ✅ ${code}${city ? ` (${city})` : ''}\n`);
  }

  writeWindowAssignment(
    resolve(ROOT, 'data', 'prefectures', 'france-area-codes.js'),
    DATASET_GLOBAL,
    {
      id: DATASET_ID,
      source: SOURCE_URL,
      generatedAt: new Date().toISOString(),
      municipalities,
      features
    }
  );

  const dataDir = resolve(ROOT, 'data', 'france-area-codes');
  writeTextFile(
    resolve(dataDir, 'label-overrides.js'),
    'window.FRANCE_AREA_CODES_LABEL_OVERRIDES = {\n  municipalities: {},\n  areaCodes: {}\n};\n'
  );
  writeWindowAssignment(
    resolve(dataDir, 'speech-readings.js'),
    'FRANCE_AREA_CODES_SPEECH_READINGS',
    speechReadings
  );

  console.log('\n✅ 生成完了: フランス Area Code データ');
  console.log('   data/prefectures/france-area-codes.js');
  console.log('   data/france-area-codes/label-overrides.js');
  console.log('   data/france-area-codes/speech-readings.js');
}

main().catch((error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});
