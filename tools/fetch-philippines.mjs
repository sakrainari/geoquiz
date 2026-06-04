/**
 * tools/fetch-philippines.mjs
 *
 * Natural Earth GeoJSON からフィリピンの州データを取得・整形して
 * data/prefectures/philippines.js に出力する。
 *
 * 使い方:
 *   node tools/fetch-philippines.mjs
 */

import { generateAdminDataset, resolveProjectRoot, slugifyName } from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);

const CITY_TYPES = new Set([
  'Highly Urbanized City',
  'Independent Component City',
  'Component City',
  'City'
]);

function normalizeName(name, typeEn) {
  if (CITY_TYPES.has(typeEn) && !name.toLowerCase().includes('city')) {
    return `${name} City`;
  }
  return name;
}

async function main() {
  const { payload } = await generateAdminDataset({
    root: ROOT,
    datasetId: 'philippines',
    datasetGlobal: 'PHILIPPINES_MUNICIPALITIES',
    featureFilter: (feature) => feature?.properties?.adm0_a3 === 'PHL',
    emptyMessage: 'フィリピンの州データが見つかりませんでした。',
    sampleFilter: (feature) => feature?.properties?.adm0_a3 === 'PHL',
    idFromName: (_rawName, feature) =>
      slugifyName('philippines_', normalizeName(feature?.properties?.name || '', feature?.properties?.type_en || '')),
    normalizeName: (rawName, feature) => normalizeName(rawName, feature?.properties?.type_en || ''),
    logLabel: 'Philippines Provinces'
  });

  console.log('\n州一覧:');
  payload.municipalities.forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2, ' ')}. [${m.id}] ${m.name}`);
  });
}

main().catch((e) => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
