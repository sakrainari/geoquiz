import { execFile as execFileCallback } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import {
  fetchJson,
  loadBundledTurf,
  resolveProjectRoot,
  simplifyFeatureWithLabel,
  writeTextFile,
  writeWindowAssignment
} from './lib/geoquiz-import.mjs';
import { simplifyFeatureCollectionWithMapshaper } from './lib/simplify-with-mapshaper.mjs';

const ROOT = resolveProjectRoot(import.meta.url);
const MUNICIPALITIES_URL = 'https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-100-mun.json';
const MUNICIPALITY_DDD_URL = 'https://raw.githubusercontent.com/kelvins/Municipios-Brasileiros/main/csv/municipios.csv';
const DATASET_ID = 'brazil_area_codes';
const DATASET_GLOBAL = 'BRAZIL_AREA_CODES_MUNICIPALITIES';
const execFile = promisify(execFileCallback);
const MAPSHAPER_BIN = resolve(ROOT, 'node_modules', 'mapshaper', 'bin', 'mapshaper');

const UF_BY_CODE = {
  '11': 'RO',
  '12': 'AC',
  '13': 'AM',
  '14': 'RR',
  '15': 'PA',
  '16': 'AP',
  '17': 'TO',
  '21': 'MA',
  '22': 'PI',
  '23': 'CE',
  '24': 'RN',
  '25': 'PB',
  '26': 'PE',
  '27': 'AL',
  '28': 'SE',
  '29': 'BA',
  '31': 'MG',
  '32': 'ES',
  '33': 'RJ',
  '35': 'SP',
  '41': 'PR',
  '42': 'SC',
  '43': 'RS',
  '50': 'MS',
  '51': 'MT',
  '52': 'GO',
  '53': 'DF'
};

const DIGIT_READINGS = {
  '0': 'ゼロ',
  '1': 'いち',
  '2': 'に',
  '3': 'さん',
  '4': 'よん',
  '5': 'ご',
  '6': 'ろく',
  '7': 'なな',
  '8': 'はち',
  '9': 'きゅう'
};

function parseMunicipalityRows(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const header = lines.shift();
  if (!header) return [];
  const columns = header.split(',');
  return lines.map((line) => {
    const values = line.split(',');
    return Object.fromEntries(columns.map((column, index) => [column, values[index] ?? '']));
  });
}

function uniqueStrings(values) {
  return [...new Set(values.map((value) => String(value || '').trim()).filter(Boolean))];
}

function buildSpeechReading(ddd) {
  return String(ddd)
    .split('')
    .map((char) => DIGIT_READINGS[char] || char)
    .join(' ');
}

function fillGeometryHoles(geometry) {
  if (!geometry || !geometry.type) return geometry;
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: geometry.coordinates.length ? [geometry.coordinates[0]] : []
    };
  }
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: geometry.coordinates.map((polygon) => (polygon.length ? [polygon[0]] : []))
    };
  }
  return geometry;
}

