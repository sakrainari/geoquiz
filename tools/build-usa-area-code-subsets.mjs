import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { resolve } from 'node:path';
import { resolveProjectRoot, writeTextFile, writeWindowAssignment } from './lib/geoquiz-import.mjs';

const ROOT = resolveProjectRoot(import.meta.url);
const SOURCE_DATASET_PATH = resolve(ROOT, 'data', 'prefectures', 'usa-area-codes.js');
const SOURCE_SPEECH_PATH = resolve(ROOT, 'data', 'usa-area-codes', 'speech-readings.js');

const SUBSETS = [
  {
    id: 'usa_area_codes_west',
    global: 'USA_AREA_CODES_WEST_MUNICIPALITIES',
    speechGlobal: 'USA_AREA_CODES_WEST_SPEECH_READINGS',
    states: ['AZ', 'CA', 'CO', 'ID', 'MT', 'NM', 'NV', 'OR', 'UT', 'WA', 'WY']
  },
  {
    id: 'usa_area_codes_midwest',
    global: 'USA_AREA_CODES_MIDWEST_MUNICIPALITIES',
    speechGlobal: 'USA_AREA_CODES_MIDWEST_SPEECH_READINGS',
    states: ['IA', 'IL', 'IN', 'KS', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'SD', 'WI']
  },
  {
    id: 'usa_area_codes_south',
    global: 'USA_AREA_CODES_SOUTH_MUNICIPALITIES',
    speechGlobal: 'USA_AREA_CODES_SOUTH_SPEECH_READINGS',
    states: ['AL', 'AR', 'DC', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'OK', 'SC', 'TN', 'TX', 'VA', 'WV']
  },
  {
    id: 'usa_area_codes_northeast',
    global: 'USA_AREA_CODES_NORTHEAST_MUNICIPALITIES',
    speechGlobal: 'USA_AREA_CODES_NORTHEAST_SPEECH_READINGS',
    states: ['CT', 'MA', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT']
  },
  {
    id: 'usa_area_codes_california',
    global: 'USA_AREA_CODES_CALIFORNIA_MUNICIPALITIES',
    speechGlobal: 'USA_AREA_CODES_CALIFORNIA_SPEECH_READINGS',
    states: ['CA']
  }
];

function loadWindowGlobal(filePath, globalName) {
  const source = readFileSync(filePath, 'utf8');
  const context = { window: {} };
  vm.createContext(context);
  new vm.Script(source, { filename: filePath }).runInContext(context);
  const value = context.window[globalName];
  if (!value) throw new Error(`Missing ${globalName} in ${filePath}`);
  return value;
}

function featureMatchesStates(item, allowedStates) {
  const states = String(item?.region || item?.properties?.region || '')
    .split(',')
    .map((state) => state.trim())
    .filter(Boolean);
  return states.some((state) => allowedStates.has(state));
}

function buildSubset(baseDataset, baseSpeech, subset) {
  const allowedStates = new Set(subset.states);
  const municipalities = baseDataset.municipalities.filter((item) => featureMatchesStates(item, allowedStates));
  const ids = new Set(municipalities.map((item) => item.id));
  const features = baseDataset.features.filter((feature) => ids.has(feature?.properties?.id));
  const speechReadings = Object.fromEntries(
    municipalities
      .map((item) => [item.name, baseSpeech[item.name]])
      .filter(([, reading]) => Boolean(reading))
  );

  return {
    dataset: {
      ...baseDataset,
      id: subset.id,
      municipalities,
      features
    },
    speechReadings
  };
}

async function main() {
  const baseDataset = loadWindowGlobal(SOURCE_DATASET_PATH, 'USA_AREA_CODES_MUNICIPALITIES');
  const baseSpeech = loadWindowGlobal(SOURCE_SPEECH_PATH, 'USA_AREA_CODES_SPEECH_READINGS');

  for (const subset of SUBSETS) {
    const { dataset, speechReadings } = buildSubset(baseDataset, baseSpeech, subset);
    const hyphenId = subset.id.replace(/_/g, '-');

    writeWindowAssignment(
      resolve(ROOT, 'data', 'prefectures', `${hyphenId}.js`),
      subset.global,
      dataset
    );
    writeTextFile(
      resolve(ROOT, 'data', hyphenId, 'label-overrides.js'),
      `window.${subset.global.replace('_MUNICIPALITIES', '_LABEL_OVERRIDES')} = {\n  municipalities: {},\n  areaCodes: {}\n};\n`
    );
    writeWindowAssignment(
      resolve(ROOT, 'data', hyphenId, 'speech-readings.js'),
      subset.speechGlobal,
      speechReadings
    );

    console.log(`✅ ${subset.id}: ${dataset.municipalities.length} 問`);
  }
}

main().catch((error) => {
  console.error('❌ エラー:', error.message);
  process.exit(1);
});
