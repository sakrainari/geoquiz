(function () {
  const COLORS = {
    pending: "#2b3036",
    border: "#6b7280",
    hover: "#ffffff",
    correct: "#4fb7a5",
    puzzlePiece: "#33515a",
    puzzleOutline: "#f5d98a",
    correctAlt: "#d4b46a",
    miss1: "#d6c75f",
    miss2: "#d28d46",
    miss3: "#e35d5d",
    unanswered: "#4b5563"
  };

  class MapRenderer {
    constructor(elementId, dataset, ghostData, options = {}) {
      this.dataset = dataset;
      this.ghostData = ghostData;
      this.layersById = new Map();
      this.areaCodeLayersByCode = new Map();
      this.areaCodeFeaturesByCode = new Map();
      this.displayFeaturesById = new Map();
      this.hitTargetsById = new Map();
      this.hitTargetLayer = null;
      this.tooltipsById = new Map();
      this.areaCodeTooltipsByCode = new Map();
      this.answeredIds = new Set();
      this.answeredAreaCodes = new Set();
      this.answerMistakesById = new Map();
      this.areaCodeMistakesByCode = new Map();
      this.heatmapStats = null;
      this.areaCodeHeatmapStats = null;
      this._topAreaIdsCache = null;
      this._placementCache = new Map();
      this._maUnionCache = new Map();
      this._pendingLabelRender = null;
      this.confirmMode = false;
      this.labelEditDisplayCodes = new Set();
      this.labelEditEnabled = false;
      this.labelEditSelectedId = null;
      this.labelEditScope = "municipality";
      this.labelEditLabelsVisible = true;
      this.puzzleEnabled = false;
      this.puzzleFixedIds = new Set();
      this.puzzleStatesById = new Map();
      this.puzzleOutlineLayer = null;
      this.puzzleDrag = null;
      this.onPuzzleChange = null;
      this.liteMode = options.liteMode || false;
      this.preferCanvas = options.preferCanvas || false;
      this.initialView = options.initialView || null;
      this.labelBehavior = options.labelBehavior || {};
      this.labelStatesById = normalizeLabelOverrides(options.labelOverrides).municipalities;
      this.areaCodeLabelStatesByCode = normalizeLabelOverrides(options.labelOverrides).areaCodes;
      this.mode = "municipality";
      this.easyMode = false;
      this.map = L.map(elementId, {
        zoomControl: true,
        attributionControl: true,
        minZoom: options.mapMinZoom || 8,
        maxZoom: options.mapMaxZoom || 13,
        preferCanvas: this.preferCanvas
      });
      this.map.createPane("ghostPane").style.zIndex = 300;
      this.map.createPane("mainPane").style.zIndex = 450;
      this.map.createPane("hitPane").style.zIndex = 520;
      this.map.createPane("labelPane").style.zIndex = 650;
      this.map.getPane("hitPane").style.pointerEvents = "auto";
      this.map.getPane("labelPane").style.pointerEvents = "none";
      // preferCanvas 時はレイヤーごとに独立した canvas を持つ。
      // mainLayer と maLayer を共有 canvas にすると setStyle が両方を再描画するため分離する。
      this._canvasMain = this.preferCanvas ? L.canvas({ pane: "mainPane" }) : null;
      this._canvasMa   = this.preferCanvas ? L.canvas({ pane: "mainPane" }) : null;
      this._canvasGhost = this.preferCanvas ? L.canvas({ pane: "ghostPane" }) : null;
      // OSM tile layer — requires internet connection; disabled by default
      this.tileLayerVisible = false;
      this.tileLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        opacity: 0.35,
        maxZoom: 19
      });
      if (this._loadTileLayerPref()) {
        this.tileLayer.addTo(this.map);
        this.tileLayerVisible = true;
      }
      this.renderGhost();
      this.renderMain();
      this.fitToMain();
      this.map.on("zoomend", () => this._refreshVisibleLabels());
    }

    renderGhost() {
      if (!this.ghostData) return;
      this.ghostLayer = L.geoJSON(this.ghostData, {
        pane: "ghostPane",
        ...(this._canvasGhost ? { renderer: this._canvasGhost } : {}),
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
        ...(this._canvasMain ? { renderer: this._canvasMain } : {}),
        style: () => this.baseStyle(),
        onEachFeature: (feature, layer) => {
          const id = feature.properties.id;
          if (!this.layersById.has(id)) this.layersById.set(id, []);
          this.layersById.get(id).push(layer);
          layer.on({
            mouseover: () => {
              if (this.liteMode || this.puzzleEnabled || this.labelEditEnabled) return;
              const base = this.getFeatureStyle(id);
              layer.setStyle({
                ...base,
                color: COLORS.hover,
                weight: 2.2,
                opacity: 1,
                fillOpacity: 0.95
              });
            },
            mouseout: () => {
              if (this.labelEditEnabled) return;
              this.refreshFeatureStyle(id);
            },
            click: () => {
              if (this.labelEditEnabled) { this.selectEditableLabel(id); return; }
              this.onFeatureClick && this.onFeatureClick(feature, layer);
            }
          });
          if (layer.dragging) layer.dragging.disable();
          layer.once("add", () => {
            if (layer._path) layer._path.dataset.featureId = id;
          });
        }
      }).addTo(this.map);
      this.renderMunicipalityHitTargets(displayFeatures);
    }

    renderMunicipalityHitTargets(displayFeatures) {
      if (this.hitTargetLayer) {
        this.map.removeLayer(this.hitTargetLayer);
        this.hitTargetLayer = null;
      }
      this.hitTargetsById.clear();
      const targets = displayFeatures.filter((feature) => shouldCreateHitTarget(feature));
      if (!targets.length) return;
      this.hitTargetLayer = L.layerGroup().addTo(this.map);
      targets.forEach((feature) => {
        const id = feature.properties.id;
        const point = feature.properties.labelPoint || featureCenterOfMass(feature);
        if (!Array.isArray(point)) return;
        const radius = hitTargetRadius(feature);
        const marker = L.circleMarker(point, {
          pane: "hitPane",
          radius,
          stroke: false,
          fillColor: "#ffffff",
          fillOpacity: 0.01,
          interactive: true,
          bubblingMouseEvents: false
        });
        marker.on({
          mouseover: () => {
            if (this.liteMode || this.puzzleEnabled || this.labelEditEnabled) return;
            const base = this.getFeatureStyle(id);
            const layers = this.layersById.get(id) || [];
            layers.forEach((layer) => layer.setStyle({
              ...base,
              color: COLORS.hover,
              weight: 2.2,
              opacity: 1,
              fillOpacity: 0.95
            }));
          },
          mouseout: () => {
            if (this.labelEditEnabled) return;
            this.refreshFeatureStyle(id);
          },
          click: () => {
            if (this.labelEditEnabled) {
              this.selectEditableLabel(id);
              return;
            }
            this.onFeatureClick && this.onFeatureClick(feature, marker);
          }
        });
        marker.addTo(this.hitTargetLayer);
        this.hitTargetsById.set(id, marker);
      });
    }

    setMode(mode) {
      this.mode = mode;
      this.confirmMode = (mode === "confirm");
      if (this.puzzleEnabled && mode !== "puzzle") this.stopPuzzle();
      if (this.maLayer) {
        this.map.removeLayer(this.maLayer);
        this.maLayer = null;
      }
      this.areaCodeLayersByCode.clear();
      this.areaCodeFeaturesByCode.clear();
      if (mode === "ma") this.renderMaOverlay();
      if (mode === "ma_broad") this.renderMaBroadOverlay();
    }

    startPuzzle(onChange, options = {}) {
      this.puzzleEnabled = true;
      this.onPuzzleChange = onChange || this.onPuzzleChange;
      const selectedIds = new Set(options.pieceIds || [...this.displayFeaturesById.keys()]);
      this.puzzleFixedIds.clear();
      this.puzzleStatesById.clear();
      this.resetPuzzleLabelsAndStyles();
      this.renderPuzzleOutlines(selectedIds);
      const totalPieces = selectedIds.size;
      let pieceIndex = 0;
      this.displayFeaturesById.forEach((feature, id) => {
        if (!selectedIds.has(id)) {
          this.layersById.get(id).forEach((layer) => {
            layer.setStyle({
              color: "transparent",
              weight: 0,
              opacity: 0,
              fillColor: COLORS.pending,
              fillOpacity: 0
            });
            if (layer._path) layer._path.style.cursor = "";
          });
          return;
        }
        const offset = puzzleInitialOffset(pieceIndex, totalPieces);
        pieceIndex++;
        this.puzzleStatesById.set(id, {
          original: feature.geometry,
          offset,
          current: offset
        });
        this.applyPuzzleGeometry(id);
      });
      this.layersById.forEach((layers, id) => {
        if (!selectedIds.has(id)) return;
        layers.forEach((layer) => {
          layer.setStyle({
            color: "#b8e0df",
            weight: 1.25,
            opacity: 0.92,
            fillColor: COLORS.puzzlePiece,
            fillOpacity: 0.9
          });
          layer.on("mousedown", (event) => this.beginPuzzleDrag(id, event));
          layer.once("add", () => {
            if (layer._path) layer._path.dataset.puzzleFixed = "false";
          });
          if (layer._path) {
            layer._path.dataset.puzzleFixed = "false";
            layer._path.style.cursor = "move";
          }
        });
      });
      this.map.dragging.disable();
      this.notifyPuzzleChange();
    }

    renderPuzzleOutlines(selectedIds) {
      if (this.puzzleOutlineLayer) {
        this.map.removeLayer(this.puzzleOutlineLayer);
        this.puzzleOutlineLayer = null;
      }
      const features = [...selectedIds]
        .map((id) => this.displayFeaturesById.get(id))
        .filter(Boolean);
      this.puzzleOutlineLayer = L.geoJSON({ type: "FeatureCollection", features }, {
        pane: "mainPane",
        ...(this._canvasMain ? { renderer: this._canvasMain } : {}),
        interactive: false,
        style: {
          color: COLORS.puzzleOutline,
          weight: 1.35,
          opacity: 0.7,
          fillColor: COLORS.puzzleOutline,
          fillOpacity: 0.045,
          dashArray: "5 5"
        },
        onEachFeature: (feature, layer) => {
          layer.once("add", () => {
            if (layer._path) layer._path.dataset.puzzleOutline = "true";
          });
        }
      }).addTo(this.map);
      this.puzzleOutlineLayer.bringToBack();
      if (this.ghostLayer) this.ghostLayer.bringToBack();
    }

    stopPuzzle() {
      this.puzzleEnabled = false;
      this.puzzleDrag = null;
      this.map.off("mousemove", this.boundPuzzleMove);
      this.map.off("mouseup", this.boundPuzzleEnd);
      this.map.dragging.enable();
      if (this.puzzleOutlineLayer) {
        this.map.removeLayer(this.puzzleOutlineLayer);
        this.puzzleOutlineLayer = null;
      }
      this.layersById.forEach((layers, id) => {
        const state = this.puzzleStatesById.get(id);
        if (state) this.setFeatureGeometry(id, state.original);
        layers.forEach((layer) => {
          layer.off("mousedown");
          layer.setStyle(this.baseStyle());
          if (layer._path) {
            delete layer._path.dataset.puzzleFixed;
            layer._path.style.cursor = "";
          }
        });
      });
      this.puzzleFixedIds.clear();
      this.puzzleStatesById.clear();
    }

    resetPuzzleLabelsAndStyles() {
      this.answeredIds.clear();
      this.answerMistakesById.clear();
      this.heatmapStats = null;
      this._invalidateTopAreaCache();
      this.clearMunicipalityLabels();
      this.clearAreaCodeLabels();
    }

    beginPuzzleDrag(id, event) {
      if (!this.puzzleEnabled || this.puzzleFixedIds.has(id)) return;
      const state = this.puzzleStatesById.get(id);
      if (!state) return;
      this.puzzleDrag = {
        id,
        startLatLng: event.latlng,
        startOffset: { ...state.current }
      };
      this.boundPuzzleMove = this.boundPuzzleMove || ((moveEvent) => this.movePuzzleDrag(moveEvent));
      this.boundPuzzleEnd = this.boundPuzzleEnd || (() => this.endPuzzleDrag());
      this.map.on("mousemove", this.boundPuzzleMove);
      this.map.on("mouseup", this.boundPuzzleEnd);
      if (event.originalEvent) {
        event.originalEvent.preventDefault();
        event.originalEvent.stopPropagation();
      }
    }

    movePuzzleDrag(event) {
      if (!this.puzzleDrag) return;
      const state = this.puzzleStatesById.get(this.puzzleDrag.id);
      if (!state) return;
      state.current = {
        lat: this.puzzleDrag.startOffset.lat + (event.latlng.lat - this.puzzleDrag.startLatLng.lat),
        lng: this.puzzleDrag.startOffset.lng + (event.latlng.lng - this.puzzleDrag.startLatLng.lng)
      };
      this.applyPuzzleGeometry(this.puzzleDrag.id);
    }

    endPuzzleDrag() {
      if (!this.puzzleDrag) return;
      const id = this.puzzleDrag.id;
      this.map.off("mousemove", this.boundPuzzleMove);
      this.map.off("mouseup", this.boundPuzzleEnd);
      this.puzzleDrag = null;
      const state = this.puzzleStatesById.get(id);
      if (!state) return;
      const distance = Math.hypot(state.current.lat, state.current.lng);
      if (distance <= 0.035) {
        state.current = { lat: 0, lng: 0 };
        this.puzzleFixedIds.add(id);
        this.applyPuzzleGeometry(id);
        this.layersById.get(id).forEach((layer) => {
          layer.setStyle({
            color: "#d7e1e8",
            weight: 1.35,
            opacity: 0.95,
            fillColor: COLORS.correct,
            fillOpacity: 0.92
          });
          if (layer._path) {
            layer._path.dataset.puzzleFixed = "true";
            layer._path.style.cursor = "default";
          }
        });
        this.showLabel(id);
      }
      this.notifyPuzzleChange();
    }

    applyPuzzleGeometry(id) {
      const state = this.puzzleStatesById.get(id);
      if (!state) return;
      this.setFeatureGeometry(id, translateGeometry(state.original, state.current.lat, state.current.lng));
    }

    setFeatureGeometry(id, geometry) {
      const layers = this.layersById.get(id) || [];
      layers.forEach((layer) => {
        if (typeof layer.setLatLngs === "function") {
          layer.setLatLngs(geometryToLatLngs(geometry));
          layer.redraw();
        }
      });
    }

    notifyPuzzleChange() {
      if (this.onPuzzleChange) {
        this.onPuzzleChange({
          fixed: this.puzzleFixedIds.size,
          total: this.puzzleStatesById.size,
          complete: this.puzzleStatesById.size > 0 && this.puzzleFixedIds.size === this.puzzleStatesById.size
        });
      }
    }

    forceSolvePuzzleForTest() {
      if (!this.puzzleEnabled) return;
      this.puzzleStatesById.forEach((state, id) => {
        state.current = { lat: 0, lng: 0 };
        this.puzzleFixedIds.add(id);
        this.applyPuzzleGeometry(id);
        this.showLabel(id);
      });
      this.layersById.forEach((layers, id) => {
        layers.forEach((layer) => {
          layer.setStyle({
            color: "#d7e1e8",
            weight: 1,
            opacity: 0.95,
            fillColor: COLORS.correct,
            fillOpacity: 0.88
          });
          if (layer._path) layer._path.dataset.puzzleFixed = "true";
        });
      });
      this.notifyPuzzleChange();
    }

    getMaCollections(groupBy) {
      if (!this._maUnionCache.has(groupBy)) {
        const pre = window.__GEOQUIZ_PRECOMPUTED && window.__GEOQUIZ_PRECOMPUTED[this.dataset.id];
        const precomputed = pre && groupBy === "area_code" ? pre.maFeatures : null;
        this._maUnionCache.set(groupBy, precomputed || window.MaUnion.buildMaCollections(this.dataset, groupBy));
      }
      return this._maUnionCache.get(groupBy);
    }

    getMaBroadCollections() {
      if (!this._maUnionCache.has("broad")) {
        const pre = window.__GEOQUIZ_PRECOMPUTED && window.__GEOQUIZ_PRECOMPUTED[this.dataset.id];
        this._maUnionCache.set("broad", (pre && pre.maBroadFeatures) || window.MaUnion.buildMaBroadCollections(this.dataset));
      }
      return this._maUnionCache.get("broad");
    }

    renderMaOverlay() {
      const features = this.getMaCollections("area_code");
      this._renderAreaCodeLayer(features);
    }

    renderMaBroadOverlay() {
      const features = this.getMaBroadCollections();
      this._renderAreaCodeLayer(features);
    }

    _renderAreaCodeLayer(features) {
      this.areaCodeFeaturesByCode = new Map(features.map((feature) => [feature.properties.area_code, feature]));
      this.maLayer = L.geoJSON({ type: "FeatureCollection", features }, {
        pane: "mainPane",
        ...(this._canvasMa ? { renderer: this._canvasMa } : {}),
        interactive: true,
        style: (feature) => this.getAreaCodeStyle(feature.properties.area_code),
        onEachFeature: (feature, layer) => {
          const areaCode = feature.properties.area_code;
          if (!this.areaCodeLayersByCode.has(areaCode)) this.areaCodeLayersByCode.set(areaCode, []);
          this.areaCodeLayersByCode.get(areaCode).push(layer);
          layer.on({
            mouseover: () => {
              if (this.liteMode || this.labelEditEnabled) return;
              layer.setStyle({
                ...this.getAreaCodeStyle(areaCode),
                color: COLORS.hover,
                weight: 2.4,
                opacity: 1,
                fillOpacity: 0.94
              });
            },
            mouseout: () => {
              if (this.labelEditEnabled) return;
              this.refreshAreaCodeStyle(areaCode);
            },
            click: () => {
              if (this.labelEditEnabled) { this.selectEditableAreaCodeLabel(areaCode); return; }
              this.onFeatureClick && this.onFeatureClick(feature, layer);
            }
          });
          layer.once("add", () => {
            if (layer._path) layer._path.dataset.areaCode = areaCode;
          });
        }
      }).addTo(this.map);
      this.maLayer.bringToFront();
    }

    toggleTileLayer() {
      this.tileLayerVisible = !this.tileLayerVisible;
      if (this.tileLayerVisible) {
        this.tileLayer.addTo(this.map);
        this.tileLayer.bringToBack();
      } else {
        this.map.removeLayer(this.tileLayer);
      }
      this._saveTileLayerPref(this.tileLayerVisible);
      return this.tileLayerVisible;
    }

    _loadTileLayerPref() {
      try {
        return window.localStorage.getItem("geoquiz:tilelayer") === "1";
      } catch {
        return false;
      }
    }

    _saveTileLayerPref(visible) {
      try {
        window.localStorage.setItem("geoquiz:tilelayer", visible ? "1" : "0");
      } catch {
        // localStorage unavailable; tile preference is non-critical
      }
    }

    onClick(handler) {
      this.onFeatureClick = handler;
    }

    fitToMain() {
      if (this.initialView && Array.isArray(this.initialView.center) && typeof this.initialView.zoom === "number") {
        this.map.setView(this.initialView.center, this.initialView.zoom);
        return;
      }
      const preferredBounds = preferredMainBounds(this.dataset);
      this.map.fitBounds(preferredBounds || this.mainLayer.getBounds(), { padding: [24, 24] });
    }

    municipalityLabelDisplayMode() {
      if (this.mode === "ma" || this.mode === "ma_broad") return "subtle";
      if (!this.easyMode) return "answered";
      if (this.mode === "municipality") return "all";
      return "answered";
    }

    areaCodeLabelDisplayMode() {
      if (this.mode !== "ma" && this.mode !== "ma_broad") return "answered";
      return this.easyMode ? "all" : "answered";
    }

    _refreshVisibleLabels() {
      this.tooltipsById.forEach((marker) => marker.remove());
      this.tooltipsById.clear();
      this._invalidateTopAreaCache();
      const municipalityLabelMode = this.municipalityLabelDisplayMode();
      if (municipalityLabelMode !== "answered") {
        this.dataset.municipalities
          .filter((item) => {
            const feature = this.displayFeaturesById.get(item.id)
              || this.dataset.features.find((entry) => entry.properties.id === item.id);
            const props = feature ? feature.properties : item;
            if (municipalityLabelMode === "subtle") return this.shouldShowSubtleMunicipalityLabel(props);
            return this.shouldShowPendingEasyMunicipalityLabel(props);
          })
          .forEach((item) => this.showLabel(item.id));
      } else {
        this.answeredIds.forEach(id => this.showLabel(id));
      }

      this.areaCodeTooltipsByCode.forEach((marker) => marker.remove());
      this.areaCodeTooltipsByCode.clear();
      if (this.areaCodeLabelDisplayMode() === "all") {
        this.areaCodeFeaturesByCode.forEach((_feature, areaCode) => this.showAreaCodeLabel(areaCode));
      } else {
        this.answeredAreaCodes.forEach((code) => this.showAreaCodeLabel(code));
      }
    }

    _invalidateTopAreaCache() {
      this._topAreaIdsCache = null;
    }

    _getTopAreaIds() {
      if (this._topAreaIdsCache) return this._topAreaIdsCache;
      const areas = [];
      this.answeredIds.forEach(id => {
        const feature = this.displayFeaturesById.get(id);
        if (!feature) return;
        const box = geometryBounds(feature.geometry);
        areas.push({ id, area: box.width * box.height });
      });
      areas.sort((a, b) => b.area - a.area);
      this._topAreaIdsCache = new Set(areas.slice(0, 15).map(item => item.id));
      return this._topAreaIdsCache;
    }

    _shouldShowAtCurrentZoom(id, feature) {
      if (this.puzzleEnabled) return true;
      const zoom = this.map.getZoom();
      if (zoom >= 11) return true;
      const name = feature.properties.name || "";
      const isCity = /[市区]$/.test(name);
      if (zoom >= 10) return isCity;
      return this._getTopAreaIds().has(id);
    }

    baseStyle() {
      const areaCodeMode = this.mode === "ma" || this.mode === "ma_broad";
      return {
        color: COLORS.border,
        weight: 0.8,
        opacity: areaCodeMode
          ? (this.tileLayerVisible ? 0.12 : 0.34)
          : (this.tileLayerVisible ? 0.58 : 0.65),
        fillColor: COLORS.pending,
        fillOpacity: this.labelEditEnabled
          ? 0.45
          : areaCodeMode
            ? (this.tileLayerVisible ? 0.08 : 0.28)
            : (this.tileLayerVisible ? 0.68 : 0.82)
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
      const mistakes = this.answerMistakesById.get(id) || 0;
      return {
        color: "#d7e1e8",
        weight: 1,
        opacity: 0.95,
        fillColor: answerColor(mistakes),
        fillOpacity: this.tileLayerVisible ? 0.74 : 0.86
      };
    }

    markCorrect(id, mistakesBeforeCorrect = 0) {
      this.answeredIds.add(id);
      this.answerMistakesById.set(id, mistakesBeforeCorrect);
      this._invalidateTopAreaCache();
      this.refreshFeatureStyle(id);
      this.showLabel(id);
    }

    markGroupCorrect(predicate) {
      this.dataset.municipalities.filter(predicate).forEach((item) => this.markCorrect(item.id));
    }

    markAreaCodeCorrect(areaCode, mistakesBeforeCorrect = 0) {
      this.answeredAreaCodes.add(areaCode);
      this.areaCodeMistakesByCode.set(areaCode, mistakesBeforeCorrect);
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

    highlightFailureFeature(id) {
      if (!id) return;
      this.refreshFeatureStyle(id, {
        color: "#ffffff",
        weight: 2.6,
        opacity: 1,
        fillColor: COLORS.miss3,
        fillOpacity: 0.92
      });
      this.showLabel(id);
    }

    highlightFailureAreaCode(areaCode) {
      if (!areaCode) return;
      const layers = this.areaCodeLayersByCode.get(areaCode) || [];
      layers.forEach((layer) => layer.setStyle({
        color: "#ffffff",
        weight: 2.8,
        opacity: 1,
        fillColor: COLORS.miss3,
        fillOpacity: 0.92
      }));
      this.showAreaCodeLabel(areaCode);
    }

    showLabel(id) {
      if (this.labelEditEnabled && (!this.labelEditLabelsVisible || this.labelEditScope !== "municipality")) return;
      if (this.tooltipsById.has(id)) return;
      const feature = this.displayFeaturesById.get(id)
        || this.dataset.features.find((item) => item.properties.id === id);
      if (!feature) return;
      const props = feature.properties;
      if (this.liteMode && !this.labelEditEnabled && !this.shouldShowLiteLabel(props)) return;
      // Easy mode: 未回答の市区町村は代表的な「市」「区」のみ表示。回答済みは常に表示。
      if (this.easyMode && !this.answeredIds.has(id) && this.municipalityLabelDisplayMode() === "all"
          && !this.shouldShowPendingEasyMunicipalityLabel(props)) return;
      const labelDisplayMode = this.municipalityLabelDisplayMode();
      if (labelDisplayMode === "answered" && !this.labelEditEnabled && !this.liteMode && !this.confirmMode && !this._shouldShowAtCurrentZoom(id, feature)) return;
      const label = this.resolveLabelPlacement(id, feature, {
        sizeBoost: this.mode === "ma" ? -0.8 : 0.2,
        minSize: this.mode === "ma" ? 8.4 : 8.2,
        maxSize: this.mode === "ma" ? 11.2 : 13.8,
        angleLimit: this.mode === "ma" ? 18 : 28,
        zoom: this.map.getZoom()
      });
      const defaultPoint = this.labelBehavior.forcePreferredPoint
        ? (props.labelPoint || label.point || featureCenterOfMass(feature))
        : (label.point || featureCenterOfMass(feature));
      const points = Array.isArray(label.points) && label.points.length
        ? label.points.filter((point) => Array.isArray(point) && point.length === 2)
        : (Array.isArray(defaultPoint) ? [defaultPoint] : []);
      if (!points.length) return;
      const labelSize = Math.max(label.size, this.labelBehavior.minMunicipalitySize || 0);
      const selected = this.labelEditSelectedId === id;
      const subtle = labelDisplayMode === "subtle";
      const pendingEasy = labelDisplayMode === "all" && !this.answeredIds.has(id);
      const html = `<div class="answered-label municipality-label${subtle ? " is-subtle" : ""}${pendingEasy ? " is-pending-easy" : ""}${selected ? " is-selected" : ""}" style="font-size:${labelSize}px; transform: translate(-50%, -50%) rotate(${label.angle}deg);">${props.name}</div>`;
      const markers = points.map((point) => {
        const marker = L.marker(point, {
          pane: "labelPane",
          opacity: 0,
          interactive: false,
          icon: L.divIcon({ className: "", iconSize: [0, 0] })
        });
        marker.bindTooltip(html, {
          permanent: true,
          direction: "center",
          className: "answered-tooltip",
          opacity: 1
        }).openTooltip();
        return marker;
      });
      const group = L.layerGroup(markers);
      group.addTo(this.map);
      this.tooltipsById.set(id, group);
    }

    shouldShowLiteLabel(props) {
      if (this.puzzleEnabled) return false;
      const importantTags = ["県庁所在地", "政令指定都市", "小面積", "村"];
      return importantTags.some((tag) => (props.tags || []).includes(tag))
        || ["saitama_tokorozawa", "saitama_chichibu", "saitama_kawaguchi"].includes(props.id);
    }

    shouldShowPendingEasyMunicipalityLabel(props) {
      return this.matchesMunicipalityLabelRule(
        props,
        this.labelBehavior.easyMunicipalityTags,
        this.labelBehavior.easyMunicipalityNameSuffixes,
        ["市", "区"]
      );
    }

    shouldShowSubtleMunicipalityLabel(props) {
      return this.matchesMunicipalityLabelRule(
        props,
        this.labelBehavior.subtleMunicipalityTags,
        this.labelBehavior.subtleMunicipalityNameSuffixes,
        ["市"]
      );
    }

    matchesMunicipalityLabelRule(props, tags, suffixes, fallbackSuffixes) {
      const name = String((props && props.name) || "");
      const labelTags = Array.isArray(props && props.tags) ? props.tags : [];
      const normalizedTags = Array.isArray(tags) ? tags.filter(Boolean) : [];
      const normalizedSuffixes = Array.isArray(suffixes) ? suffixes.filter(Boolean) : [];
      if (normalizedTags.length && normalizedTags.some((tag) => labelTags.includes(tag))) return true;
      if (normalizedSuffixes.length && normalizedSuffixes.some((suffix) => name.endsWith(suffix))) return true;
      if (normalizedTags.length || normalizedSuffixes.length) return false;
      return fallbackSuffixes.some((suffix) => name.endsWith(suffix));
    }

    enableLabelEditor(onChange) {
      this.labelEditEnabled = true;
      this.onLabelEditChange = onChange;
      this.setLabelEditorScope("municipality");
      this.fitToMain();
      this.notifyLabelEditChange();
    }

    setLabelEditorScope(scope, options = {}) {
      this.labelEditScope = scope === "areaCode" ? "areaCode" : "municipality";
      if (!options.preserveSelection) this.labelEditSelectedId = null;
      this.layersById.forEach((layers) => layers.forEach((layer) => layer.setStyle(this.baseStyle())));
      this.labelEditDisplayCodes.clear();
      this.clearMunicipalityLabels();
      this.clearAreaCodeLabels();
      if (this.labelEditScope === "areaCode") {
        this.setMode("ma");
        this.areaCodeFeaturesByCode.forEach((feature, areaCode) => {
          this.labelEditDisplayCodes.add(areaCode);
          this.refreshAreaCodeStyle(areaCode);
          this.showAreaCodeLabel(areaCode);
        });
      } else {
        this.setMode("municipality");
        this.dataset.municipalities.forEach((item) => {
          this.answeredIds.add(item.id);
          this.showLabel(item.id);
        });
      }
      this.notifyLabelEditChange();
    }

    setLabelEditorVisibility(visible) {
      this.labelEditLabelsVisible = visible;
      this.setLabelEditorScope(this.labelEditScope, { preserveSelection: true });
    }

    selectEditableLabel(id) {
      const previousId = this.labelEditSelectedId;
      this.labelEditSelectedId = id;
      if (previousId && !previousId.startsWith("areaCode:")) this.refreshLabel(previousId);
      this.refreshLabel(id);
      this.notifyLabelEditChange();
    }

    updateSelectedLabel(values) {
      if (!this.labelEditSelectedId) return;
      if (this.labelEditSelectedId.startsWith("areaCode:")) {
        this.updateAreaCodeLabelState(this.labelEditSelectedId.replace("areaCode:", ""), values);
      } else {
        this.updateLabelState(this.labelEditSelectedId, values);
      }
    }

    nudgeSelectedLabel(_deltaLat, _deltaLng) {
      // Position is auto-computed from polygon bounds; nudge not applicable
    }

    selectLabelTarget(targetId) {
      if (!targetId) return;
      if (targetId.startsWith("areaCode:")) {
        this.selectEditableAreaCodeLabel(targetId.replace("areaCode:", ""));
      } else {
        this.selectEditableLabel(targetId);
      }
    }

    labelEditorTargets() {
      if (this.labelEditScope === "areaCode") {
        return [...this.areaCodeFeaturesByCode.keys()]
          .sort()
          .map((areaCode) => ({
            id: `areaCode:${areaCode}`,
            label: areaCode,
            edited: this.areaCodeLabelStatesByCode.has(areaCode)
          }));
      }

      return this.dataset.municipalities.map((item) => ({
        id: item.id,
        label: item.name,
        edited: this.labelStatesById.has(item.id)
      }));
    }

    updateLabelState(id, values) {
      for (const key of this._placementCache.keys()) {
        if (key.startsWith(`m|${id}|`)) this._placementCache.delete(key);
      }
      const existing = this.currentLabelState(id);
      this.labelStatesById.set(id, { ...existing, ...values });
      const marker = this.tooltipsById.get(id);
      if (marker) {
        marker.remove();
        this.tooltipsById.delete(id);
      }
      this.showLabel(id);
      this.notifyLabelEditChange();
    }

    currentLabelState(id) {
      const feature = this.displayFeaturesById.get(id)
        || this.dataset.features.find((item) => item.properties.id === id);
      if (!feature) return { point: null, angle: 0, size: 10 };
      return this.resolveLabelPlacement(id, feature, { minSize: 8.2, maxSize: 13.8, angleLimit: 28 });
    }

    resolveLabelPlacement(id, feature, options = {}) {
      const cacheKey = `m|${id}|${options.sizeBoost}|${options.minSize}|${options.maxSize}`;
      let base = this._placementCache.get(cacheKey);
      if (!base) {
        base = buildLabelPlacement(feature, options);
        this._placementCache.set(cacheKey, base);
      }
      const override = this.labelStatesById.get(id);
      if (!override) return base;
      return {
        points: Array.isArray(override.points) ? override.points : undefined,
        point: override.point !== undefined ? override.point : base.point,
        angle: override.angle !== undefined ? override.angle : base.angle,
        size: override.size !== undefined ? override.size : base.size
      };
    }

    labelOverrideExport() {
      return {
        municipalities: exportLabelMap(this.labelStatesById),
        areaCodes: exportLabelMap(this.areaCodeLabelStatesByCode)
      };
    }

    notifyLabelEditChange() {
      if (this.onLabelEditChange) {
        this.onLabelEditChange({
          selectedId: this.labelEditSelectedId,
          targets: this.labelEditorTargets(),
          overrides: this.labelOverrideExport(),
          selected: this.selectedLabelState()
        });
      }
    }

    selectedLabelState() {
      if (!this.labelEditSelectedId) return null;
      if (this.labelEditSelectedId.startsWith("areaCode:")) {
        const areaCode = this.labelEditSelectedId.replace("areaCode:", "");
        return this.areaCodeLabelStatesByCode.get(areaCode) || this.currentAreaCodeLabelState(areaCode);
      }
      return this.labelStatesById.get(this.labelEditSelectedId) || this.currentLabelState(this.labelEditSelectedId);
    }

    showAreaCodeLabel(areaCode) {
      if (this.labelEditEnabled && (!this.labelEditLabelsVisible || this.labelEditScope !== "areaCode")) return;
      if (this.areaCodeTooltipsByCode.has(areaCode)) return;
      if (this.liteMode && !this.labelEditEnabled && !["04", "048", "049", "0494"].includes(areaCode)) return;
      const feature = this.areaCodeFeaturesByCode.get(areaCode);
      if (!feature) return;
      const label = this.resolveAreaCodeLabelPlacement(areaCode, feature, {
        text: areaCode,
        minSize: 16,
        maxSize: 27,
        sizeBoost: 7.8,
        fitByShortSide: true,
        forceAngle: 0,
        precise: true,
        preferVisualCenter: true,
        preferredPoint: feature.properties.labelPoint,
        zoom: this.map.getZoom()
      });
      const point = this.labelBehavior.forcePreferredPoint
        ? (feature.properties.labelPoint || label.point || featureCenterOfMass(feature))
        : (label.point || featureCenterOfMass(feature));
      if (!Array.isArray(point)) return;
      const labelSize = Math.max(label.size, this.labelBehavior.minAreaCodeSize || 0);
      const selected = this.labelEditSelectedId === `areaCode:${areaCode}`;
      const pendingEasy = this.areaCodeLabelDisplayMode() === "all" && !this.answeredAreaCodes.has(areaCode);
      const html = `<div class="answered-label area-code-label${pendingEasy ? " is-pending-easy" : ""}${selected ? " is-selected" : ""}" style="font-size:${labelSize}px; transform: translate(-50%, -50%) rotate(${label.angle}deg);">${areaCode}</div>`;
      const marker = L.marker(point, {
        pane: "labelPane",
        opacity: 0,
        interactive: false,
        icon: L.divIcon({ className: "", iconSize: [0, 0] })
      }).addTo(this.map);
      marker.bindTooltip(html, {
        permanent: true,
        direction: "center",
        className: "answered-tooltip area-code-tooltip",
        opacity: 1
      }).openTooltip();
      this.areaCodeTooltipsByCode.set(areaCode, marker);
    }

    updateAreaCodeLabelState(areaCode, values) {
      for (const key of this._placementCache.keys()) {
        if (key.startsWith(`ac|${areaCode}|`)) this._placementCache.delete(key);
      }
      const existing = this.currentAreaCodeLabelState(areaCode);
      this.areaCodeLabelStatesByCode.set(areaCode, { ...existing, ...values });
      const marker = this.areaCodeTooltipsByCode.get(areaCode);
      if (marker) {
        marker.remove();
        this.areaCodeTooltipsByCode.delete(areaCode);
      }
      this.showAreaCodeLabel(areaCode);
      this.notifyLabelEditChange();
    }

    selectEditableAreaCodeLabel(areaCode) {
      const previousId = this.labelEditSelectedId;
      this.labelEditSelectedId = `areaCode:${areaCode}`;
      if (previousId && previousId.startsWith("areaCode:")) {
        this.refreshAreaCodeLabel(previousId.replace("areaCode:", ""));
      }
      this.refreshAreaCodeLabel(areaCode);
      this.notifyLabelEditChange();
    }

    currentAreaCodeLabelState(areaCode) {
      const feature = this.areaCodeFeaturesByCode.get(areaCode);
      if (!feature) return { point: null, angle: 0, size: 24 };
      return this.resolveAreaCodeLabelPlacement(areaCode, feature, {
        text: areaCode,
        minSize: 16,
        maxSize: 27,
        sizeBoost: 7.8,
        fitByShortSide: true,
        forceAngle: 0,
        precise: true,
        preferVisualCenter: true,
        preferredPoint: feature.properties.labelPoint
      });
    }

    resolveAreaCodeLabelPlacement(areaCode, feature, options = {}) {
      const cacheKey = `ac|${areaCode}|${options.sizeBoost}|${options.minSize}|${options.maxSize}`;
      let base = this._placementCache.get(cacheKey);
      if (!base) {
        base = buildLabelPlacement(feature, options);
        this._placementCache.set(cacheKey, base);
      }
      const override = this.areaCodeLabelStatesByCode.get(areaCode);
      if (!override) return base;
      return {
        point: override.point !== undefined ? override.point : base.point,
        angle: override.angle !== undefined ? override.angle : base.angle,
        size: override.size !== undefined ? override.size : base.size
      };
    }

    clearMunicipalityLabels() {
      this.tooltipsById.forEach((marker) => marker.remove());
      this.tooltipsById.clear();
    }

    refreshLabel(id) {
      const marker = this.tooltipsById.get(id);
      if (marker) {
        marker.remove();
        this.tooltipsById.delete(id);
      }
      this.showLabel(id);
    }

    clearAreaCodeLabels() {
      this.areaCodeTooltipsByCode.forEach((marker) => marker.remove());
      this.areaCodeTooltipsByCode.clear();
    }

    refreshAreaCodeLabel(areaCode) {
      const marker = this.areaCodeTooltipsByCode.get(areaCode);
      if (marker) {
        marker.remove();
        this.areaCodeTooltipsByCode.delete(areaCode);
      }
      this.showAreaCodeLabel(areaCode);
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
          fillOpacity: this.tileLayerVisible ? 0.76 : 0.88
        };
      }
      return this.answeredIds.has(id) ? this.answeredStyle(id) : this.baseStyle();
    }

    refreshAreaCodeStyle(areaCode) {
      const layers = this.areaCodeLayersByCode.get(areaCode) || [];
      layers.forEach((layer) => layer.setStyle(this.getAreaCodeStyle(areaCode)));
    }

    getAreaCodeStyle(areaCode) {
      if (this.labelEditEnabled && this.labelEditDisplayCodes.has(areaCode)) {
        return {
          color: "#d7e1e8",
          weight: 1.2,
          opacity: 0.95,
          fillColor: answerColor(0),
          fillOpacity: this.tileLayerVisible ? 0.74 : 0.86
        };
      }
      if (this.areaCodeHeatmapStats && this.areaCodeHeatmapStats.has(areaCode)) {
        const stat = this.areaCodeHeatmapStats.get(areaCode);
        return {
          color: "#e5eef5",
          weight: 1.8,
          opacity: 0.98,
          fillColor: heatColor(stat),
          fillOpacity: this.tileLayerVisible ? 0.78 : 0.9
        };
      }
      if (this.answeredAreaCodes.has(areaCode)) {
        return {
          color: "#d7e1e8",
          weight: 1.2,
          opacity: 0.95,
          fillColor: answerColor(this.areaCodeMistakesByCode.get(areaCode) || 0),
          fillOpacity: this.tileLayerVisible ? 0.74 : 0.86
        };
      }
      return {
        color: "#78b7c6",
        weight: 1.5,
        opacity: this.tileLayerVisible ? 0.58 : 0.5,
        fillColor: COLORS.pending,
        fillOpacity: this.tileLayerVisible ? 0.68 : 0.84
      };
    }

    reset() {
      this.answeredIds.clear();
      this.answeredAreaCodes.clear();
      this.answerMistakesById.clear();
      this.areaCodeMistakesByCode.clear();
      this.heatmapStats = null;
      this.areaCodeHeatmapStats = null;
      this.labelEditDisplayCodes.clear();
      this._invalidateTopAreaCache();
      this.layersById.forEach((layers) => layers.forEach((layer) => layer.setStyle(this.baseStyle())));
      this.areaCodeLayersByCode.forEach((layers, areaCode) => {
        layers.forEach((layer) => layer.setStyle(this.getAreaCodeStyle(areaCode)));
      });
      this.clearMunicipalityLabels();
      this.clearAreaCodeLabels();
      const municipalityLabelMode = this.municipalityLabelDisplayMode();
      if (municipalityLabelMode !== "answered") {
        this.dataset.municipalities
          .filter((item) => {
            const feature = this.displayFeaturesById.get(item.id)
              || this.dataset.features.find((entry) => entry.properties.id === item.id);
            const props = feature ? feature.properties : item;
            if (municipalityLabelMode === "subtle") return this.shouldShowSubtleMunicipalityLabel(props);
            return this.shouldShowPendingEasyMunicipalityLabel(props);
          })
          .forEach((item) => this.showLabel(item.id));
      }
    }

    warmupPlacements() {
      if (this.dataset && this.dataset.municipalities && this.dataset.municipalities.length > 800) return;
      // 市ラベルの配置計算を2モード分キャッシュに積む（DOM生成なし）
      const muniOptionSets = [
        { sizeBoost: 0.2,  minSize: 8.2, maxSize: 13.8, angleLimit: 28 },  // municipality mode
        { sizeBoost: -0.8, minSize: 8.4, maxSize: 11.2, angleLimit: 18 }   // ma mode (subtle)
      ];
      this.displayFeaturesById.forEach((feature, id) => {
        const props = feature.properties || {};
        for (let i = 0; i < muniOptionSets.length; i++) {
          if (i === 1 && !this.shouldShowSubtleMunicipalityLabel(props)) continue;
          if (i === 0 && !this.shouldShowPendingEasyMunicipalityLabel(props)) continue;
          this.resolveLabelPlacement(id, feature, muniOptionSets[i]);
        }
      });

      // 市外局番ラベルの配置計算をキャッシュに積む（マップへの描画なし）
      const areaCodeFeatures = (this.dataset && this.dataset.maBroadFeatures && !this.dataset.maFeatures)
        ? this.getMaBroadCollections()
        : this.getMaCollections("area_code");
      const acOpts = { minSize: 16, maxSize: 27, sizeBoost: 7.8, fitByShortSide: true, forceAngle: 0, precise: true, preferVisualCenter: true };
      for (const feature of areaCodeFeatures) {
        const areaCode = feature.properties.area_code;
        this.resolveAreaCodeLabelPlacement(areaCode, feature, { ...acOpts, text: areaCode, preferredPoint: feature.properties.labelPoint });
      }
    }

    setEasyMode(enabled) {
      this.easyMode = !!enabled;
      // ラベルを即時クリア（古いラベルをすぐ消す）
      this.clearMunicipalityLabels();
      this.clearAreaCodeLabels();
      // ラベル生成は次フレームに後回しにして INP を改善
      if (this._pendingLabelRender) clearTimeout(this._pendingLabelRender);
      this._pendingLabelRender = setTimeout(() => {
        this._pendingLabelRender = null;
        const municipalityLabelMode = this.municipalityLabelDisplayMode();
        if (municipalityLabelMode !== "answered") {
          this.dataset.municipalities
            .filter((item) => {
              const feature = this.displayFeaturesById.get(item.id)
                || this.dataset.features.find((entry) => entry.properties.id === item.id);
              const props = feature ? feature.properties : item;
              if (municipalityLabelMode === "subtle") return this.shouldShowSubtleMunicipalityLabel(props);
              return this.shouldShowPendingEasyMunicipalityLabel(props);
            })
            .forEach((item) => this.showLabel(item.id));
        } else {
          this.answeredIds.forEach((id) => this.showLabel(id));
        }
        if (this.areaCodeLabelDisplayMode() === "all") {
          this.areaCodeFeaturesByCode.forEach((_feature, areaCode) => this.showAreaCodeLabel(areaCode));
        } else {
          this.answeredAreaCodes.forEach((areaCode) => this.showAreaCodeLabel(areaCode));
        }
      }, 0);
    }

    applyHeatmap(stats, mode = this.mode) {
      if (mode === "ma" || mode === "ma_broad") {
        this.applyAreaCodeHeatmap(stats);
        return;
      }

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

    applyProgressHeatmap(datasetProgress, mode) {
      if (!datasetProgress || !datasetProgress.stats) return;
      const stats = Object.values(datasetProgress.stats).map((stat) => {
        const modeStat = (stat.modes && stat.modes[mode]) || null;
        if (!modeStat) {
          return { id: stat.id, name: stat.name, area_code: stat.area_code, correct: false, recentScore: null };
        }
        const rr = modeStat.recentResults;
        const recentScore = (rr && rr.length > 0)
          ? rr.reduce((sum, v) => sum + v, 0) / rr.length
          : null;
        return {
          id: stat.id,
          name: stat.name,
          area_code: stat.area_code,
          correct: modeStat.correct > 0,
          mistakes: modeStat.mistakes || 0,
          recentScore
        };
      });
      this.applyHeatmap(stats, mode);
    }

    applyAreaCodeHeatmap(stats) {
      if (!this.maLayer) this.renderMaOverlay();
      const statsById = new Map(stats.map((item) => [item.id, item]));
      this.areaCodeHeatmapStats = new Map();
      this.areaCodeFeaturesByCode.forEach((feature, areaCode) => {
        const memberStats = (feature.properties.memberIds || [])
          .map((id) => statsById.get(id))
          .filter(Boolean);
        // ma_broad では broad_area_code:xxx 形式で直接参照するフォールバック
        if (!memberStats.length) {
          const direct = statsById.get(`broad_area_code:${areaCode}`) || statsById.get(`area_code:${areaCode}`);
          if (direct) memberStats.push(direct);
        }
        const mistakes = memberStats.reduce((max, item) => Math.max(max, item.mistakes || 0), 0);
        const scoredMembers = memberStats.filter((item) => item.recentScore != null);
        const recentScore = scoredMembers.length > 0
          ? scoredMembers.reduce((sum, item) => sum + item.recentScore, 0) / scoredMembers.length
          : null;
        const correct = memberStats.length > 0
          && (recentScore !== null || memberStats.some((item) => item.correct));
        this.areaCodeHeatmapStats.set(areaCode, { id: areaCode, mistakes, correct, recentScore });
        this.refreshAreaCodeStyle(areaCode);
        this.showAreaCodeLabel(areaCode);
      });
      this.layersById.forEach((layers) => layers.forEach((layer) => layer.setStyle({
        color: "transparent",
        weight: 0,
        opacity: 0,
        fillColor: COLORS.pending,
        fillOpacity: 0
      })));
      if (this.maLayer) this.maLayer.bringToFront();
    }
  }

  function answerColor(mistakes) {
    if (mistakes <= 0) return COLORS.correct;
    if (mistakes === 1) return COLORS.correctAlt;
    return COLORS.miss3;
  }

  function heatColor(stat) {
    if (!stat || !stat.correct) return COLORS.unanswered;
    // 直近5回の正答率ベースで色を決める（recentScore が存在する場合）
    if (stat.recentScore != null) {
      if (stat.recentScore >= 0.8) return COLORS.correct;    // 4〜5/5 → 緑
      if (stat.recentScore >= 0.6) return COLORS.correctAlt; // 3/5   → ゴールド
      if (stat.recentScore >= 0.4) return COLORS.miss2;      // 2/5   → オレンジ
      return COLORS.miss3;                                    // 0〜1/5 → 赤
    }
    // recentResults 未保存（旧データ）は累積ミス数にフォールバック
    if (stat.mistakes === 0) return COLORS.correct;
    if (stat.mistakes === 1) return COLORS.correctAlt;
    return COLORS.miss3;
  }

  function buildMunicipalityDisplayFeatures(dataset) {
    // 事前計算済みデータがあればそれを使う（turf.union不要）
    const precomputed = window.__GEOQUIZ_PRECOMPUTED && window.__GEOQUIZ_PRECOMPUTED[dataset.id];
    if (precomputed && Array.isArray(precomputed.municipalityFeatures)) {
      return precomputed.municipalityFeatures;
    }
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

  function shouldCreateHitTarget(feature) {
    if (!feature || !feature.properties) return false;
    const box = geometryBounds(feature.geometry);
    const maxSpan = Math.max(box.width, box.height);
    const minSpan = Math.min(box.width, box.height);
    const isIsland = feature.properties.region === "島しょ";
    if (isIsland) return maxSpan < 0.22 || minSpan < 0.08;
    return maxSpan < 0.035 || minSpan < 0.012;
  }

  function hitTargetRadius(feature) {
    const box = geometryBounds(feature.geometry);
    const maxSpan = Math.max(box.width, box.height);
    if (feature.properties && feature.properties.region === "島しょ") {
      if (maxSpan < 0.04) return 20;
      if (maxSpan < 0.08) return 16;
      return 12;
    }
    if (maxSpan < 0.015) return 16;
    if (maxSpan < 0.03) return 12;
    return 10;
  }

  function buildLabelPlacement(feature, options = {}) {
    const box = geometryBounds(feature.geometry);
    const anchor = labelAnchorFromGeometry(feature, options);
    const point = anchor.point;
    const ratio = box.width / Math.max(box.height, 0.000001);
    const text = options.text || feature.properties.name;
    return {
      point,
      size: labelSize(text, box, { ...options, anchorScore: anchor.score }),
      angle: typeof options.forceAngle === "number" ? options.forceAngle : labelAngle(feature, ratio, options)
    };
  }

  function labelAnchorFromGeometry(feature, options = {}) {
    const candidates = [];
    const seen = new Set();

    function pushCandidate(point, source) {
      if (!Array.isArray(point) || point.length !== 2) return;
      const key = `${point[0].toFixed(6)}:${point[1].toFixed(6)}`;
      if (seen.has(key)) return;
      seen.add(key);
      candidates.push({ point, source });
    }

    pushCandidate(options.preferredPoint, "preferred");
    pushCandidate(polygonVisualCenter(feature.geometry, options), "visual");
    pushCandidate(centroidPointFromGeometry(feature.geometry), "centroid");

    if (window.turf && typeof window.turf.pointOnFeature === "function") {
      const center = window.turf.pointOnFeature(feature);
      const coordinates = center && center.geometry && center.geometry.coordinates;
      if (Array.isArray(coordinates)) pushCandidate([coordinates[1], coordinates[0]], "feature");
    }

    const scored = candidates
      .map((candidate) => ({
        ...candidate,
        score: scoreLabelPoint(candidate.point, feature.geometry)
      }))
      .filter((candidate) => Number.isFinite(candidate.score) && candidate.score > 0);

    if (scored.length) {
      scored.sort((a, b) => adjustedLabelScore(b) - adjustedLabelScore(a));
      return { point: scored[0].point, score: scored[0].score };
    }

    if (candidates.length) return { point: candidates[0].point, score: 0 };
    return { point: null, score: 0 };
  }

  function adjustedLabelScore(candidate) {
    if (!candidate) return -Infinity;
    if (candidate.source === "preferred") return candidate.score * 1.08;
    if (candidate.source === "visual") return candidate.score * 1.03;
    return candidate.score;
  }

  function scoreLabelPoint(point, geometry) {
    if (!Array.isArray(point) || point.length !== 2) return null;
    const polygons = geometryPolygons(geometry);
    if (!polygons.length) return null;
    const xy = [point[1], point[0]];
    let best = -Infinity;
    polygons.forEach((polygon) => {
      if (!pointInPolygon(xy, polygon)) return;
      best = Math.max(best, distanceToPolygonEdge(xy, polygon));
    });
    return Number.isFinite(best) && best > 0 ? best : null;
  }

  function centroidPointFromGeometry(geometry) {
    const polygons = geometryPolygons(geometry);
    if (!polygons.length) return null;
    const polygon = largestPolygon(polygons);
    const outer = polygon && polygon[0];
    if (!outer || outer.length < 4) return null;
    const centroid = ringCentroid(outer);
    if (!centroid || !pointInPolygon(centroid, polygon)) return null;
    return [centroid[1], centroid[0]];
  }

  function labelPointFromGeometry(feature, options = {}) {
    const anchor = labelAnchorFromGeometry(feature, options);
    if (anchor.point) return anchor.point;
    if (!window.turf) return null;
    const center = typeof window.turf.pointOnFeature === "function"
      ? window.turf.pointOnFeature(feature)
      : null;
    const coordinates = center && center.geometry && center.geometry.coordinates;
    return Array.isArray(coordinates) ? [coordinates[1], coordinates[0]] : null;
  }

  function labelSize(name, box, options = {}) {
    const span = Math.max(box.width, box.height);
    const narrowSpan = Math.max(Math.min(box.width, box.height), 0.000001);
    const aspectRatio = span / narrowSpan;
    const sizeSpan = options.fitByShortSide
      ? span * 0.28 + narrowSpan * 0.72
      : span;
    const chars = String(name || "").length;
    const base = sizeSpan > 0.25 ? 15
      : sizeSpan > 0.18 ? 13
        : sizeSpan > 0.12 ? 12
          : sizeSpan > 0.07 ? 11
            : sizeSpan > 0.04 ? 10
              : sizeSpan > 0.02 ? 9
                : 8;
    const zoom = options.zoom || 9;
    const zoomScale = Math.pow(1.28, zoom - 9);
    const clearanceRatio = Number.isFinite(options.anchorScore) ? options.anchorScore / narrowSpan : 0;
    const clearanceBoost = clamp((clearanceRatio - 0.2) * 7.2, -1.2, 1.1);
    const aspectPenalty = options.fitByShortSide
      ? clamp((aspectRatio - 1.55) * 1.15, 0, 3.4)
      : 0;
    const codeLengthPenalty = options.fitByShortSide
      ? Math.max(chars - 3, 0) * 0.9
      : Math.max(chars - 4, 0) * 0.45;
    const raw = (base + (options.sizeBoost || 0) + clearanceBoost - aspectPenalty - codeLengthPenalty) * zoomScale;
    return clamp(
      raw,
      options.minSize || 7.2,
      (options.maxSize || 13) * Math.max(zoomScale, 1)
    );
  }

  function labelAngle() {
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

  function translateGeometry(geometry, deltaLat, deltaLng) {
    if (!geometry) return geometry;
    if (geometry.type === "Polygon") {
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((ring) => ring.map((point) => translatePoint(point, deltaLat, deltaLng)))
      };
    }
    if (geometry.type === "MultiPolygon") {
      return {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon) => (
          polygon.map((ring) => ring.map((point) => translatePoint(point, deltaLat, deltaLng)))
        ))
      };
    }
    if (geometry.type === "GeometryCollection") {
      return {
        ...geometry,
        geometries: geometry.geometries.map((item) => translateGeometry(item, deltaLat, deltaLng))
      };
    }
    return geometry;
  }

  function translatePoint(point, deltaLat, deltaLng) {
    return [point[0] + deltaLng, point[1] + deltaLat];
  }

  function geometryToLatLngs(geometry) {
    if (geometry.type === "Polygon") return geometry.coordinates.map(ringToLatLngs);
    if (geometry.type === "MultiPolygon") return geometry.coordinates.map((polygon) => polygon.map(ringToLatLngs));
    if (geometry.type === "GeometryCollection") {
      const first = geometry.geometries.find((item) => item.type === "Polygon" || item.type === "MultiPolygon");
      return first ? geometryToLatLngs(first) : [];
    }
    return [];
  }

  function ringToLatLngs(ring) {
    return ring.map((point) => [point[1], point[0]]);
  }

  function puzzleInitialOffset(index, total) {
    const angle = (index / Math.max(total, 1)) * 2 * Math.PI;
    const radius = 0.13;
    return {
      lat: Math.sin(angle) * radius,
      lng: Math.cos(angle) * radius
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundCoord(value) {
    return Number(value.toFixed(6));
  }

  function normalizeLabelOverrides(overrides) {
    const raw = overrides || {};
    const municipalitySource = raw.municipalities || raw;
    const areaCodeSource = raw.areaCodes || {};
    return {
      municipalities: toLabelMap(municipalitySource),
      areaCodes: toLabelMap(areaCodeSource)
    };
  }

  function toLabelMap(overrides) {
    return new Map(Object.entries(overrides || {})
      .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value))
      .map(([id, value]) => [id, {
      points: Array.isArray(value.points)
        ? value.points.filter((point) => Array.isArray(point) && point.length === 2)
        : undefined,
      point: Array.isArray(value.point) ? value.point : undefined,
      angle: typeof value.angle === "number" ? value.angle : undefined,
      size: typeof value.size === "number" ? value.size : undefined
    }]));
  }

  function exportLabelMap(labelMap) {
    return Object.fromEntries([...labelMap.entries()].map(([id, state]) => [id, {
      points: state.points,
      point: state.point,
      angle: state.angle,
      size: state.size
    }]));
  }

  function preferredMainBounds(dataset) {
    const features = Array.isArray(dataset && dataset.features) ? dataset.features : [];
    const mainland = features.filter((feature) => feature && feature.properties && feature.properties.region !== "島しょ");
    if (!mainland.length || mainland.length === features.length) return null;
    return boundsFromFeatures(mainland);
  }

  function boundsFromFeatures(features) {
    const bounds = L.latLngBounds([]);
    features.forEach((feature) => {
      geometryLatLngs(feature && feature.geometry).forEach((latlng) => bounds.extend(latlng));
    });
    return bounds.isValid() ? bounds : null;
  }

  function geometryLatLngs(geometry, out = []) {
    if (!geometry) return out;
    if (geometry.type === "Polygon") {
      geometry.coordinates.flat(1).forEach(([lng, lat]) => out.push([lat, lng]));
      return out;
    }
    if (geometry.type === "MultiPolygon") {
      geometry.coordinates.flat(2).forEach(([lng, lat]) => out.push([lat, lng]));
      return out;
    }
    if (geometry.type === "GeometryCollection") {
      geometry.geometries.forEach((item) => geometryLatLngs(item, out));
    }
    return out;
  }

  function featureCenterOfMass(feature) {
    if (window.turf && typeof window.turf.centerOfMass === "function") {
      try {
        const result = window.turf.centerOfMass(feature);
        const coords = result && result.geometry && result.geometry.coordinates;
        if (Array.isArray(coords)) return [coords[1], coords[0]];
      } catch {
        // fall through
      }
    }
    return null;
  }

  function hashCode(value) {
    return String(value).split("").reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0);
  }

  window.MapRenderer = MapRenderer;
})();
