/**
 * tools/patch-thailand-abbr.mjs
 *
 * data/prefectures/thailand.js の各フィーチャーに
 * name_abbr_th（タイ語略称）フィールドを追加する。
 *
 * 使い方:
 *   node tools/patch-thailand-abbr.mjs
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// タイ語名 → タイ語略称 のマッピング
const ABBR_MAP = {
  'อำนาจเจริญ':       'อจ',
  'อ่างทอง':          'อท',
  'กรุงเทพมหานคร':   'กทม',
  'บึงกาฬ':           'บก',
  'บุรีรัมย์':        'บร',
  'ฉะเชิงเทรา':       'ฉช',
  'ชัยนาท':           'ชน',
  'ชัยภูมิ':          'ชย',
  'จันทบุรี':         'จบ',
  'เชียงใหม่':        'ชม',
  'เชียงราย':         'ชร',
  'ชลบุรี':           'ชบ',
  'ชุมพร':            'ชพ',
  'กาฬสินธุ์':        'กส',
  'กำแพงเพชร':        'กพ',
  'กาญจนบุรี':        'กจ',
  'ขอนแก่น':          'ขก',
  'กระบี่':           'กบ',
  'ลำปาง':            'ลป',
  'ลำพูน':            'ลพ',
  'เลย':              'ลย',
  'ลพบุรี':           'ลบ',
  'แม่ฮ่องสอน':       'มส',
  'มหาสารคาม':        'มค',
  'มุกดาหาร':         'มห',
  'นครนายก':          'นย',
  'นครปฐม':           'นฐ',
  'นครพนม':           'นพ',
  'นครราชสีมา':       'นม',
  'นครสวรรค์':        'นว',
  'นครศรีธรรมราช':    'นศ',
  'น่าน':             'นน',
  'นราธิวาส':         'นธ',
  'หนองบัวลำภู':      'นภ',
  'หนองคาย':          'นค',
  'นนทบุรี':          'นบ',
  'ปทุมธานี':         'ปท',
  'ปัตตานี':          'ปน',
  'พังงา':            'พง',
  'พัทลุง':           'พท',
  'พะเยา':            'พย',
  'เพชรบูรณ์':        'พช',
  'เพชรบุรี':         'พบ',
  'พิจิตร':           'พจ',
  'พิษณุโลก':         'พล',
  'พระนครศรีอยุธยา':  'อย',
  'แพร่':             'พร',
  'ภูเก็ต':           'ภก',
  'ปราจีนบุรี':       'ปจ',
  'ประจวบคีรีขันธ์':  'ปข',
  'ระนอง':            'รน',
  'ราชบุรี':          'รบ',
  'ระยอง':            'รย',
  'ร้อยเอ็ด':         'รอ',
  'สระแก้ว':          'สก',
  'สกลนคร':           'สน',
  'สมุทรปราการ':      'สป',
  'สมุทรสาคร':        'สค',
  'สมุทรสงคราม':      'สส',
  'สระบุรี':          'สบ',
  'สตูล':             'สต',
  'สิงห์บุรี':        'สห',
  'ศรีสะเกษ':         'ศก',
  'สงขลา':            'สข',
  'สุโขทัย':          'สท',
  'สุพรรณบุรี':       'สพ',
  'สุราษฎร์ธานี':     'สฎ',
  'สุรินทร์':         'สร',
  'ตาก':              'ตก',
  'ตรัง':             'ตง',
  'ตราด':             'ตร',
  'อุบลราชธานี':      'อบ',
  'อุดรธานี':         'อด',
  'อุทัยธานี':        'อน',
  'อุตรดิตถ์':        'อต',
  'ยะลา':             'ยล',
  'ยโสธร':            'ยส',
};

const inPath  = resolve(ROOT, 'data/prefectures/thailand.js');
const outPath = inPath;

// window.THAILAND_MUNICIPALITIES = {...}; を parse
const src = readFileSync(inPath, 'utf-8');
const match = src.match(/^window\.THAILAND_MUNICIPALITIES\s*=\s*([\s\S]+?);\s*$/);
if (!match) throw new Error('パースできませんでした');

const data = JSON.parse(match[1]);

let patchedFeatures = 0;
let patchedMunis    = 0;
let missing         = [];

// features に追加
data.features = data.features.map((f) => {
  const nameTh = f.properties.name_th;
  if (!nameTh) return f;
  const abbr = ABBR_MAP[nameTh];
  if (!abbr) { missing.push(`feature: ${f.properties.name} (${nameTh})`); return f; }
  const props = { ...f.properties };
  // name_th の直後に name_abbr_th を挿入
  const ordered = {};
  for (const [k, v] of Object.entries(props)) {
    ordered[k] = v;
    if (k === 'name_th') ordered['name_abbr_th'] = abbr;
  }
  patchedFeatures++;
  return { ...f, properties: ordered };
});

// municipalities に追加
data.municipalities = data.municipalities.map((m) => {
  const nameTh = m.name_th;
  if (!nameTh) return m;
  const abbr = ABBR_MAP[nameTh];
  if (!abbr) return m;
  patchedMunis++;
  // name_th の直後に name_abbr_th を挿入
  const ordered = {};
  for (const [k, v] of Object.entries(m)) {
    ordered[k] = v;
    if (k === 'name_th') ordered['name_abbr_th'] = abbr;
  }
  return ordered;
});

if (missing.length) {
  console.warn('⚠️  略称マッピングなし:');
  missing.forEach((m) => console.warn('   ', m));
}

const content = `window.THAILAND_MUNICIPALITIES = ${JSON.stringify(data)};\n`;
writeFileSync(outPath, content, 'utf-8');

console.log(`✅ 完了: features ${patchedFeatures}件 / municipalities ${patchedMunis}件 に name_abbr_th を追加`);
console.log(`   出力: ${outPath}`);
