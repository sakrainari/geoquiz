(function () {
  const MIN_DETACHED_PART_AREA = 25000;
  const MIN_DETACHED_PART_RATIO = 0.005;

  function buildMaCollections(featureCollection, groupBy = "area_code") {
    const groups = new Map();
    featureCollection.features.forEach((feature) => {
      const key = feature.properties[groupBy];
      if (!groups.has(key)) {
        groups.set(key, {
          type: "FeatureCollection",
          properties: {
            groupBy,
            groupValue: key,
            id: `${groupBy}:${key}`,
            area_code: feature.properties.area_code,
            ma_name: feature.properties.ma_name,
            memberIds: []
          },
          features: []
        });
      }
      groups.get(key).properties.memberIds.push(feature.properties.id);
      groups.get(key).features.push(feature);
    });
    return [...groups.values()].map((collection) => (
      unionFeatures(collection.features, {
        ...collection.properties,
        labelPoint: preferredLabelPoint(collection.features)
      })
    ));
  }

  function unionFeatures(features, properties = {}) {
    let geometry = null;
    if (window.turf && typeof window.turf.union === "function") {
      try {
        const unioned = window.turf.union({ type: "FeatureCollection", features });
        geometry = filterUnionGeometry(unioned && unioned.geometry);
      } catch (error) {
        geometry = null;
      }
    }
    return {
      type: "Feature",
      properties,
      geometry: geometry || {
        type: "GeometryCollection",
        geometries: features.map((feature) => feature.geometry)
      }
    };
  }

  function filterUnionGeometry(geometry) {
    if (!geometry || geometry.type !== "MultiPolygon") return geometry;
    const polygons = geometry.coordinates
      .map((polygon) => ({
        coordinates: polygon,
        area: polygonArea(polygon)
      }))
      .filter((item) => item.area > 0);
    if (polygons.length <= 1) return geometry;

    const largestArea = polygons.reduce((max, item) => Math.max(max, item.area), 0);
    const minArea = Math.max(MIN_DETACHED_PART_AREA, largestArea * MIN_DETACHED_PART_RATIO);
    const kept = polygons.filter((item) => item.area >= minArea);
    if (!kept.length) {
      const largest = polygons.reduce((best, item) => (item.area > best.area ? item : best), polygons[0]);
      return {
        type: "Polygon",
        coordinates: largest.coordinates
      };
    }
    if (kept.length === 1) {
      return {
        type: "Polygon",
        coordinates: kept[0].coordinates
      };
    }
    return {
      type: "MultiPolygon",
      coordinates: kept.map((item) => item.coordinates)
    };
  }

  function polygonArea(coordinates) {
    if (!window.turf || typeof window.turf.area !== "function") {
      return geometryScore({ type: "Polygon", coordinates });
    }
    try {
      return window.turf.area({
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates
        }
      });
    } catch {
      return geometryScore({ type: "Polygon", coordinates });
    }
  }

  function preferredLabelPoint(features) {
    const candidates = features
      .map((feature) => ({
        point: feature.properties && feature.properties.labelPoint,
        score: geometryScore(feature.geometry)
      }))
      .filter((item) => Array.isArray(item.point) && item.point.length === 2)
      .sort((a, b) => b.score - a.score);
    if (!candidates.length) return null;
    const picked = candidates.slice(0, Math.min(4, candidates.length));
    const total = picked.reduce((sum, item) => sum + Math.max(item.score, 0.000001), 0);
    const lat = picked.reduce((sum, item) => sum + item.point[0] * Math.max(item.score, 0.000001), 0) / total;
    const lng = picked.reduce((sum, item) => sum + item.point[1] * Math.max(item.score, 0.000001), 0) / total;
    return [roundCoord(lat), roundCoord(lng)];
  }

  function geometryScore(geometry) {
    const points = geometryPoints(geometry);
    if (!points.length) return 0;
    const box = points.reduce((bounds, point) => ({
      minX: Math.min(bounds.minX, point[0]),
      minY: Math.min(bounds.minY, point[1]),
      maxX: Math.max(bounds.maxX, point[0]),
      maxY: Math.max(bounds.maxY, point[1])
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    return Math.max((box.maxX - box.minX) * (box.maxY - box.minY), 0.000001);
  }

  function geometryPoints(geometry) {
    if (!geometry) return [];
    if (geometry.type === "Polygon") return geometry.coordinates.flat();
    if (geometry.type === "MultiPolygon") return geometry.coordinates.flat(2);
    if (geometry.type === "GeometryCollection") {
      return geometry.geometries.flatMap((item) => geometryPoints(item));
    }
    return [];
  }

  function roundCoord(value) {
    return Number(value.toFixed(6));
  }

  window.MaUnion = { buildMaCollections, unionFeatures };
})();
