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
const SOURCE_URL = 'https://super-duper.fr/geojson/ukraine_areacodes_2.geojson';
const DATASET_ID = 'ukraine_area_codes';
const DATASET_GLOBAL = 'UKRAINE_AREA_CODES_MUNICIPALITIES';

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
  const geojson = await fetchJson(SOURCE_URL, 'Ukraine area codes GeoJSON');
  const sourceFeatures = Array.isArray(geojson.features) ? geojson.features : [];
  console.log(`   全フィーチャー数: ${sourceFeatures.length}`);

  const turf = loadBundledTurf(ROOT);
  const municipalities = [];
  const features = [];
  const speechReadings = {};

  const sorted = sourceFeatures
    .filter((feature) => String(feature?.properties?.AreaCode || '').trim())
    .sort((a, b) => Number(String(a?.properties?.AreaCode || '').trim()) - Number(String(b?.properties?.AreaCode || '').trim()));

  for (const sourceFeature of sorted) {
    const properties = sourceFeature?.properties || {};
    const code = String(properties.AreaCode || '').trim();
    const region = String(properties.ADM1_UA || properties.ADM1_RU || '').trim() || null;
    const city = String(properties.City || '').trim() || null;
    const id = `ukraine_area_codes_${code}`;
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
      region,
      tags: [city].filter(Boolean)
    });

    features.push({
      type: 'Feature',
      properties: {
        id,
        name: code,
        area_code: null,
        region,
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
    resolve(ROOT, 'data', 'prefectures', 'ukraine-area-codes.js'),
    DATASET_GLOBAL,
    {
      id: DATASET_ID,
      source: SOURCE_URL,
      generatedAt: new Date().toISOString(),
      municipalities,
      features
    }
  );

  const dataDir = resolve(ROOT, 'data', 'ukraine-area-codes');
  writeTextFile(
    resolve(dataDir, 'label-overrides.js'),
    'window.UKRAINE_AREA_CODES_LABEL_OVERRIDES = {\n  municipalities: {},\n  areaCodes: {}\n};\n'
  );
  writeWindowAssignment(
    resolve(dataDir, 'speech-readings.js'),
    'UKRAINE_AREA_CODES_SPEECH_READINGS',
    speechReadings
  );

  console.log('\n✅ 生成完了: ウクライナ Area Code データ');
  console.log('   data/prefectures/ukraine-area-codes.js');
  console.log('   data/ukraine-area-codes/label-overrides.js');
  console.log('   data/ukraine-area-codes/speech-readings.js');
}

main().catch((error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});
