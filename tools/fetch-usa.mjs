/**
 * tools/fetch-usa.mjs
 *
 * Natural Earth GeoJSON からアメリカ50州データを取得・整形して
 * data/prefectures/usa.js に出力する。
 *
 * 使い方:
 *   node tools/fetch-usa.mjs
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── turf をロード（vendor からそのまま読む）───────────────────────
function loadTurf() {
  const turfPath = resolve(ROOT, 'vendor/turf/turf.min.js');
  if (!existsSync(turfPath)) {
    throw new Error(`turf.min.js が見つかりません: ${turfPath}`);
  }
  const code = readFileSync(turfPath, 'utf-8');
  const fakeWindow = {};
  // eslint-disable-next-line no-new-func
  new Function('window', code)(fakeWindow);
  const turf = fakeWindow.turf || globalThis.turf;
  if (!turf) throw new Error('turf のロードに失敗しました');
  return turf;
}

// ─── 州名 → id 変換 ──────────────────────────────────────────────
function stateNameToId(name) {
  return 'usa_' + name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

// ─── メイン処理 ──────────────────────────────────────────────────
async function main() {
  const URL =
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_admin_1_states_provinces.geojson';

  console.log('🌐 GeoJSON を取得中...');
  console.log('   ' + URL);
  const resp = await fetch(URL);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  const geojson = await resp.json();
  console.log(`   全フィーチャー数: ${geojson.features.length}`);

  // ─── アメリカ50州をフィルタ ────────────────────────────────────
  const usStates = geojson.features.filter((f) => {
    const p = f.properties;
    const isUS = p.iso_a2 === 'US';
    const isState = p.type === 'State' || p.type_en === 'State';
    return isUS && isState;
  });

  console.log(`\n🗺️  US States 抽出: ${usStates.length} 件`);
  if (usStates.length === 0) {
    // デバッグ用: 最初のUS要素のプロパティを表示
    const sample = geojson.features.find((f) => f.properties.iso_a2 === 'US');
    if (sample) console.log('  サンプルプロパティ:', JSON.stringify(sample.properties, null, 2));
    throw new Error('州データが見つかりませんでした。フィルタ条件を確認してください。');
  }

  // ─── turf ロード ──────────────────────────────────────────────
  console.log('\n⚙️  turf をロード中...');
  const turf = loadTurf();
  console.log('   turf ロード完了');

  // ─── 州をアルファベット順に並び替え ──────────────────────────
  usStates.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

  // ─── 各州を変換 ───────────────────────────────────────────────
  console.log('\n🔧 ジオメトリを簡略化中 (tolerance=0.5)...');
  const features = [];
  const municipalities = [];

  for (const state of usStates) {
    const name = state.properties.name;
    const id = stateNameToId(name);

    // turf.simplify でジオメトリを軽量化
    let simplified;
    try {
      simplified = turf.simplify(state, { tolerance: 0.5, highQuality: false });
    } catch (e) {
      console.warn(`  ⚠️  simplify失敗 [${name}]: ${e.message} → 元データを使用`);
      simplified = state;
    }

    // 重心を計算（labelPoint）
    let lp = null;
    try {
      const centroid = turf.centerOfMass(simplified);
      const [lng, lat] = centroid.geometry.coordinates;
      lp = [+lat.toFixed(6), +lng.toFixed(6)];
    } catch (e) {
      console.warn(`  ⚠️  centerOfMass失敗 [${name}]: ${e.message}`);
    }

    features.push({
      type: 'Feature',
      properties: {
        id,
        name,
        area_code: null,
        tags: [],
        labelPoint: lp
      },
      geometry: simplified.geometry
    });

    municipalities.push({ id, name });
    process.stdout.write(`  ✅ ${name}\n`);
  }

  console.log(`\n📦 ${features.length} 州のデータを生成しました`);

  // ─── 出力 ─────────────────────────────────────────────────────
  const outputData = {
    id: 'usa',
    features,
    municipalities
  };

  const outPath = resolve(ROOT, 'data/prefectures/usa.js');
  const content = `window.USA_MUNICIPALITIES = ${JSON.stringify(outputData)};\n`;
  writeFileSync(outPath, content, 'utf-8');
  console.log(`\n✅ 書き出し完了: ${outPath}`);
  console.log(`   ファイルサイズ: ${(content.length / 1024).toFixed(1)} KB`);
}

main().catch((e) => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
