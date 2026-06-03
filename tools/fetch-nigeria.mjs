/**
 * tools/fetch-nigeria.mjs
 *
 * Natural Earth GeoJSON からナイジェリア36州 + FCT データを取得・整形して
 * data/prefectures/nigeria.js に出力する。
 *
 * 使い方:
 *   node tools/fetch-nigeria.mjs
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
  return 'nigeria_' + name.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// ─── FCT の表示名正規化 ───────────────────────────────────────────
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

// ─── メイン処理 ──────────────────────────────────────────────────
async function main() {
  const URL =
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

  console.log('🌐 GeoJSON を取得中 (ne_10m_admin_1_states_provinces)...');
  console.log('   ' + URL);
  const resp = await fetch(URL);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  const geojson = await resp.json();
  console.log(`   全フィーチャー数: ${geojson.features.length}`);

  // ─── ナイジェリアの州をフィルタ ──────────────────────────────
  const ngStates = geojson.features.filter((f) => {
    return f.properties.adm0_a3 === 'NGA';
  });

  console.log(`\n🗺️  Nigeria States 抽出: ${ngStates.length} 件`);
  if (ngStates.length === 0) {
    const sample = geojson.features.find((f) => f.properties.adm0_a3 === 'NGA');
    if (sample) console.log('  サンプルプロパティ:', JSON.stringify(sample.properties, null, 2));
    throw new Error('ナイジェリアの州データが見つかりませんでした。');
  }

  // ─── turf ロード ──────────────────────────────────────────────
  console.log('\n⚙️  turf をロード中...');
  const turf = loadTurf();
  console.log('   turf ロード完了');

  // ─── 州をアルファベット順に並び替え ──────────────────────────
  ngStates.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

  // ─── 各州を変換 ───────────────────────────────────────────────
  console.log('\n🔧 ジオメトリを簡略化中 (tolerance=0.02)...');
  const features = [];
  const municipalities = [];

  for (const state of ngStates) {
    const rawName = state.properties.name;
    const name = normalizeName(rawName);
    const id = stateNameToId(rawName);

    // turf.simplify でジオメトリを軽量化
    let simplified;
    try {
      simplified = turf.simplify(state, { tolerance: 0.02, highQuality: false });
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
    id: 'nigeria',
    features,
    municipalities
  };

  const outDir = resolve(ROOT, 'data/prefectures');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'nigeria.js');
  const content = `window.NIGERIA_MUNICIPALITIES = ${JSON.stringify(outputData)};\n`;
  writeFileSync(outPath, content, 'utf-8');
  console.log(`\n✅ 書き出し完了: ${outPath}`);
  console.log(`   ファイルサイズ: ${(content.length / 1024).toFixed(1)} KB`);

  // ─── 州名一覧を表示 ────────────────────────────────────────────
  console.log('\n州一覧:');
  municipalities.forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2, ' ')}. [${m.id}] ${m.name}`);
  });
}

main().catch((e) => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
