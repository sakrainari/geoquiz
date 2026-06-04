import { generateAdminDataset, resolveProjectRoot, slugifyName } from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);

async function main() {
  const { payload } = await generateAdminDataset({
    root: ROOT,
    datasetId: 'malaysia',
    datasetGlobal: 'MALAYSIA_MUNICIPALITIES',
    featureFilter: (feature) => feature?.properties?.adm0_a3 === 'MYS',
    emptyMessage: 'マレーシアの州データが見つかりませんでした。',
    sampleFilter: (feature) => feature?.properties?.adm0_a3 === 'MYS',
    idFromName: (name) => slugifyName('malaysia_', name),
    logLabel: 'Malaysia States'
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
