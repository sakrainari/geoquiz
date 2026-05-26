import { mkdir, writeFile } from "node:fs/promises";
import {
  countFeatureVertices,
  simplifyFeatureCollectionWithMapshaper
} from "./lib/simplify-with-mapshaper.mjs";

const SOURCE = "https://geolonia.github.io/japanese-admins";

const mainlandAdmins = [
  // 23区
  { id: "tokyo_chiyoda", name: "千代田区", code: "13101", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "都心"] },
  { id: "tokyo_chuo", name: "中央区", code: "13102", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "都心"] },
  { id: "tokyo_minato", name: "港区", code: "13103", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "都心"] },
  { id: "tokyo_shinjuku", name: "新宿区", code: "13104", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "副都心"] },
  { id: "tokyo_bunkyo", name: "文京区", code: "13105", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_taito", name: "台東区", code: "13106", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_sumida", name: "墨田区", code: "13107", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_koto", name: "江東区", code: "13108", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_shinagawa", name: "品川区", code: "13109", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_meguro", name: "目黒区", code: "13110", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_ota", name: "大田区", code: "13111", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_setagaya", name: "世田谷区", code: "13112", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_shibuya", name: "渋谷区", code: "13113", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "副都心"] },
  { id: "tokyo_nakano", name: "中野区", code: "13114", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_suginami", name: "杉並区", code: "13115", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_toshima", name: "豊島区", code: "13116", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区", "副都心"] },
  { id: "tokyo_kita", name: "北区", code: "13117", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_arakawa", name: "荒川区", code: "13118", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_itabashi", name: "板橋区", code: "13119", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_nerima", name: "練馬区", code: "13120", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_adachi", name: "足立区", code: "13121", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_katsushika", name: "葛飾区", code: "13122", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  { id: "tokyo_edogawa", name: "江戸川区", code: "13123", area_code: "03", ma_name: "東京MA", region: "23区", tags: ["23区"] },
  // 多摩地域
  { id: "tokyo_hachioji", name: "八王子市", code: "13201", area_code: "042", ma_name: "八王子MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_tachikawa", name: "立川市", code: "13202", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_musashino", name: "武蔵野市", code: "13203", area_code: "0422", ma_name: "武蔵野三鷹MA", region: "多摩", tags: ["多摩", "吉祥寺"] },
  { id: "tokyo_mitaka", name: "三鷹市", code: "13204", area_code: "0422", ma_name: "武蔵野三鷹MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_ome", name: "青梅市", code: "13205", area_code: "0428", ma_name: "青梅MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_fuchu", name: "府中市", code: "13206", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_akishima", name: "昭島市", code: "13207", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_chofu", name: "調布市", code: "13208", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_machida", name: "町田市", code: "13209", area_code: "042", ma_name: "町田MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_koganei", name: "小金井市", code: "13210", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_kodaira", name: "小平市", code: "13211", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_hino", name: "日野市", code: "13212", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_higashimurayama", name: "東村山市", code: "13213", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_kokubunji", name: "国分寺市", code: "13214", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_kunitachi", name: "国立市", code: "13215", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_fussa", name: "福生市", code: "13218", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_komae", name: "狛江市", code: "13219", area_code: "03", ma_name: "東京MA", region: "多摩", tags: ["多摩", "03地区"] },
  { id: "tokyo_higashiyamato", name: "東大和市", code: "13220", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_kiyose", name: "清瀬市", code: "13221", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_higashikurume", name: "東久留米市", code: "13222", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_musashimurayama", name: "武蔵村山市", code: "13223", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_tama", name: "多摩市", code: "13224", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_inagi", name: "稲城市", code: "13225", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_hamura", name: "羽村市", code: "13227", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_akiruno", name: "あきる野市", code: "13228", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_nishitokyo", name: "西東京市", code: "13229", area_code: "042", ma_name: "多摩MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_mizuho", name: "瑞穂町", code: "13303", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_hinode", name: "日の出町", code: "13305", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩"] },
  { id: "tokyo_hinohara", name: "檜原村", code: "13307", area_code: "042", ma_name: "立川MA", region: "多摩", tags: ["多摩", "村"] },
  { id: "tokyo_okutama", name: "奥多摩町", code: "13308", area_code: "0428", ma_name: "青梅MA", region: "多摩", tags: ["多摩"] }
];

const islandAdmins = [
  { id: "tokyo_oshima", name: "大島町", code: "13361", area_code: "04992", ma_name: "大島MA", region: "島しょ", tags: ["島しょ", "伊豆諸島"] },
  { id: "tokyo_toshima_village", name: "利島村", code: "13362", area_code: "04992", ma_name: "大島MA", region: "島しょ", tags: ["島しょ", "村", "伊豆諸島"] },
  { id: "tokyo_niijima", name: "新島村", code: "13363", area_code: "04992", ma_name: "大島MA", region: "島しょ", tags: ["島しょ", "村", "伊豆諸島"] },
  { id: "tokyo_kozushima", name: "神津島村", code: "13364", area_code: "04992", ma_name: "大島MA", region: "島しょ", tags: ["島しょ", "村", "伊豆諸島"] },
  { id: "tokyo_miyake", name: "三宅村", code: "13381", area_code: "04994", ma_name: "三宅MA", region: "島しょ", tags: ["島しょ", "村", "伊豆諸島"] },
  { id: "tokyo_mikurajima", name: "御蔵島村", code: "13382", area_code: "04994", ma_name: "三宅MA", region: "島しょ", tags: ["島しょ", "村", "伊豆諸島"] },
  { id: "tokyo_hachijo", name: "八丈町", code: "13401", area_code: "04996", ma_name: "八丈MA", region: "島しょ", tags: ["島しょ", "伊豆諸島"] },
  { id: "tokyo_aogashima", name: "青ヶ島村", code: "13402", area_code: "04996", ma_name: "八丈MA", region: "島しょ", tags: ["島しょ", "村", "伊豆諸島"] },
  { id: "tokyo_ogasawara", name: "小笠原村", code: "13421", area_code: "04998", ma_name: "小笠原MA", region: "島しょ", tags: ["島しょ", "村", "小笠原"] }
];

const DATASETS = [
  {
    output: "data/prefectures/tokyo.js",
    globalName: "TOKYO_MUNICIPALITIES",
    prefecture: { id: "tokyo", name: "東京都", code: "13" },
    admins: mainlandAdmins,
    mergeByMunicipality: false,
    mapshaper: {
      interval: "25m",
      weighting: 0.75,
      minIslandArea: "1000m2",
      minSliverArea: "1000m2",
      sliverControl: 0.85
    }
  },
  {
    output: "data/prefectures/tokyo-islands.js",
    globalName: "TOKYO_ISLANDS_MUNICIPALITIES",
    prefecture: { id: "tokyo_islands", name: "東京都島しょ部", code: "13" },
    admins: islandAdmins,
    mergeByMunicipality: true,
    mapshaper: {
      interval: "40m",
      weighting: 0.75,
      minIslandArea: "300m2",
      minSliverArea: "300m2",
      sliverControl: 0.8
    }
  }
];

function collectCoords(geometry, out = []) {
  if (!geometry) return out;
  if (geometry.type === "Polygon") geometry.coordinates.flat(1).forEach(([lng, lat]) => out.push([lng, lat]));
  if (geometry.type === "MultiPolygon") geometry.coordinates.flat(2).forEach(([lng, lat]) => out.push([lng, lat]));
  return out;
}

function labelPoint(geometry) {
  const coords = collectCoords(geometry);
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    +(lats.reduce((a, b) => a + b, 0) / lats.length).toFixed(6),
    +(lngs.reduce((a, b) => a + b, 0) / lngs.length).toFixed(6)
  ];
}

