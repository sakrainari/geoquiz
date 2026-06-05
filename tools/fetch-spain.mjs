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
const DATASET_ID = 'spain';
const DATASET_GLOBAL = 'SPAIN_MUNICIPALITIES';
const SOURCE_URL = 'https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/georef-spain-comunidad-autonoma/exports/geojson?lang=en&timezone=Asia%2FTokyo';

const JAPANESE_READINGS = {
  'País Vasco': 'バスク州',
  'Principado de Asturias': 'アストゥリアス州',
  'Comunitat Valenciana': 'バレンシア州',
  'Ciudad Autónoma de Ceuta': 'セウタ自治市',
  'Ciudad Autónoma de Melilla': 'メリリャ自治市',
  'Región de Murcia': 'ムルシア州',
  'Galicia': 'ガリシア州',
  'Illes Balears': 'バレアレス諸島州',
  'Canarias': 'カナリア諸島州',
  'Extremadura': 'エストレマドゥーラ州',
  'Aragón': 'アラゴン州',
  'Castilla-La Mancha': 'カスティーリャ・ラ・マンチャ州',
  'Cantabria': 'カンタブリア州',
  'La Rioja': 'ラ・リオハ州',
  'Castilla y León': 'カスティーリャ・イ・レオン州',
  'Comunidad de Madrid': 'マドリード州',
  'Comunidad Foral de Navarra': 'ナバラ州',
  'Andalucía': 'アンダルシア州',
  'Cataluña': 'カタルーニャ州'
};

function slugifySpainName(name) {
  return slugifyName(
    'spain_',
    String(name)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[-/]+/g, ' ')
  );
}

function normalizeName(properties) {
  const local = String(properties?.acom_name_local || '').trim();
  const base = String(properties?.acom_name || '').trim();
  if (base === 'País Vasco' && local) return `${base} / ${local}`;
  if (base === 'Cataluña' && local) return `${base} / ${local}`;
  return base;
}

async function main() {
  const geojson = await fetchJson(SOURCE_URL, 'Spain autonomous communities GeoJSON');
  const sourceFeatures = Array.isArray(geojson.features) ? geojson.features : [];
  const filtered = sourceFeatures.filter((feature) => String(feature?.properties?.acom_iso3166_code || '').trim());
  console.log(`   全フィーチャー数: ${sourceFeatures.length}`);
  console.log(`   使用フィーチャー数: ${filtered.length}`);

  if (!filtered.length) {
    throw new Error('スペイン自治州の境界が見つかりませんでした');
  }

  const turf = loadBundledTurf(ROOT);
  const municipalities = [];
  const features = [];
  const speechReadings = {};

  filtered.sort((a, b) => String(a?.properties?.acom_name || '').localeCompare(String(b?.properties?.acom_name || '')));

  for (const sourceFeature of filtered) {
    const properties = sourceFeature?.properties || {};
    const rawName = String(properties.acom_name || '').trim();
    const name = normalizeName(properties);
    const code = String(properties.acom_iso3166_code || '').trim() || null;
    const id = slugifySpainName(rawName);
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
      name,
      region: code
    });

    features.push({
      type: 'Feature',
      properties: {
        id,
        name,
        area_code: null,
        region: code,
        local_name: String(properties.acom_name_local || '').trim() || null,
        tags: [code, properties.acom_name_local].filter(Boolean),
        labelPoint
      },
      geometry
    });

    speechReadings[id] = JAPANESE_READINGS[rawName] || rawName;
    process.stdout.write(`  ✅ ${name}${code ? ` (${code})` : ''}\n`);
  }

  writeWindowAssignment(
    resolve(ROOT, 'data', 'prefectures', 'spain.js'),
    DATASET_GLOBAL,
    {
      id: DATASET_ID,
      source: SOURCE_URL,
      generatedAt: new Date().toISOString(),
      municipalities,
      features
    }
  );

  const dataDir = resolve(ROOT, 'data', 'spain');
  writeTextFile(
    resolve(dataDir, 'label-overrides.js'),
    'window.SPAIN_LABEL_OVERRIDES = {};\n'
  );
  writeWindowAssignment(
    resolve(dataDir, 'speech-readings.js'),
    'SPAIN_SPEECH_READINGS',
    speechReadings
  );

  console.log('\n✅ 生成完了: スペイン自治州データ');
  console.log('   data/prefectures/spain.js');
  console.log('   data/spain/label-overrides.js');
  console.log('   data/spain/speech-readings.js');
}

main().catch((error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});
