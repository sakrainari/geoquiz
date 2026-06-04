import { resolve } from 'node:path';
import {
  NATURAL_EARTH_ADMIN1_URL,
  fetchJson,
  generateAdminDataset,
  resolveProjectRoot,
  slugifyName,
  writeTextFile,
  writeWindowAssignment
} from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);
const DATASET_ID = 'brazil';
const DATASET_GLOBAL = 'BRAZIL_MUNICIPALITIES';

function slugifyBrazilName(name) {
  return slugifyName(
    'brazil_',
    String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  );
}

async function main() {
  const speechReadings = {};
  const sourceFeatures = [];

  await generateAdminDataset({
    root: ROOT,
    datasetId: DATASET_ID,
    datasetGlobal: DATASET_GLOBAL,
    sourceUrl: NATURAL_EARTH_ADMIN1_URL,
    sourceLabel: 'Natural Earth admin-1',
    featureFilter: (feature) => feature?.properties?.adm0_a3 === 'BRA',
    emptyMessage: 'ブラジルの州境界が見つかりませんでした',
    sampleFilter: (feature) => feature?.properties?.adm0_a3 === 'BRA',
    idFromName: (rawName) => slugifyBrazilName(rawName),
    normalizeName: (_rawName, feature) => String(feature?.properties?.name || '').trim(),
    tolerance: 0.025,
    tagsFromFeature: (feature) => {
      const postal = String(feature?.properties?.postal || '').trim();
      return postal ? [postal] : [];
    },
    extraPropertiesFromFeature: (feature) => ({
      region: String(feature?.properties?.postal || '').trim() || null
    }),
    municipalityExtraFromFeature: (feature) => ({
      region: String(feature?.properties?.postal || '').trim() || null
    }),
    progressLabel: (name, feature) => `${name} (${String(feature?.properties?.postal || '').trim()})`,
    onFeaturesLoaded: (features) => {
      sourceFeatures.push(...features);
    }
  });

  for (const feature of sourceFeatures) {
    const rawName = String(feature?.properties?.name || '').trim();
    const id = slugifyBrazilName(rawName);
    const reading = String(feature?.properties?.name_ja || rawName).trim();
    speechReadings[id] = reading;
  }

  const dataDir = resolve(ROOT, 'data', 'brazil');
  writeTextFile(
    resolve(dataDir, 'label-overrides.js'),
    'window.BRAZIL_LABEL_OVERRIDES = {};\n'
  );
  writeWindowAssignment(
    resolve(dataDir, 'speech-readings.js'),
    'BRAZIL_SPEECH_READINGS',
    speechReadings
  );

  console.log('\n✅ 生成完了: ブラジル州データ');
  console.log('   data/prefectures/brazil.js');
  console.log('   data/brazil/label-overrides.js');
  console.log('   data/brazil/speech-readings.js');
}

main().catch((error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});
