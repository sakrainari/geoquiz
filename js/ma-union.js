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
            area_code: feature.properties.area_code,
            ma_name: feature.properties.ma_name
          },
          features: []
        });
      }
      groups.get(key).features.push(feature);
    });
    return [...groups.values()].map((collection) => {
      const props = collection.properties;
      let geometry = null;
      if (window.turf && typeof window.turf.union === "function") {
        try {
          const unioned = window.turf.union(collection);
          geometry = unioned && unioned.geometry;
        } catch (error) {
          geometry = null;
        }
      }
      return {
        type: "Feature",
        properties: props,
        geometry: geometry || {
          type: "GeometryCollection",
          geometries: collection.features.map((feature) => feature.geometry)
        }
      };
    });
  }

  window.MaUnion = { buildMaCollections };
})();
