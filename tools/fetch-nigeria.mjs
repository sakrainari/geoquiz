/**
 * tools/fetch-nigeria.mjs
 *
 * Natural Earth GeoJSON からナイジェリア36州 + FCT データを取得・整形して
 * data/prefectures/nigeria.js に出力する。
 *
 * 使い方:
 *   node tools/fetch-nigeria.mjs
 */

import { generateAdminDataset, resolveProjectRoot, slugifyName } from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);

function normalizeName(name) {
  // Natural Earth では "Federal Capital Territory" または "Abuja" の場合がある
  if (/federal capital territory/i.test(name) || /abuja/i.test(name)) {
    return 'FCT（アブジャ）';
  }
  if (/^nassarawa$/i.test(name)) {
    return 'Nasarawa';
  }
  return name;
}

async function main() {
  const { payload } = await generateAdminDataset({
    root: ROOT,
    datasetId: 'nigeria',
    datasetGlobal: 'NIGERIA_MUNICIPALITIES',
    featureFilter: (feature) => feature?.properties?.adm0_a3 === 'NGA',
    emptyMessage: 'ナイジェリアの州データが見つかりませんでした。',
    sampleFilter: (feature) => feature?.properties?.adm0_a3 === 'NGA',
    idFromName: (name) => slugifyName('nigeria_', name),
    normalizeName,
    logLabel: 'Nigeria States'
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
