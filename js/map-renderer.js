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
      this.tooltipsById = new Map();
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
      this.mainLayer = L.geoJSON(this.dataset, {
        pane: "mainPane",
        style: () => this.baseStyle(),
        onEachFeature: (feature, layer) => {
          const id = feature.properties.id;
          if (!this.layersById.has(id)) this.layersById.set(id, []);
          this.layersById.get(id).push(layer);
          layer.on({
            mouseover: () => layer.setStyle(this.hoverStyle()),
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
      if (mode === "ma") this.renderMaOverlay();
    }

    renderMaOverlay() {
      const features = window.MaUnion.buildMaCollections(this.dataset);
      this.maLayer = L.geoJSON({ type: "FeatureCollection", features }, {
        pane: "mainPane",
        interactive: false,
        style: {
          color: "#78b7c6",
          weight: 2,
          opacity: 0.28,
          fillOpacity: 0
        }
      }).addTo(this.map);
      this.maLayer.bringToBack();
      if (this.ghostLayer) this.ghostLayer.bringToBack();
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
      this.refreshFeatureStyle(id, this.answeredStyle(id));
      this.showLabel(id);
    }

    markGroupCorrect(predicate) {
      this.dataset.municipalities.filter(predicate).forEach((item) => this.markCorrect(item.id));
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

    showLabel(id) {
      if (this.tooltipsById.has(id)) return;
      const feature = this.dataset.features.find((item) => item.properties.id === id);
      if (!feature) return;
      const props = feature.properties;
      const point = props.labelPoint;
      if (!Array.isArray(point)) return;
      const html = `<div class="answered-label" style="font-size:${props.labelSize || 9.5}px; transform: rotate(${props.labelAngle || -25}deg);">${props.name}</div>`;
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

    refreshFeatureStyle(id, style) {
      const layers = this.layersById.get(id) || [];
      layers.forEach((layer) => layer.setStyle(style || this.baseStyle()));
    }

    reset() {
      this.layersById.forEach((layers) => layers.forEach((layer) => layer.setStyle(this.baseStyle())));
      this.tooltipsById.forEach((marker) => marker.remove());
      this.tooltipsById.clear();
    }

    applyHeatmap(stats) {
      const byId = new Map(stats.map((item) => [item.id, item]));
      this.layersById.forEach((layers, id) => {
        const stat = byId.get(id);
        const fillColor = heatColor(stat);
        layers.forEach((layer) => layer.setStyle({
          color: "#d7e1e8",
          weight: 1,
          opacity: 0.85,
          fillColor,
          fillOpacity: 0.88
        }));
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

  function hashCode(value) {
    return String(value).split("").reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
  }

  window.MapRenderer = MapRenderer;
})();
