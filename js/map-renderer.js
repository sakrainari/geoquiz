(function () {
  const COLORS = {
    pending: "#2b3036",
    border: "#6b7280",
    hover: "#ffffff",
    correct: "#4fb7a5",
    correctAlt: "#d4b46a",
    miss1: "#d6c75f",
    miss2: "#d28d46",
    miss3: "#dc5c55",
    unanswered: "#4b5563"
  };

  class MapRenderer {
    constructor(elementId, dataset, ghostData) {
      this.dataset = dataset;
      this.ghostData = ghostData;
      this.layersById = new Map();
      this.areaCodeLayersByCode = new Map();
      this.areaCodeFeaturesByCode = new Map();
      this.displayFeaturesById = new Map();
      this.tooltipsById = new Map();
      this.areaCodeTooltipsByCode = new Map();
      this.answeredIds = new Set();
      this.answeredAreaCodes = new Set();
      this.heatmapStats = null;
      this.mode = "municipality";
      this.map = L.map(elementId, {
        zoomControl: true,
        attributionControl: true,
        minZoom: 8,
        maxZoom: 13
      });
      this.map.createPane("ghostPane").style.zIndex = 300;
      this.map.createPane("mainPane").style.zIndex = 450;
      this.map.createPane("labelPane").style.zIndex = 650;
      this.map.getPane("labelPane").style.pointerEvents = "none";
      this.renderGhost();
      this.renderMain();
      this.fitToMain();
    }

    renderGhost() {
      if (!this.ghostData) return;
      this.ghostLayer = L.geoJSON(this.ghostData, {
        pane: "ghostPane",
        interactive: false,
        style: {
          color: "#9ca3af",
          weight: 1,
          opacity: 0.16,
          fillColor: "#9ca3af",
          fillOpacity: 0.018
        }
      }).addTo(this.map);
    }

    renderMain() {
      const displayFeatures = buildMunicipalityDisplayFeatures(this.dataset);
      this.displayFeaturesById = new Map(displayFeatures.map((feature) => [feature.properties.id, feature]));
      this.mainLayer = L.geoJSON({ type: "FeatureCollection", features: displayFeatures }, {
        pane: "mainPane",
        style: () => this.baseStyle(),
        onEachFeature: (feature, layer) => {
          const id = feature.properties.id;
          if (!this.layersById.has(id)) this.layersById.set(id, []);
          this.layersById.get(id).push(layer);
          layer.on({
            mouseover: () => {
              const base = this.getFeatureStyle(id);
              layer.setStyle({
                ...base,
                color: COLORS.hover,
                weight: 2.2,
                opacity: 1,
                fillOpacity: 0.95
              });
            },
            mouseout: () => this.refreshFeatureStyle(id),
            click: () => this.onFeatureClick && this.onFeatureClick(feature, layer)
          });
          layer.once("add", () => {
            if (layer._path) layer._path.dataset.featureId = id;
          });
        }
      }).addTo(this.map);
    }

    setMode(mode) {
      this.mode = mode;
      if (this.maLayer) {
        this.map.removeLayer(this.maLayer);
        this.maLayer = null;
      }
      this.areaCodeLayersByCode.clear();
      this.areaCodeFeaturesByCode.clear();
      if (mode === "ma") this.renderMaOverlay();
    }

    renderMaOverlay() {
      const features = window.MaUnion.buildMaCollections(this.dataset, "area_code");
      this.areaCodeFeaturesByCode = new Map(features.map((feature) => [feature.properties.area_code, feature]));
      this.maLayer = L.geoJSON({ type: "FeatureCollection", features }, {
        pane: "mainPane",
        interactive: true,
        style: (feature) => this.getAreaCodeStyle(feature.properties.area_code),
        onEachFeature: (feature, layer) => {
          const areaCode = feature.properties.area_code;
          if (!this.areaCodeLayersByCode.has(areaCode)) this.areaCodeLayersByCode.set(areaCode, []);
          this.areaCodeLayersByCode.get(areaCode).push(layer);
          layer.on({
            mouseover: () => {
              layer.setStyle({
                ...this.getAreaCodeStyle(areaCode),
                color: COLORS.hover,
                weight: 2.4,
                opacity: 1,
                fillOpacity: 0.94
              });
            },
            mouseout: () => this.refreshAreaCodeStyle(areaCode),
            click: () => this.onFeatureClick && this.onFeatureClick(feature, layer)
          });
          layer.once("add", () => {
            if (layer._path) layer._path.dataset.areaCode = areaCode;
          });
        }
      }).addTo(this.map);
      this.maLayer.bringToFront();
    }

    onClick(handler) {
      this.onFeatureClick = handler;
    }

    fitToMain() {
      this.map.fitBounds(this.mainLayer.getBounds(), { padding: [24, 24] });
    }

    baseStyle() {
      return {
        color: COLORS.border,
        weight: 0.8,
        opacity: 0.65,
        fillColor: COLORS.pending,
        fillOpacity: 0.82
      };
    }

    hoverStyle() {
      return {
        color: COLORS.hover,
        weight: 2.2,
        opacity: 1,
        fillOpacity: 0.95
      };
    }

    answeredStyle(id) {
      const n = Math.abs(hashCode(id)) % 2;
      return {
        color: "#d7e1e8",
        weight: 1,
        opacity: 0.95,
        fillColor: n ? COLORS.correctAlt : COLORS.correct,
        fillOpacity: 0.86
      };
    }

    markCorrect(id) {
      this.answeredIds.add(id);
      this.refreshFeatureStyle(id);
      this.showLabel(id);
    }

    markGroupCorrect(predicate) {
      this.dataset.municipalities.filter(predicate).forEach((item) => this.markCorrect(item.id));
    }

    markAreaCodeCorrect(areaCode) {
      this.answeredAreaCodes.add(areaCode);
      this.refreshAreaCodeStyle(areaCode);
      this.showAreaCodeLabel(areaCode);
    }

    flashWrong(id) {
      const layers = this.layersById.get(id) || [];
      layers.forEach((layer) => layer.setStyle({
        color: "#ffffff",
        weight: 2.4,
        fillColor: COLORS.miss3,
        fillOpacity: 0.92
      }));
      window.setTimeout(() => this.refreshFeatureStyle(id), 260);
    }

    flashAreaCodeWrong(areaCode) {
      const layers = this.areaCodeLayersByCode.get(areaCode) || [];
      layers.forEach((layer) => layer.setStyle({
        color: "#ffffff",
        weight: 2.4,
        fillColor: COLORS.miss3,
        fillOpacity: 0.92
      }));
      window.setTimeout(() => this.refreshAreaCodeStyle(areaCode), 260);
    }

    showLabel(id) {
      if (this.tooltipsById.has(id)) return;
      const feature = this.displayFeaturesById.get(id)
        || this.dataset.features.find((item) => item.properties.id === id);
      if (!feature) return;
      const props = feature.properties;
      const label = buildLabelPlacement(feature, {
        sizeBoost: this.mode === "ma" ? -1.1 : 0,
        maxSize: this.mode === "ma" ? 10.6 : 13,
        angleLimit: this.mode === "ma" ? 18 : 28
      });
      const point = label.point || props.labelPoint;
      if (!Array.isArray(point)) return;
      const html = `<div class="answered-label" style="font-size:${label.size}px; transform: translate(-50%, -50%) rotate(${label.angle}deg);">${props.name}</div>`;
      const marker = L.marker(point, {
        pane: "labelPane",
        interactive: false,
        opacity: 0
      }).addTo(this.map);
      marker.bindTooltip(html, {
        permanent: true,
        direction: "center",
        className: "answered-tooltip",
        opacity: 1
      }).openTooltip();
      this.tooltipsById.set(id, marker);
    }

    showAreaCodeLabel(areaCode) {
      if (this.areaCodeTooltipsByCode.has(areaCode)) return;
      const feature = this.areaCodeFeaturesByCode.get(areaCode);
      if (!feature) return;
      const label = buildLabelPlacement(feature, {
        text: areaCode,
        minSize: 20,
        maxSize: 30,
        sizeBoost: 10,
        forceAngle: 0,
        precise: true,
        preferVisualCenter: true
      });
      if (!Array.isArray(label.point)) return;
      const html = `<div class="answered-label area-code-label" style="font-size:${label.size}px; transform: translate(-50%, -50%) rotate(${label.angle}deg);">${areaCode}</div>`;
      const marker = L.marker(label.point, {
        pane: "labelPane",
        interactive: false,
        opacity: 0
      }).addTo(this.map);
      marker.bindTooltip(html, {
        permanent: true,
        direction: "center",
        className: "answered-tooltip area-code-tooltip",
        opacity: 1
      }).openTooltip();
      this.areaCodeTooltipsByCode.set(areaCode, marker);
    }

    refreshFeatureStyle(id, style) {
      const layers = this.layersById.get(id) || [];
      const nextStyle = style || this.getFeatureStyle(id);
      layers.forEach((layer) => layer.setStyle(nextStyle));
    }

    getFeatureStyle(id) {
      if (this.heatmapStats && this.heatmapStats.has(id)) {
        const stat = this.heatmapStats.get(id);
        return {
          color: "#d7e1e8",
          weight: 1,
          opacity: 0.85,
          fillColor: heatColor(stat),
          fillOpacity: 0.88
        };
      }
      return this.answeredIds.has(id) ? this.answeredStyle(id) : this.baseStyle();
    }

    refreshAreaCodeStyle(areaCode) {
      const layers = this.areaCodeLayersByCode.get(areaCode) || [];
      layers.forEach((layer) => layer.setStyle(this.getAreaCodeStyle(areaCode)));
    }

    getAreaCodeStyle(areaCode) {
      if (this.answeredAreaCodes.has(areaCode)) {
        return {
          color: "#d7e1e8",
          weight: 1.2,
          opacity: 0.95,
          fillColor: Math.abs(hashCode(areaCode)) % 2 ? COLORS.correctAlt : COLORS.correct,
          fillOpacity: 0.86
        };
      }
      return {
        color: "#78b7c6",
        weight: 1.5,
        opacity: 0.5,
        fillColor: COLORS.pending,
        fillOpacity: 0.84
      };
    }

    reset() {
      this.answeredIds.clear();
      this.answeredAreaCodes.clear();
      this.heatmapStats = null;
      this.layersById.forEach((layers) => layers.forEach((layer) => layer.setStyle(this.baseStyle())));
      this.areaCodeLayersByCode.forEach((layers, areaCode) => {
        layers.forEach((layer) => layer.setStyle(this.getAreaCodeStyle(areaCode)));
      });
      this.tooltipsById.forEach((marker) => marker.remove());
      this.tooltipsById.clear();
      this.areaCodeTooltipsByCode.forEach((marker) => marker.remove());
      this.areaCodeTooltipsByCode.clear();
    }

    applyHeatmap(stats) {
      if (this.maLayer) {
        this.map.removeLayer(this.maLayer);
        this.maLayer = null;
        this.areaCodeLayersByCode.clear();
        this.areaCodeFeaturesByCode.clear();
      }
      this.heatmapStats = new Map(stats.map((item) => [item.id, item]));
      this.layersById.forEach((layers, id) => {
        this.refreshFeatureStyle(id);
        this.showLabel(id);
      });
    }
  }

  function heatColor(stat) {
    if (!stat || !stat.correct) return COLORS.unanswered;
    if (stat.mistakes === 0) return COLORS.correct;
    if (stat.mistakes === 1) return COLORS.miss1;
    if (stat.mistakes === 2) return COLORS.miss2;
    return COLORS.miss3;
  }

  function buildMunicipalityDisplayFeatures(dataset) {
    const groups = new Map();
    dataset.features.forEach((feature) => {
      const id = feature.properties.id;
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id).push(feature);
    });

    return [...groups.values()].map((features) => {
      if (features.length === 1) return features[0];

      const properties = {
        ...features[0].properties,
        sourceCodes: features.map((feature) => feature.properties.sourceCode).filter(Boolean),
        sourceFeatureCount: features.length
      };
      delete properties.labelPoint;

      return window.MaUnion.unionFeatures(features, properties);
    });
  }

  function buildLabelPlacement(feature, options = {}) {
    const box = geometryBounds(feature.geometry);
    const point = labelPointFromGeometry(feature, options);
    const ratio = box.width / Math.max(box.height, 0.000001);
    const text = options.text || feature.properties.name;
    return {
      point,
      size: labelSize(text, box, options),
      angle: typeof options.forceAngle === "number" ? options.forceAngle : labelAngle(feature, ratio, options)
    };
  }

  function labelPointFromGeometry(feature, options = {}) {
    const visualCenter = polygonVisualCenter(feature.geometry, options);
    if (visualCenter) return visualCenter;
    if (!window.turf) return null;
    const center = typeof window.turf.pointOnFeature === "function"
      ? window.turf.pointOnFeature(feature)
      : null;
    const coordinates = center && center.geometry && center.geometry.coordinates;
    return Array.isArray(coordinates) ? [coordinates[1], coordinates[0]] : null;
  }

  function labelSize(name, box, options = {}) {
    const span = Math.max(box.width, box.height);
    const chars = String(name || "").length;
    const base = span > 0.18 ? 12.8
      : span > 0.12 ? 11.8
        : span > 0.07 ? 10.6
          : span > 0.035 ? 9.4
            : 8.2;
    return clamp(
      base + (options.sizeBoost || 0) - Math.max(chars - 4, 0) * 0.45,
      options.minSize || 7.2,
      options.maxSize || 13
    );
  }

  function labelAngle(feature, ratio, options = {}) {
    const angleLimit = options.angleLimit || 28;
    if (ratio > 1.35) return clamp(principalAngle(feature.geometry), -angleLimit, angleLimit);
    if (ratio < 0.72) return clamp(principalAngle(feature.geometry), -18, 18);
    return 0;
  }

  function principalAngle(geometry) {
    const points = geometryPoints(geometry);
    if (points.length < 2) return 0;
    const mean = points.reduce((acc, point) => ({
      x: acc.x + point[0],
      y: acc.y + point[1]
    }), { x: 0, y: 0 });
    mean.x /= points.length;
    mean.y /= points.length;

    const sums = points.reduce((acc, point) => {
      const x = (point[0] - mean.x) * Math.cos(mean.y * Math.PI / 180);
      const y = point[1] - mean.y;
      return {
        xx: acc.xx + x * x,
        yy: acc.yy + y * y,
        xy: acc.xy + x * y
      };
    }, { xx: 0, yy: 0, xy: 0 });
    const angle = 0.5 * Math.atan2(2 * sums.xy, sums.xx - sums.yy) * 180 / Math.PI;
    return Math.abs(angle) < 6 ? 0 : angle;
  }

  function geometryBounds(geometry) {
    const points = geometryPoints(geometry);
    const bounds = points.reduce((box, point) => ({
      minX: Math.min(box.minX, point[0]),
      minY: Math.min(box.minY, point[1]),
      maxX: Math.max(box.maxX, point[0]),
      maxY: Math.max(box.maxY, point[1])
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    return {
      ...bounds,
      width: Math.max(bounds.maxX - bounds.minX, 0),
      height: Math.max(bounds.maxY - bounds.minY, 0)
    };
  }

  function polygonVisualCenter(geometry, options = {}) {
    const polygons = geometryPolygons(geometry);
    if (!polygons.length) return null;
    const polygon = largestPolygon(polygons);
    const outer = polygon[0];
    if (!outer || outer.length < 4) return null;

    const bounds = ringBounds(outer);
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    if (width <= 0 || height <= 0) return null;

    const steps = options.precise ? 28 : 12;
    let best = null;
    for (let ix = 0; ix <= steps; ix += 1) {
      for (let iy = 0; iy <= steps; iy += 1) {
        const x = bounds.minX + width * ix / steps;
        const y = bounds.minY + height * iy / steps;
        if (!pointInPolygon([x, y], polygon)) continue;
        const score = distanceToPolygonEdge([x, y], polygon);
        if (!best || score > best.score) best = { x, y, score };
      }
    }

    if (best && options.precise) {
      best = refineVisualCenter(best, polygon, width / steps, height / steps);
    }

    const centroid = ringCentroid(outer);
    if (!options.preferVisualCenter && centroid && pointInPolygon(centroid, polygon)) {
      const centroidScore = distanceToPolygonEdge(centroid, polygon);
      if (!best || centroidScore > best.score * 0.82) {
        best = { x: centroid[0], y: centroid[1], score: centroidScore };
      }
    }

    return best ? [best.y, best.x] : null;
  }

  function refineVisualCenter(start, polygon, cellWidth, cellHeight) {
    let best = start;
    let stepX = cellWidth;
    let stepY = cellHeight;
    for (let pass = 0; pass < 4; pass += 1) {
      const candidates = [
        [best.x, best.y],
        [best.x - stepX, best.y],
        [best.x + stepX, best.y],
        [best.x, best.y - stepY],
        [best.x, best.y + stepY],
        [best.x - stepX, best.y - stepY],
        [best.x + stepX, best.y - stepY],
        [best.x - stepX, best.y + stepY],
        [best.x + stepX, best.y + stepY]
      ];
      candidates.forEach((point) => {
        if (!pointInPolygon(point, polygon)) return;
        const score = distanceToPolygonEdge(point, polygon);
        if (score > best.score) best = { x: point[0], y: point[1], score };
      });
      stepX /= 2;
      stepY /= 2;
    }
    return best;
  }

  function geometryPolygons(geometry) {
    if (!geometry) return [];
    if (geometry.type === "Polygon") return [geometry.coordinates];
    if (geometry.type === "MultiPolygon") return geometry.coordinates;
    if (geometry.type === "GeometryCollection") {
      return geometry.geometries.flatMap((item) => geometryPolygons(item));
    }
    return [];
  }

  function largestPolygon(polygons) {
    return polygons.reduce((largest, polygon) => (
      Math.abs(ringArea(polygon[0])) > Math.abs(ringArea(largest[0])) ? polygon : largest
    ), polygons[0]);
  }

  function ringBounds(ring) {
    return ring.reduce((box, point) => ({
      minX: Math.min(box.minX, point[0]),
      minY: Math.min(box.minY, point[1]),
      maxX: Math.max(box.maxX, point[0]),
      maxY: Math.max(box.maxY, point[1])
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  }

  function ringCentroid(ring) {
    const area = ringArea(ring);
    if (!area) return null;
    let x = 0;
    let y = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const a = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
      x += (ring[j][0] + ring[i][0]) * a;
      y += (ring[j][1] + ring[i][1]) * a;
    }
    return [x / (6 * area), y / (6 * area)];
  }

  function ringArea(ring) {
    return ring.reduce((area, point, index) => {
      const prev = ring[index ? index - 1 : ring.length - 1];
      return area + (prev[0] * point[1] - point[0] * prev[1]);
    }, 0) / 2;
  }

  function pointInPolygon(point, polygon) {
    if (!pointInRing(point, polygon[0])) return false;
    return !polygon.slice(1).some((ring) => pointInRing(point, ring));
  }

  function pointInRing(point, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const xi = ring[i][0];
      const yi = ring[i][1];
      const xj = ring[j][0];
      const yj = ring[j][1];
      const intersects = ((yi > point[1]) !== (yj > point[1]))
        && (point[0] < (xj - xi) * (point[1] - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function distanceToPolygonEdge(point, polygon) {
    return polygon.reduce((minDistance, ring) => Math.min(minDistance, distanceToRing(point, ring)), Infinity);
  }

  function distanceToRing(point, ring) {
    let minDistance = Infinity;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      minDistance = Math.min(minDistance, distanceToSegment(point, ring[j], ring[i]));
    }
    return minDistance;
  }

  function distanceToSegment(point, a, b) {
    const x = point[0];
    const y = point[1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? clamp(((x - a[0]) * dx + (y - a[1]) * dy) / lengthSq, 0, 1) : 0;
    const px = a[0] + t * dx;
    const py = a[1] + t * dy;
    return Math.hypot(x - px, y - py);
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

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function hashCode(value) {
    return String(value).split("").reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
  }

  window.MapRenderer = MapRenderer;
})();
