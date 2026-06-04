/**
 * tools/fetch-usa.mjs
 *
 * Natural Earth GeoJSON からアメリカ50州データを取得・整形して
 * data/prefectures/usa.js に出力する。
 *
 * 使い方:
 *   node tools/fetch-usa.mjs
 */

import { generateAdminDataset, resolveProjectRoot, slugifyName } from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);

async function main() {
  await generateAdminDataset({
    root: ROOT,
    datasetId: 'usa',
    datasetGlobal: 'USA_MUNICIPALITIES',
    featureFilter: (feature) => {
      const props = feature?.properties || {};
      const isUS = props.iso_a2 === 'US';
      const isState = props.type === 'State' || props.type_en === 'State';
      return isUS && isState;
    },
    emptyMessage: '州データが見つかりませんでした。フィルタ条件を確認してください。',
    sampleFilter: (feature) => feature?.properties?.iso_a2 === 'US',
    idFromName: (name) => slugifyName('usa_', name),
    logLabel: 'US States'
  });
}

main().catch((e) => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
