/**
 * tools/fetch-philippines.mjs
 *
 * Natural Earth GeoJSON からフィリピンの州データを取得・整形して
 * data/prefectures/philippines.js に出力する。
 *
 * 使い方:
 *   node tools/fetch-philippines.mjs
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

// ─── 表示名の正規化（省と独立市の重複を解消）───────────────────────
// Natural Earth は同名で省と都市が別フィーチャーになる場合がある。
// type_en が "Province" 以外の都市系は名前に " City" を付加して区別する。
const CITY_TYPES = new Set([
  'Highly Urbanized City',
  'Independent Component City',
  'Component City',
  'City',
]);

function normalizeName(name, typeEn) {
  if (CITY_TYPES.has(typeEn) && !name.toLowerCase().includes('city')) {
    return name + ' City';
  }
  return name;
}

// ─── 州名 → id 変換 ──────────────────────────────────────────────
function provinceNameToId(name) {
  return 'philippines_' + name.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
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

  // ─── フィリピンの州をフィルタ ─────────────────────────────────
  const phProvinces = geojson.features.filter((f) => {
    return f.properties.adm0_a3 === 'PHL';
  });

  console.log(`\n🗺️  Philippines Provinces 抽出: ${phProvinces.length} 件`);
  if (phProvinces.length === 0) {
    const sample = geojson.features.find((f) => f.properties.adm0_a3 === 'PHL');
    if (sample) console.log('  サンプルプロパティ:', JSON.stringify(sample.properties, null, 2));
    throw new Error('フィリピンの州データが見つかりませんでした。');
  }

  // ─── turf ロード ──────────────────────────────────────────────
  console.log('\n⚙️  turf をロード中...');
  const turf = loadTurf();
  console.log('   turf ロード完了');

  // ─── 州をアルファベット順に並び替え ──────────────────────────
  phProvinces.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

  // ─── 各州を変換 ───────────────────────────────────────────────
  console.log('\n🔧 ジオメトリを簡略化中 (tolerance=0.05)...');
  const features = [];
  const municipalities = [];

  for (const province of phProvinces) {
    const rawName = province.properties.name;
    const typeEn = province.properties.type_en || '';
    const name = normalizeName(rawName, typeEn);
    const id = provinceNameToId(name);

    // turf.simplify でジオメトリを軽量化
    let simplified;
    try {
      simplified = turf.simplify(province, { tolerance: 0.05, highQuality: false });
    } catch (e) {
      console.warn(`  ⚠️  simplify失敗 [${name}]: ${e.message} → 元データを使用`);
      simplified = province;
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
    id: 'philippines',
    features,
    municipalities
  };

  const outDir = resolve(ROOT, 'data/prefectures');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'philippines.js');
  const content = `window.PHILIPPINES_MUNICIPALITIES = ${JSON.stringify(outputData)};\n`;
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
