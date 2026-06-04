import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const NATURAL_EARTH_ADMIN1_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson';

export function resolveProjectRoot(importMetaUrl) {
  return resolve(dirname(fileURLToPath(importMetaUrl)), '..', '..');
}

export function loadBundledTurf(root) {
  const turfPath = resolve(root, 'vendor/turf/turf.min.js');
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

export function slugifyName(prefix, name) {
  return `${prefix}${String(name).toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')}`;
}

export async function fetchJson(url, label = 'GeoJSON') {
  console.log(`🌐 ${label} を取得中...`);
  console.log(`   ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export function simplifyFeatureWithLabel(turf, feature, { tolerance = 0.02, name = 'unknown' } = {}) {
  let simplified;
  try {
    simplified = turf.simplify(feature, { tolerance, highQuality: false });
  } catch (error) {
    console.warn(`  ⚠️  simplify失敗 [${name}]: ${error.message} → 元データを使用`);
    simplified = feature;
  }

  let labelPoint = null;
  try {
    const centroid = turf.centerOfMass(simplified);
    const [lng, lat] = centroid.geometry.coordinates;
    labelPoint = [+lat.toFixed(6), +lng.toFixed(6)];
  } catch (error) {
    console.warn(`  ⚠️  centerOfMass失敗 [${name}]: ${error.message}`);
  }

  return {
    geometry: simplified.geometry,
    labelPoint
  };
}

export function writeWindowAssignment(outPath, globalName, value) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `window.${globalName} = ${JSON.stringify(value, null, 2)};\n`, 'utf8');
}

export function writeTextFile(outPath, content) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf8');
}

export function buildBasicMunicipalityFeature({
  id,
  name,
  geometry,
  labelPoint,
  areaCode = null,
  tags = [],
  extraProperties = {}
}) {
  return {
    type: 'Feature',
    properties: {
      id,
      name,
      area_code: areaCode,
      tags,
      labelPoint,
      ...extraProperties
    },
    geometry
  };
}

export async function generateAdminDataset({
  root,
  datasetId,
  datasetGlobal,
  sourceUrl = NATURAL_EARTH_ADMIN1_URL,
  sourceLabel = 'GeoJSON',
  featureFilter,
  emptyMessage,
  sampleFilter,
  idFromName,
  normalizeName = (name) => name,
  tolerance = 0.02,
  tagsFromFeature = () => [],
  extraPropertiesFromFeature = () => ({}),
  municipalityExtraFromFeature = () => ({}),
  progressLabel = (name) => name,
  onFeaturesLoaded = null,
  outputFileName = `${datasetId.replace(/_/g, '-')}.js`,
  logLabel = `${datasetId} features`
}) {
  const geojson = await fetchJson(sourceUrl, sourceLabel);
  const sourceFeatures = Array.isArray(geojson.features) ? geojson.features : [];
  console.log(`   全フィーチャー数: ${sourceFeatures.length}`);

  const filtered = sourceFeatures.filter(featureFilter);
  console.log(`\n🗺️  ${logLabel} 抽出: ${filtered.length} 件`);
  if (!filtered.length) {
    const sample = sampleFilter ? sourceFeatures.find(sampleFilter) : null;
    if (sample) console.log('  サンプルプロパティ:', JSON.stringify(sample.properties, null, 2));
    throw new Error(emptyMessage);
  }

  if (typeof onFeaturesLoaded === 'function') {
    onFeaturesLoaded(filtered);
  }

  console.log('\n⚙️  turf をロード中...');
  const turf = loadBundledTurf(root);
  console.log('   turf ロード完了');

  filtered.sort((a, b) => String(a?.properties?.name || '').localeCompare(String(b?.properties?.name || '')));
  console.log(`\n🔧 ジオメトリを簡略化中 (tolerance=${tolerance})...`);

  const features = [];
  const municipalities = [];

  for (const sourceFeature of filtered) {
    const rawName = String(sourceFeature?.properties?.name || '');
    const name = normalizeName(rawName, sourceFeature);
    const id = idFromName(rawName, sourceFeature);
    const { geometry, labelPoint } = simplifyFeatureWithLabel(turf, sourceFeature, { tolerance, name });

    features.push(buildBasicMunicipalityFeature({
      id,
      name,
      geometry,
      labelPoint,
      tags: tagsFromFeature(sourceFeature, name),
      extraProperties: extraPropertiesFromFeature(sourceFeature, name)
    }));

    municipalities.push({
      id,
      name,
      ...municipalityExtraFromFeature(sourceFeature, name)
    });
    process.stdout.write(`  ✅ ${progressLabel(name, sourceFeature)}\n`);
  }

  const payload = { id: datasetId, features, municipalities };
  const outPath = resolve(root, 'data', 'prefectures', outputFileName);
  writeWindowAssignment(outPath, datasetGlobal, payload);

  console.log(`\n✅ 書き出し完了: ${outPath}`);
  console.log(`   ファイルサイズ: ${(readFileSync(outPath, 'utf8').length / 1024).toFixed(1)} KB`);

  return { payload, outPath };
}
