import { countFeatureVertices, simplifyFeatureCollectionWithMapshaper } from "./simplify-with-mapshaper.mjs";

export { countFeatureVertices };

const SIMPLIFY_OPTIONS = {
  interval: "600m",
  weighting: 0.78,
  minIslandArea: "150000m2",
  minSliverArea: "170000m2",
  sliverControl: 0.94
};

function approxPolygonArea(coords) {
  let area = 0;
  for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
    area += (coords[j][0] + coords[i][0]) * (coords[j][1] - coords[i][1]);
  }
  return Math.abs(area / 2);
}

function approxFeatureArea(feature) {
  const { geometry } = feature;
  if (!geometry) return 0;
  if (geometry.type === "Polygon") return geometry.coordinates.reduce((s, r) => s + approxPolygonArea(r), 0);
  if (geometry.type === "MultiPolygon") return geometry.coordinates.reduce((s, p) => s + p.reduce((s2, r) => s2 + approxPolygonArea(r), 0), 0);
  return 0;
}

// 同じidグループ内で最大面積の minRatio 未満の小ポリゴン（離島・飛び地）を除外する。
// 各idで必ず最大ポリゴンが1つ残るため、municipality/MAどちらのクイズも正解クリック可能。
function preFilterSmallIslands(features, minRatio = 0.01) {
  const groups = new Map();
  for (const f of features) {
    const id = f.properties.id;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push({ feature: f, area: approxFeatureArea(f) });
  }
  const result = [];
  for (const members of groups.values()) {
    const maxArea = Math.max(...members.map((m) => m.area));
    for (const { feature, area } of members) {
      if (members.length === 1 || area >= maxArea * minRatio) result.push(feature);
    }
  }
  return result;
}

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
    +(lats.reduce((s, v) => s + v, 0) / lats.length).toFixed(6),
    +(lngs.reduce((s, v) => s + v, 0) / lngs.length).toFixed(6)
  ];
}

/**
 * rawFeatures に preFilterSmallIslands + simplification を適用して返す。
 * 各 feature の properties.labelPoint も付与する。
 */
export async function simplifyAllFeatures(rawFeatures) {
  const rawCount = countFeatureVertices({ type: "FeatureCollection", features: rawFeatures });
  const filtered = preFilterSmallIslands(rawFeatures);
  const simplified = await simplifyFeatureCollectionWithMapshaper(
    { type: "FeatureCollection", features: filtered },
    SIMPLIFY_OPTIONS
  );
  for (const feature of simplified.features) {
    feature.properties.labelPoint = labelPoint(feature.geometry);
  }
  const simplifiedCount = countFeatureVertices(simplified);
  return { features: simplified.features, rawCount, simplifiedCount };
}
