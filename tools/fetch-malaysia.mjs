import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

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

function stateNameToId(name) {
  return 'malaysia_' + name.toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

async function main() {
  const URL =
    'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

  console.log('🌐 GeoJSON を取得中 (ne_10m_admin_1_states_provinces)...');
  console.log('   ' + URL);
  const resp = await fetch(URL);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
  const geojson = await resp.json();
  console.log(`   全フィーチャー数: ${geojson.features.length}`);

  const myStates = geojson.features.filter((f) => f?.properties?.adm0_a3 === 'MYS');

  console.log(`\n🗺️  Malaysia States 抽出: ${myStates.length} 件`);
  if (myStates.length === 0) {
    const sample = geojson.features.find((f) => f?.properties?.adm0_a3 === 'MYS');
    if (sample) console.log('  サンプルプロパティ:', JSON.stringify(sample.properties, null, 2));
    throw new Error('マレーシアの州データが見つかりませんでした。');
  }

  console.log('\n⚙️  turf をロード中...');
  const turf = loadTurf();
  console.log('   turf ロード完了');

  myStates.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

  console.log('\n🔧 ジオメトリを簡略化中 (tolerance=0.02)...');
  const features = [];
  const municipalities = [];

  for (const state of myStates) {
    const name = state.properties.name;
    const id = stateNameToId(name);

    let simplified;
    try {
      simplified = turf.simplify(state, { tolerance: 0.02, highQuality: false });
    } catch (e) {
      console.warn(`  ⚠️  simplify失敗 [${name}]: ${e.message} → 元データを使用`);
      simplified = state;
    }

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

  const outputData = {
    id: 'malaysia',
    features,
    municipalities
  };

  const outDir = resolve(ROOT, 'data/prefectures');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'malaysia.js');
  const content = `window.MALAYSIA_MUNICIPALITIES = ${JSON.stringify(outputData)};\n`;
  writeFileSync(outPath, content, 'utf-8');
  console.log(`\n✅ 書き出し完了: ${outPath}`);
  console.log(`   ファイルサイズ: ${(content.length / 1024).toFixed(1)} KB`);

  console.log('\n州一覧:');
  municipalities.forEach((m, i) => {
    console.log(`  ${String(i + 1).padStart(2, ' ')}. [${m.id}] ${m.name}`);
  });
}

main().catch((e) => {
  console.error('❌ エラー:', e.message);
  process.exit(1);
});
