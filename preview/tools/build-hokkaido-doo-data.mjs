import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const OUTPUT = "data/prefectures/hokkaido-doo.js";
const SOURCE = "https://geolonia.github.io/japanese-admins";

const ADMIN_LINES = `
hokkaido_doo_sapporo|札幌市|01101,01102,01103,01104,01105,01106,01107,01108,01109,01110|011|札幌MA|石狩|道庁所在地,政令指定都市,011
hokkaido_doo_ebetsu|江別市|01217|011|札幌MA|石狩|011,石狩平野
hokkaido_doo_chitose|千歳市|01224|0123|千歳MA|石狩|0123,空港
hokkaido_doo_eniwa|恵庭市|01231|0123|千歳MA|石狩|0123,恵庭岳
hokkaido_doo_ishikari|石狩市|01235|0133|石狩MA|石狩|0133,日本海
hokkaido_doo_kitahiroshima|北広島市|01234|011|札幌MA|石狩|011,ボールパーク
hokkaido_doo_tobetsu|当別町|01303|0133|石狩MA|石狩|0133
hokkaido_doo_shinshinotsu|新篠津村|01304|0126|岩見沢MA|石狩|0126,村
hokkaido_doo_yubari|夕張市|01209|0123|夕張MA|空知|0123,メロン
hokkaido_doo_iwamizawa|岩見沢市|01210|0126|岩見沢MA|空知|0126,空知
hokkaido_doo_bibai|美唄市|01215|0126|岩見沢MA|空知|0126,空知
hokkaido_doo_ashibetsu|芦別市|01216|0124|芦別MA|空知|0124,星の降る里
hokkaido_doo_akabira|赤平市|01218|0125|滝川MA|空知|0125,空知
hokkaido_doo_mikasa|三笠市|01222|01267|三笠MA|空知|01267,空知
hokkaido_doo_takikawa|滝川市|01225|0125|滝川MA|空知|0125,空知
hokkaido_doo_sunagawa|砂川市|01226|0125|滝川MA|空知|0125,空知
hokkaido_doo_utashinai|歌志内市|01227|0125|滝川MA|空知|0125,空知
hokkaido_doo_fukagawa|深川市|01228|0164|深川MA|空知|0164,空知
hokkaido_doo_nanporo|南幌町|01423|011|札幌MA|空知|011
hokkaido_doo_naie|奈井江町|01424|0125|滝川MA|空知|0125
hokkaido_doo_kamisunagawa|上砂川町|01425|0125|滝川MA|空知|0125
hokkaido_doo_yuni|由仁町|01427|0123|夕張MA|空知|0123
hokkaido_doo_naganuma|長沼町|01428|0123|夕張MA|空知|0123
hokkaido_doo_kuriyama|栗山町|01429|0123|夕張MA|空知|0123
hokkaido_doo_tsukigata|月形町|01430|0126|岩見沢MA|空知|0126
hokkaido_doo_urausu|浦臼町|01431|0125|滝川MA|空知|0125
hokkaido_doo_shintotsukawa|新十津川町|01432|0125|滝川MA|空知|0125
hokkaido_doo_moseushi|妹背牛町|01433|0164|深川MA|空知|0164
hokkaido_doo_chippubetsu|秩父別町|01434|0164|深川MA|空知|0164
hokkaido_doo_uryu|雨竜町|01436|0125|滝川MA|空知|0125
hokkaido_doo_hokuryu|北竜町|01437|0164|深川MA|空知|0164
hokkaido_doo_numata|沼田町|01438|0164|深川MA|空知|0164
hokkaido_doo_otaru|小樽市|01203|0134|小樽MA|後志|0134,港町
hokkaido_doo_shimamaki|島牧村|01391|0136|寿都MA|後志|0136,村
hokkaido_doo_suttu|寿都町|01392|0136|寿都MA|後志|0136
hokkaido_doo_kuromatsunai|黒松内町|01393|0136|寿都MA|後志|0136
hokkaido_doo_rankoshi|蘭越町|01394|0136|寿都MA|後志|0136
hokkaido_doo_niseko|ニセコ町|01395|0136|倶知安MA|後志|0136,スキー
hokkaido_doo_makkari|真狩村|01396|0136|倶知安MA|後志|0136,村
hokkaido_doo_rusutsu|留寿都村|01397|0136|倶知安MA|後志|0136,村
hokkaido_doo_kimobetsu|喜茂別町|01398|0136|倶知安MA|後志|0136
hokkaido_doo_kyogoku|京極町|01399|0136|倶知安MA|後志|0136
hokkaido_doo_kutchan|倶知安町|01400|0136|倶知安MA|後志|0136,羊蹄山
hokkaido_doo_kyowa|共和町|01401|0135|岩内MA|後志|0135
hokkaido_doo_iwanai|岩内町|01402|0135|岩内MA|後志|0135
hokkaido_doo_tomari|泊村|01403|0135|岩内MA|後志|0135,村
hokkaido_doo_kamoenai|神恵内村|01404|0135|岩内MA|後志|0135,村
hokkaido_doo_shakotan|積丹町|01405|0135|余市MA|後志|0135,積丹半島
hokkaido_doo_furubira|古平町|01406|0135|余市MA|後志|0135
hokkaido_doo_niki|仁木町|01407|0135|余市MA|後志|0135
hokkaido_doo_yoichi|余市町|01408|0135|余市MA|後志|0135,ウイスキー
hokkaido_doo_akaigawa|赤井川村|01409|0135|余市MA|後志|0135,村
hokkaido_doo_muroran|室蘭市|01205|0143|室蘭MA|胆振|0143,工業港
hokkaido_doo_tomakomai|苫小牧市|01213|0144|苫小牧MA|胆振|0144,港湾
hokkaido_doo_noboribetsu|登別市|01230|0143|室蘭MA|胆振|0143,温泉
hokkaido_doo_date|伊達市|01233|0142|伊達MA|胆振|0142
hokkaido_doo_toyoura|豊浦町|01571|0142|伊達MA|胆振|0142
hokkaido_doo_sobetsu|壮瞥町|01575|0142|伊達MA|胆振|0142
hokkaido_doo_shiraoi|白老町|01578|0144|苫小牧MA|胆振|0144
hokkaido_doo_atsuma|厚真町|01581|0145|鵡川MA|胆振|0145
hokkaido_doo_toyako|洞爺湖町|01584|0142|伊達MA|胆振|0142,洞爺湖
hokkaido_doo_abira|安平町|01585|0145|鵡川MA|胆振|0145
hokkaido_doo_mukawa|むかわ町|01586|0145|鵡川MA|胆振|0145,ししゃも
hokkaido_doo_hidaka|日高町|01601|01457|日高MA|日高|01457
hokkaido_doo_biratori|平取町|01602|01457|日高MA|日高|01457
hokkaido_doo_niikappu|新冠町|01604|0146|浦河MA|日高|0146
hokkaido_doo_urakawa|浦河町|01607|0146|浦河MA|日高|0146
hokkaido_doo_samani|様似町|01608|0146|浦河MA|日高|0146
hokkaido_doo_erimo|えりも町|01609|01466|えりもMA|日高|01466,岬
hokkaido_doo_shinhidaka|新ひだか町|01610|0146|浦河MA|日高|0146
`.trim().split("\n");