function labelSize(name) {
  if (name.length >= 5) return 8.2;
  if (name.length >= 4) return 8.8;
  return 9.6;
}

async function fetchAdmin(code) {
  const res = await fetch(`${SOURCE}/13/${code}.json`);
  if (!res.ok) throw new Error(`${code}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function buildDataset(config) {
  const features = [];
  for (const admin of config.admins) {
    const collection = await fetchAdmin(admin.code);
    if (config.mergeByMunicipality) {
      const mergedGeometry = mergeFeaturesGeometry(collection.features);
      const geometry = config.simplify
        ? simplifyGeometry(mergedGeometry, config.simplify)
        : mergedGeometry;
      const props = {
        ...admin,
        sourceCode: admin.code,
        sourceFeatureCount: collection.features.length,
        labelPoint: labelPoint(geometry),
        labelAngle: admin.name.length >= 5 ? -18 : -25,
        labelSize: labelSize(admin.name)
      };
      delete props.code;
      features.push({ type: "Feature", properties: props, geometry });
    } else {
      for (const feature of collection.features) {
        const props = {
          ...admin,
          sourceCode: admin.code,
          labelPoint: labelPoint(feature.geometry),
          labelAngle: admin.name.length >= 5 ? -18 : -25,
          labelSize: labelSize(admin.name)
        };
        delete props.code;
        features.push({ type: "Feature", properties: props, geometry: feature.geometry });
      }
    }
    console.log(`fetched ${admin.code} (${admin.name})`);
  }

  const payload = {
    type: "FeatureCollection",
    source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
    prefecture: config.prefecture,
    generatedAt: new Date().toISOString(),
    municipalities: config.admins.map(({ code, ...rest }) => rest),
    features
  };

  const rawVertexCount = countFeatureVertices({ type: "FeatureCollection", features: payload.features });
  const simplifiedFeatureCollection = await simplifyFeatureCollectionWithMapshaper(
    { type: "FeatureCollection", features: payload.features },
    config.mapshaper || {}
  );
  const simplifiedVertexCount = countFeatureVertices(simplifiedFeatureCollection);

  for (const feature of simplifiedFeatureCollection.features) {
    feature.properties.labelPoint = labelPoint(feature.geometry);
  }

  const finalPayload = {
    ...payload,
    features: simplifiedFeatureCollection.features
  };

  await writePayload(config.output, config.globalName, finalPayload, {
    rawVertexCount,
    simplifiedVertexCount
  });
  return finalPayload;
}

async function writePayload(output, globalName, payload, stats = null) {
  await writeFile(output, `window.${globalName} = ${JSON.stringify(payload)};\n`, "utf8");
  const vertexInfo = stats
    ? `, vertices ${stats.rawVertexCount} -> ${stats.simplifiedVertexCount}`
    : "";
  console.log(`wrote ${output} (${payload.features.length} drawable features, ${payload.municipalities.length} quiz answers${vertexInfo})`);
}

function mergeFeaturesGeometry(features) {
  const polygons = [];
  for (const feature of features) {
    const geometry = feature && feature.geometry;
    if (!geometry) continue;
    if (geometry.type === "Polygon") {
      polygons.push(geometry.coordinates);
      continue;
    }
    if (geometry.type === "MultiPolygon") {
      polygons.push(...geometry.coordinates);
    }
  }
  return {
    type: "MultiPolygon",
    coordinates: polygons
  };
}

function simplifyGeometry(geometry, options = {}) {
  if (!geometry) return geometry;
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map((ring) => simplifyRing(ring, options))
    };
  }
  if (geometry.type === "MultiPolygon") {
    const polygons = selectLargestPolygons(geometry.coordinates, options.maxPolygonParts);
    return {
      type: "MultiPolygon",
      coordinates: polygons.map((polygon) => (
        polygon.map((ring) => simplifyRing(ring, options))
      ))
    };
  }
  return geometry;
}

function selectLargestPolygons(polygons, maxPolygonParts) {
  if (!Array.isArray(polygons) || !Number.isFinite(maxPolygonParts) || polygons.length <= maxPolygonParts) {
    return polygons;
  }
  return polygons
    .map((polygon) => ({ polygon, area: polygonAreaEstimate(polygon) }))
    .sort((a, b) => b.area - a.area)
    .slice(0, maxPolygonParts)
    .map((item) => item.polygon);
}

function polygonAreaEstimate(polygon) {
  const outer = Array.isArray(polygon) ? polygon[0] : null;
  if (!Array.isArray(outer) || outer.length < 4) return 0;
  let area = 0;
  for (let i = 0; i < outer.length - 1; i++) {
    const [x1, y1] = outer[i];
    const [x2, y2] = outer[i + 1];
    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area) / 2;
}

function simplifyRing(ring, options = {}) {
  if (!Array.isArray(ring) || ring.length <= (options.maxRingPoints || 120)) return ring;
  const maxRingPoints = Math.max(options.maxRingPoints || 120, 8);
  const minRingPoints = Math.max(options.minRingPoints || 18, 8);
  const open = ring.slice(0, -1);
  const stride = Math.max(1, Math.ceil(open.length / maxRingPoints));
  const simplified = open.filter((_, index) => index === 0 || index === open.length - 1 || index % stride === 0);
  while (simplified.length < minRingPoints && stride > 1) {
    const nextStride = Math.max(1, Math.floor(stride / 2));
    if (nextStride === stride) break;
    return simplifyRing(ring, { ...options, maxRingPoints: open.length / nextStride, minRingPoints });
  }
  const closed = [...simplified, simplified[0]];
  return closed.length >= 4 ? closed : ring;
}

await mkdir("data/prefectures", { recursive: true });
const builtPayloads = {};
for (const config of DATASETS) {
  builtPayloads[config.globalName] = await buildDataset(config);
}

const tokyoAllPayload = {
  type: "FeatureCollection",
  source: "geolonia/japanese-admins, derived from MLIT National Land Numerical Information administrative boundary data",
  prefecture: { id: "tokyo_all", name: "東京都（全域）", code: "13" },
  generatedAt: new Date().toISOString(),
  municipalities: [
    ...builtPayloads.TOKYO_MUNICIPALITIES.municipalities,
    ...builtPayloads.TOKYO_ISLANDS_MUNICIPALITIES.municipalities
  ],
  features: [
    ...builtPayloads.TOKYO_MUNICIPALITIES.features,
    ...builtPayloads.TOKYO_ISLANDS_MUNICIPALITIES.features
  ]
};

await writePayload("data/prefectures/tokyo-all.js", "TOKYO_ALL_MUNICIPALITIES", tokyoAllPayload);
