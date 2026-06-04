/**
 * tools/fetch-thailand.mjs
 *
 * Natural Earth GeoJSON からタイの県データを取得・整形して
 * data/prefectures/thailand.js に出力する。
 *
 * 使い方:
 *   node tools/fetch-thailand.mjs
 */

import { generateAdminDataset, resolveProjectRoot, slugifyName } from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);

// Natural Earth の name_local は一部誤りがあるため手動で補正する。
// また "จังหวัด"（県）・"อำเภอเมือง"（市）プレフィックスを除去する。
const NAME_TH_OVERRIDES = {
  'Bangkok Metropolis': 'กรุงเทพมหานคร',
  'Bueng Kan': 'บึงกาฬ',
  'Chaiyaphum': 'ชัยภูมิ'
};

function normalizeNameTh(englishName, rawNameTh) {
  if (NAME_TH_OVERRIDES[englishName]) return NAME_TH_OVERRIDES[englishName];
  if (!rawNameTh) return null;
  return rawNameTh
    .replace(/^จังหวัด/, '')
    .replace(/^อำเภอเมือง/, '')
    .trim() || null;
}

function logDuplicateNames(features) {
  const counts = new Map();
  features.forEach((feature) => {
    const name = feature?.properties?.name;
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1).map(([name]) => name);
  if (!duplicates.length) return;

  console.log(`  ⚠️  重複名: ${duplicates.join(', ')}`);
  duplicates.forEach((name) => {
    features
      .filter((feature) => feature?.properties?.name === name)
      .forEach((feature) => {
        console.log(`    name="${feature.properties.name}" type_en=${feature.properties.type_en}`);
      });
  });
}

async function main() {
  const { payload } = await generateAdminDataset({
    root: ROOT,
    datasetId: 'thailand',
    datasetGlobal: 'THAILAND_MUNICIPALITIES',
    featureFilter: (feature) => feature?.properties?.adm0_a3 === 'THA',
    emptyMessage: 'タイの県データが見つかりませんでした。',
    sampleFilter: (feature) => feature?.properties?.adm0_a3 === 'THA',
    idFromName: (name) => slugifyName('thailand_', name),
    extraPropertiesFromFeature: (feature, name) => {
      const nameTh = normalizeNameTh(name, feature?.properties?.name_local || null);
      return nameTh ? { name_th: nameTh } : {};
    },
    municipalityExtraFromFeature: (feature, name) => {
      const nameTh = normalizeNameTh(name, feature?.properties?.name_local || null);
      const nameJa = feature?.properties?.name_ja || null;
      return {
        ...(nameTh ? { name_th: nameTh } : {}),
        ...(nameJa ? { name_ja: nameJa } : {})
      };
    },
    progressLabel: (name, feature) => {
      const nameTh = normalizeNameTh(name, feature?.properties?.name_local || null);
      return nameTh ? `${name} (${nameTh})` : name;
    },
    onFeaturesLoaded: logDuplicateNames,
    logLabel: 'Thailand Provinces'
  });

  console.log('\n県一覧:');
  payload.municipalities.forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2, ' ')}. [${m.id}] ${m.name}`);
  });
}

main().catch((e) => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