const admins = ADMIN_LINES.map((line) => {
  const [id, name, codeField, area_code, ma_name, region, tagsField] = line.split("|");
  const codes = codeField.includes(",") ? codeField.split(",") : [codeField];
  return {
    id,
    name,
    ...(codes.length > 1 ? { codes } : { code: codes[0] }),
    area_code,
    ma_name,
    region,
    tags: tagsField.split(",")
  };
});

function collectCoords(geometry, out = []) {
  if (!geometry) return out;
  if (geometry.type === "Polygon") geometry.coordinates.flat(1).forEach(([lng, lat]) => out.push([lng, lat]));
  if (geometry.type === "MultiPolygon") geometry.coordinates.flat(2).forEach(([lng, lat]) => out.push([lng, lat]));
  return out;
}

function labelPoint(geometry) {
  const coords = collectCoords(geometry);
  const lngs = coords.map((coord) => coord[0]);
  const lats = coords.map((coord) => coord[1]);
  return [
    +(lats.reduce((sum, value) => sum + value, 0) / lats.length).toFixed(6),
    +(lngs.reduce((sum, value) => sum + value, 0) / lngs.length).toFixed(6)
  ];
}

function labelSize(name) {
  if (name.length >= 6) return 7.6;
  if (name.length >= 5) return 8.1;
  if (name.length >= 4) return 8.8;
  return 9.5;
}

async function fetchAdmin(code) {
  const res = await fetch(`${SOURCE}/01/${code}.json`);
  if (!res.ok) throw new Error(`${code}: ${res.status} ${res.statusText}`);
  return res.json();
}

const features = [];

for (const admin of admins) {
  const codes = admin.codes ?? [admin.code];
  for (const code of codes) {
    const collection = await fetchAdmin(code);
    for (const feature of collection.features) {
      const geometry = feature.geometry;
      const props = {
        ...admin,
        sourceCode: code,
        labelPoint: labelPoint(geometry),
        labelAngle: admin.name.length >= 5 ? -18 : -25,
        labelSize: labelSize(admin.name)
      };
      delete props.code;
      delete props.codes;
      features.push({ type: "Feature", properties: props, geometry });
    }
    console.log(`fetched ${code}`);
  }
}

const rawFeatureCollection = { type: "FeatureCollection", features };
const rawVertexCount = countFeatureVertices(rawFeatureCollection);
const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(rawFeatureCollection, {
  interval: "120m",
  weighting: 0.75,
  minIslandArea: "8000m2",
  minSliverArea: "8000m2",
  sliverControl: 0.85
});
const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

for (const feature of simplifiedFeatureCollection.features) {
  feature.properties.labelPoint = labelPoint(feature.geometry);
}

const payload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "hokkaido_doo", name: "北海道道央", code: "01" },
  generatedAt: new Date().toISOString(),
  municipalities: admins.map(({ code, codes, ...rest }) => rest),
  features: simplifiedFeatureCollection.features
};

await mkdir("data/prefectures", { recursive: true });
await writeFile(OUTPUT, `window.HOKKAIDO_DOO_MUNICIPALITIES = ${JSON.stringify(payload)};\n`, "utf8");
console.log(
  `wrote ${OUTPUT} (${simplifiedFeatureCollection.features.length} drawable features, ${admins.length} quiz answers, vertices ${rawVertexCount} -> ${simplifiedVertexCount})`
);
