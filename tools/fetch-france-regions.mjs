import { resolve } from 'node:path';
import {
  fetchJson,
  loadBundledTurf,
  resolveProjectRoot,
  simplifyFeatureWithLabel,
  slugifyName,
  writeTextFile,
  writeWindowAssignment
} from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);
const DATASET_ID = 'france';
const DATASET_GLOBAL = 'FRANCE_MUNICIPALITIES';
const SOURCE_URL = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-france-region/exports/geojson?lang=en&timezone=Asia%2FTokyo';

const JAPANESE_READINGS = {
  'Auvergne-Rhône-Alpes': 'オーヴェルニュ＝ローヌ＝アルプ地域圏',
  'Bourgogne-Franche-Comté': 'ブルゴーニュ＝フランシュ＝コンテ地域圏',
  'Bretagne': 'ブルターニュ地域圏',
  'Centre-Val de Loire': 'サントル＝ヴァル・ド・ロワール地域圏',
  'Corse': 'コルス地域圏',
  'Grand Est': 'グラン・テスト地域圏',
  'Guadeloupe': 'グアドループ地域圏',
  'Guyane': 'ギアナ地域圏',
  'Hauts-de-France': 'オー＝ド＝フランス地域圏',
  'Île-de-France': 'イル＝ド＝フランス地域圏',
  'La Réunion': 'レユニオン地域圏',
  'Martinique': 'マルティニーク地域圏',
  'Mayotte': 'マヨット地域圏',
  'Normandie': 'ノルマンディー地域圏',
  'Nouvelle-Aquitaine': 'ヌーヴェル＝アキテーヌ地域圏',
  'Occitanie': 'オクシタニー地域圏',
  'Pays de la Loire': 'ペイ・ド・ラ・ロワール地域圏',
  "Provence-Alpes-Côte d'Azur": 'プロヴァンス＝アルプ＝コート・ダジュール地域圏'
};

function slugifyFranceRegion(name) {
  return slugifyName(
    'france_',
    String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-/']+/g, ' ')
  );
}

async function main() {
  const geojson = await fetchJson(SOURCE_URL, 'France regions GeoJSON');
  const sourceFeatures = Array.isArray(geojson.features) ? geojson.features : [];
  const filtered = sourceFeatures.filter((feature) => String(feature?.properties?.reg_type || '').trim() === 'région');
  console.log(`   全フィーチャー数: ${sourceFeatures.length}`);
  console.log(`   使用フィーチャー数: ${filtered.length}`);

  if (!filtered.length) {
    throw new Error('フランス地域圏の境界が見つかりませんでした');
  }

  const turf = loadBundledTurf(ROOT);
  const municipalities = [];
  const features = [];
  const speechReadings = {};

  filtered.sort((a, b) => String(a?.properties?.reg_name?.[0] || '').localeCompare(String(b?.properties?.reg_name?.[0] || '')));

  for (const sourceFeature of filtered) {
    const properties = sourceFeature?.properties || {};
    const rawName = String(properties?.reg_name?.[0] || '').trim();
    const code = String(properties.reg_area_code || '').trim() || null;
    const id = slugifyFranceRegion(rawName);
    const { geometry, labelPoint: computedLabelPoint } = simplifyFeatureWithLabel(turf, sourceFeature, {
      tolerance: 0.02,
      name: rawName
    });
    const sourcePoint = properties?.geo_point_2d;
    const labelPoint = sourcePoint && Number.isFinite(sourcePoint.lat) && Number.isFinite(sourcePoint.lon)
      ? [+sourcePoint.lat.toFixed(6), +sourcePoint.lon.toFixed(6)]
      : computedLabelPoint;

    municipalities.push({
      id,
      name: rawName,
      region: code
    });

    features.push({
      type: 'Feature',
      properties: {
        id,
        name: rawName,
        area_code: null,
        region: code,
        tags: [code].filter(Boolean),
        labelPoint
      },
      geometry
    });

    speechReadings[id] = JAPANESE_READINGS[rawName] || rawName;
    process.stdout.write(`  ✅ ${rawName}${code ? ` (${code})` : ''}\n`);
  }

  writeWindowAssignment(
    resolve(ROOT, 'data', 'prefectures', 'france.js'),
    DATASET_GLOBAL,
    {
      id: DATASET_ID,
      source: SOURCE_URL,
      generatedAt: new Date().toISOString(),
      municipalities,
      features
    }
  );

  const dataDir = resolve(ROOT, 'data', 'france');
  writeTextFile(
    resolve(dataDir, 'label-overrides.js'),
    'window.FRANCE_LABEL_OVERRIDES = {};\n'
  );
  writeWindowAssignment(
    resolve(dataDir, 'speech-readings.js'),
    'FRANCE_SPEECH_READINGS',
    speechReadings
  );

  console.log('\n✅ 生成完了: フランス地域圏データ');
  console.log('   data/prefectures/france.js');
  console.log('   data/france/label-overrides.js');
  console.log('   data/france/speech-readings.js');
}

main().catch((error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});
