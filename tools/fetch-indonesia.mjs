import { resolve } from 'node:path';
import {
  generateAdminDataset,
  resolveProjectRoot,
  slugifyName,
  writeTextFile,
  writeWindowAssignment
} from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);
const SPEECH_READINGS = {
  indonesia_aceh: 'アチェ州',
  indonesia_bali: 'バリ州',
  indonesia_bangka_belitung: 'バンカ・ブリトゥン州',
  indonesia_banten: 'バンテン州',
  indonesia_bengkulu: 'ブンクル州',
  indonesia_gorontalo: 'ゴロンタロ州',
  indonesia_jakarta_raya: 'ジャカルタ特別州',
  indonesia_jambi: 'ジャンビ州',
  indonesia_jawa_barat: '西ジャワ州',
  indonesia_jawa_tengah: '中部ジャワ州',
  indonesia_jawa_timur: '東ジャワ州',
  indonesia_kalimantan_barat: '西カリマンタン州',
  indonesia_kalimantan_selatan: '南カリマンタン州',
  indonesia_kalimantan_tengah: '中部カリマンタン州',
  indonesia_kalimantan_timur: '東カリマンタン州',
  indonesia_kepulauan_riau: 'リアウ諸島州',
  indonesia_lampung: 'ランプン州',
  indonesia_maluku: 'マルク州',
  indonesia_maluku_utara: '北マルク州',
  indonesia_nusa_tenggara_barat: '西ヌサ・トゥンガラ州',
  indonesia_nusa_tenggara_timur: '東ヌサ・トゥンガラ州',
  indonesia_papua: 'パプア州',
  indonesia_papua_barat: '西パプア州',
  indonesia_riau: 'リアウ州',
  indonesia_sulawesi_barat: '西スラウェシ州',
  indonesia_sulawesi_selatan: '南スラウェシ州',
  indonesia_sulawesi_tengah: '中部スラウェシ州',
  indonesia_sulawesi_tenggara: '南東スラウェシ州',
  indonesia_sulawesi_utara: '北スラウェシ州',
  indonesia_sumatera_barat: '西スマトラ州',
  indonesia_sumatera_selatan: '南スマトラ州',
  indonesia_sumatera_utara: '北スマトラ州',
  indonesia_yogyakarta: 'ジョグジャカルタ特別州'
};

async function main() {
  const { payload } = await generateAdminDataset({
    root: ROOT,
    datasetId: 'indonesia',
    datasetGlobal: 'INDONESIA_MUNICIPALITIES',
    featureFilter: (feature) => feature?.properties?.adm0_a3 === 'IDN',
    emptyMessage: 'インドネシアの州データが見つかりませんでした。',
    sampleFilter: (feature) => feature?.properties?.adm0_a3 === 'IDN',
    idFromName: (name) => slugifyName(
      'indonesia_',
      String(name).replace(/[-/]+/g, ' ')
    ),
    normalizeName: (_rawName, feature) => String(feature?.properties?.name || '').trim(),
    logLabel: 'Indonesia Provinces'
  });

  const dataDir = resolve(ROOT, 'data', 'indonesia');
  writeTextFile(
    resolve(dataDir, 'label-overrides.js'),
    'window.INDONESIA_LABEL_OVERRIDES = {};\n'
  );
  writeWindowAssignment(
    resolve(dataDir, 'speech-readings.js'),
    'INDONESIA_SPEECH_READINGS',
    SPEECH_READINGS
  );

  console.log('\n州一覧:');
  payload.municipalities.forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2, ' ')}. [${m.id}] ${m.name}`);
  });

  console.log('\n✅ 追加出力:');
  console.log('   data/indonesia/label-overrides.js');
  console.log('   data/indonesia/speech-readings.js');
}

main().catch((e) => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
