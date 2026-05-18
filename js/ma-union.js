(function () {
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
      unionFeatures(collection.features, collection.properties)
    ));
  }

  function unionFeatures(features, properties = {}) {
    let geometry = null;
    if (window.turf && typeof window.turf.union === "function") {
      try {
        const unioned = window.turf.union({ type: "FeatureCollection", features });
        geometry = unioned && unioned.geometry;
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

  window.MaUnion = { buildMaCollections, unionFeatures };
})();