async function dissolveByDdd(features) {
  const tempDir = await mkdtemp(resolve(tmpdir(), 'geoquiz-brazil-ddd-'));
  const inputPath = resolve(tempDir, 'input.geojson');
  const outputPath = resolve(tempDir, 'output.geojson');

  try {
    await writeFile(inputPath, JSON.stringify({
      type: 'FeatureCollection',
      features
    }), 'utf8');

    await execFile(
      process.execPath,
      [
        MAPSHAPER_BIN,
        inputPath,
        '-dissolve', '_ddd',
        '-filter-islands', 'min-area=25000m2', 'remove-empty',
        '-filter-slivers', 'min-area=25000m2', 'sliver-control=0.85', 'remove-empty',
        '-clean',
        '-o', 'format=geojson', outputPath
      ],
      { cwd: ROOT, maxBuffer: 1024 * 1024 * 100 }
    );

    const dissolved = JSON.parse(await readFile(outputPath, 'utf8'));
    return Array.isArray(dissolved.features) ? dissolved.features : [];
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function main() {
  const [municipalityGeojson, municipalityCsv] = await Promise.all([
    fetchJson(MUNICIPALITIES_URL, 'Brazil municipalities GeoJSON'),
    fetch(MUNICIPALITY_DDD_URL).then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }
      return response.text();
    })
  ]);

  const municipalityFeatures = Array.isArray(municipalityGeojson.features)
    ? municipalityGeojson.features
    : [];
  const municipalityRows = parseMunicipalityRows(municipalityCsv);
  console.log(`   自治体境界: ${municipalityFeatures.length} 件`);
  console.log(`   DDD 行数: ${municipalityRows.length} 件`);

  const dddByMunicipalityId = new Map();
  for (const row of municipalityRows) {
    const municipalityId = String(row.codigo_ibge || '').trim();
    const ddd = String(row.ddd || '').trim();
    if (!municipalityId || !ddd) continue;
    dddByMunicipalityId.set(municipalityId, {
      ddd,
      municipalityName: String(row.nome || '').trim(),
      uf: UF_BY_CODE[String(row.codigo_uf || '').trim()] || ''
    });
  }

  console.log('\n⚙️  turf をロード中...');
  const turf = loadBundledTurf(ROOT);
  console.log('   turf ロード完了');

  const grouped = new Map();
  const dissolveInputFeatures = [];
  let missingDddCount = 0;

  for (const feature of municipalityFeatures) {
    const properties = feature?.properties || {};
    const municipalityId = String(properties.id || '').trim();
    const municipalityName = String(properties.name || '').trim();
    const dddInfo = dddByMunicipalityId.get(municipalityId);
    if (!dddInfo) {
      missingDddCount += 1;
      continue;
    }

    const existing = grouped.get(dddInfo.ddd) || {
      ddd: dddInfo.ddd,
      ufs: new Set(),
      municipalities: [],
      polygons: []
    };

    if (dddInfo.uf) existing.ufs.add(dddInfo.uf);
    existing.municipalities.push(dddInfo.municipalityName || municipalityName);
    grouped.set(dddInfo.ddd, existing);

    dissolveInputFeatures.push({
      type: 'Feature',
      properties: {
        _ddd: dddInfo.ddd
      },
      geometry: feature.geometry
    });
  }

  if (missingDddCount) {
    console.log(`   DDD未対応自治体: ${missingDddCount} 件`);
  }

  const dddGroups = [...grouped.values()].sort((a, b) => Number(a.ddd) - Number(b.ddd));
  console.log(`\n🧩 DDDごとに dissolve 中... (${dddGroups.length} groups)`);
  const dissolvedFeatures = await dissolveByDdd(dissolveInputFeatures);
  console.log(`   dissolve 後: ${dissolvedFeatures.length} features`);

  console.log('\n🪶 dissolve 後ジオメトリを簡略化中...');
  const simplifiedDissolved = await simplifyFeatureCollectionWithMapshaper({
    type: 'FeatureCollection',
    features: dissolvedFeatures
  }, {
    interval: '800m',
    weighting: 0.78,
    minIslandArea: '80000m2',
    minSliverArea: '80000m2',
    sliverControl: 0.9
  });
  const dissolvedByDdd = new Map(
    (simplifiedDissolved.features || []).map((feature) => [String(feature?.properties?._ddd || '').trim(), feature])
  );

  const municipalities = [];
  const features = [];
  const speechReadings = {};

  for (const group of dddGroups) {
    const name = group.ddd;
    const id = `brazil_area_codes_${name}`;
    const region = [...group.ufs].sort().join(', ');
    const cities = uniqueStrings(group.municipalities).sort((a, b) => a.localeCompare(b));
    const dissolvedFeature = dissolvedByDdd.get(name);
    if (!dissolvedFeature?.geometry) {
      console.warn(`  ⚠️  dissolve結果が空です: DDD ${name}`);
      continue;
    }

    const mergedFeature = {
      type: 'Feature',
      properties: { id, name },
      geometry: fillGeometryHoles(dissolvedFeature.geometry)
    };
    const { geometry, labelPoint } = simplifyFeatureWithLabel(turf, mergedFeature, {
      tolerance: 0,
      name
    });

    municipalities.push({
      id,
      name,
      region,
      tags: cities.slice(0, 8)
    });

    features.push({
      type: 'Feature',
      properties: {
        id,
        name,
        area_code: null,
        region,
        cities,
        tags: [...group.ufs, ...cities].slice(0, 12),
        labelPoint
      },
      geometry
    });

    speechReadings[id] = buildSpeechReading(name);
    speechReadings[name] = buildSpeechReading(name);
  }

  const dataset = {
    id: DATASET_ID,
    source: {
      municipalities: MUNICIPALITIES_URL,
      ddd: MUNICIPALITY_DDD_URL
    },
    generatedAt: new Date().toISOString(),
    municipalities,
    features
  };

  writeWindowAssignment(
    resolve(ROOT, 'data', 'prefectures', 'brazil-area-codes.js'),
    DATASET_GLOBAL,
    dataset
  );

  writeTextFile(
    resolve(ROOT, 'data', 'brazil-area-codes', 'label-overrides.js'),
    'window.BRAZIL_AREA_CODES_LABEL_OVERRIDES = {\n  municipalities: {},\n  areaCodes: {}\n};\n'
  );

  writeWindowAssignment(
    resolve(ROOT, 'data', 'brazil-area-codes', 'speech-readings.js'),
    'BRAZIL_AREA_CODES_SPEECH_READINGS',
    speechReadings
  );

  console.log(`\n✅ 生成完了: ${municipalities.length} 問`);
  console.log('   data/prefectures/brazil-area-codes.js');
  console.log('   data/brazil-area-codes/label-overrides.js');
  console.log('   data/brazil-area-codes/speech-readings.js');
}

main().catch((error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});
