(function () {
  const appConfig = resolveAppConfig(resolveDatasetId());
  const dataset = appConfig.dataset;
  const ghostData = appConfig.ghostData;
  dataset.imageQuestions = appConfig.imageQuestions;
  const engine = new window.QuizEngine(dataset);
  let renderer;
  let currentMode = "municipality";
  let lastResultPayload = null;
  let lastReferenceKey = null;
  let areaReferenceFeatures = null;
  let timerId = null;

  const els = {
    startScreen: document.getElementById("startScreen"),
    gameScreen: document.getElementById("gameScreen"),
    resultScreen: document.getElementById("resultScreen"),
    appSubtitle: document.getElementById("appSubtitle"),
    appTitle: document.getElementById("appTitle"),
    appDescription: document.getElementById("appDescription"),
    referencePreview: document.getElementById("referencePreview"),
    questionText: document.getElementById("questionText"),
    modeLabel: document.getElementById("modeLabel"),
    remainingCount: document.getElementById("remainingCount"),
    correctCount: document.getElementById("correctCount"),
    mistakeCount: document.getElementById("mistakeCount"),
    elapsedTime: document.getElementById("elapsedTime"),
    suddenDeathToggle: document.getElementById("suddenDeathToggle"),
    mistakeSpeechToggle: document.getElementById("mistakeSpeechToggle"),
    resetButton: document.getElementById("resetButton"),
    retryButton: document.getElementById("retryButton"),
    backToMenuButton: document.getElementById("backToMenuButton"),
    downloadJsonButton: document.getElementById("downloadJsonButton"),
    resultTitle: document.getElementById("resultTitle"),
    resultModeLabel: document.getElementById("resultModeLabel"),
    resultSummary: document.getElementById("resultSummary"),
    resultCorrect: document.getElementById("resultCorrect"),
    resultMistakes: document.getElementById("resultMistakes"),
    resultAverage: document.getElementById("resultAverage"),
    resultTotal: document.getElementById("resultTotal")
  };

  applyDatasetMeta();
  applyAvailableModes();

  document.querySelectorAll("[data-start-mode]").forEach((button) => {
    if (!appConfig.enabledModes.includes(button.dataset.startMode)) return;
    button.addEventListener("click", () => start(button.dataset.startMode));
  });

  els.resetButton.addEventListener("click", () => start(currentMode));
  els.retryButton.addEventListener("click", () => start(currentMode));
  els.backToMenuButton.addEventListener("click", showStart);
  els.suddenDeathToggle.addEventListener("change", () => {
    engine.suddenDeath = els.suddenDeathToggle.checked;
  });
  els.downloadJsonButton.addEventListener("click", () => {
    if (lastResultPayload) window.ResultAnalytics.downloadJson(lastResultPayload);
  });

  function ensureMap() {
    if (renderer) return renderer;
    renderer = new window.MapRenderer("map", dataset, ghostData);
    renderer.onClick((feature) => {
      const result = engine.answer(feature.properties);
      if (result.ignored) return;
      if (result.correct) {
        if (currentMode === "ma") {
          renderer.markAreaCodeCorrect(result.question.area_code);
          renderer.markGroupCorrect((item) => result.question.memberIds.includes(item.id));
        } else {
          renderer.markCorrect(feature.properties.id);
        }
      } else {
        if (currentMode === "ma") {
          renderer.flashAreaCodeWrong(feature.properties.area_code);
        } else {
          renderer.flashWrong(feature.properties.id);
        }
        speakMistake(feature.properties);
      }
      updateHud();
      if (result.finished) window.setTimeout(showResult, result.correct ? 360 : 520);
    });
    return renderer;
  }

  function start(mode) {
    currentMode = mode;
    engine.reset(mode, els.suddenDeathToggle.checked);
    showGame();
    ensureMap().reset();
    renderer.setMode(mode);
    lastReferenceKey = null;
    updateHud();
    startTimer();
    window.setTimeout(() => {
      renderer.map.invalidateSize();
      renderer.fitToMain();
    }, 80);
  }

  function showStart() {
    stopTimer();
    els.startScreen.classList.remove("is-hidden");
    els.gameScreen.classList.add("is-hidden");
    els.resultScreen.classList.add("is-hidden");
  }

  function showGame() {
    els.startScreen.classList.add("is-hidden");
    els.gameScreen.classList.remove("is-hidden");
    els.resultScreen.classList.add("is-hidden");
  }

  function showResult() {
    stopTimer();
    const result = engine.result();
    const summary = window.ResultAnalytics.summarize(result);
    renderer.applyHeatmap(result.stats);
    lastResultPayload = window.ResultAnalytics.buildWeakPointExport(result, dataset.prefecture);

    els.resultModeLabel.textContent = modeName(result.mode);
    els.resultTitle.textContent = result.correct >= result.totalQuestions ? "Complete" : "Game Over";
    els.resultSummary.textContent = result.mistakes === 0
      ? "ノーミス。かなり仕上がっています。"
      : `弱点 ${lastResultPayload.weakPoints.length} 件をJSONに出力できます。`;
    els.resultCorrect.textContent = `${summary.correct}`;
    els.resultMistakes.textContent = `${summary.mistakes}`;
    els.resultAverage.textContent = `${(summary.averageTimeMs / 1000).toFixed(1)}s`;
    els.resultTotal.textContent = `${summary.totalQuestions}`;

    els.startScreen.classList.add("is-hidden");
    els.gameScreen.classList.add("is-hidden");
    els.resultScreen.classList.remove("is-hidden");
  }

  function updateHud() {
    els.questionText.textContent = engine.questionText();
    els.modeLabel.textContent = modeName(currentMode);
    els.remainingCount.textContent = `${engine.remaining()}`;
    els.correctCount.textContent = `${engine.correct}`;
    els.mistakeCount.textContent = `${engine.mistakes}`;
    els.elapsedTime.textContent = formatTime(engine.elapsedMs());
    updateReferencePreview();
  }

  function startTimer() {
    stopTimer();
    timerId = window.setInterval(updateHud, 500);
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  }

  function speakMistake(featureProperties) {
    if (!els.mistakeSpeechToggle.checked || !("speechSynthesis" in window)) return;
    const label = currentMode === "ma" ? featureProperties.area_code : featureProperties.name;
    if (!label) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(label);
    utterance.lang = "ja-JP";
    utterance.rate = 1.05;
    utterance.pitch = 1;
    const voice = window.speechSynthesis
      .getVoices()
      .find((item) => item.lang && item.lang.toLowerCase().startsWith("ja"));
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }

  function modeName(mode) {
    return window.QuizModes.getMode(mode).label;
  }

  function updateReferencePreview() {
    const question = engine.currentQuestion();
    const key = question ? `${currentMode}:${question.id || question.answerId}` : "none";
    if (key === lastReferenceKey) return;
    lastReferenceKey = key;
    if (!question) {
      els.referencePreview.innerHTML = "";
      return;
    }

    const feature = referenceFeatureForQuestion(question);
    els.referencePreview.innerHTML = feature ? renderReferenceSvg(feature) : "";
  }

  function referenceFeatureForQuestion(question) {
    if (currentMode === "ma") {
      if (!areaReferenceFeatures) {
        areaReferenceFeatures = window.MaUnion.buildMaCollections(dataset, "area_code");
      }
      return areaReferenceFeatures.find((feature) => feature.properties.area_code === question.area_code);
    }

    const memberIds = question.memberIds || [question.answerId];
    const features = dataset.features.filter((feature) => memberIds.includes(feature.properties.id));
    if (!features.length) return null;
    return window.MaUnion.unionFeatures(features, {
      ...features[0].properties,
      sourceFeatureCount: features.length
    });
  }

  function renderReferenceSvg(feature) {
    const rings = geometryRings(feature.geometry);
    if (!rings.length) return "";
    const points = rings.flat();
    const bounds = points.reduce((box, point) => ({
      minX: Math.min(box.minX, point[0]),
      minY: Math.min(box.minY, point[1]),
      maxX: Math.max(box.maxX, point[0]),
      maxY: Math.max(box.maxY, point[1])
    }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
    const width = Math.max(bounds.maxX - bounds.minX, 0.000001);
    const height = Math.max(bounds.maxY - bounds.minY, 0.000001);
    const viewWidth = 140;
    const viewHeight = 104;
    const pad = 10;
    const scale = Math.min((viewWidth - pad * 2) / width, (viewHeight - pad * 2) / height);
    const offsetX = (viewWidth - width * scale) / 2;
    const offsetY = (viewHeight - height * scale) / 2;
    const path = rings.map((ring) => ring.map((point, index) => {
      const x = offsetX + (point[0] - bounds.minX) * scale;
      const y = offsetY + (bounds.maxY - point[1]) * scale;
      return `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`;
    }).join(" ") + " Z").join(" ");
    return `<svg viewBox="0 0 ${viewWidth} ${viewHeight}" role="img" aria-label="出題エリアの形"><path d="${path}" fill-rule="evenodd"></path></svg>`;
  }

  function geometryRings(geometry) {
    if (!geometry) return [];
    if (geometry.type === "Polygon") return geometry.coordinates;
    if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
    if (geometry.type === "GeometryCollection") {
      return geometry.geometries.flatMap((item) => geometryRings(item));
    }
    return [];
  }

  function applyDatasetMeta() {
    document.title = `${appConfig.title || "日本市外局番マップクイズ"} | ${appConfig.name}`;
    els.appSubtitle.textContent = appConfig.subtitle || `${appConfig.name} dataset`;
    els.appTitle.textContent = appConfig.title || "日本市外局番マップクイズ";
    els.appDescription.textContent = appConfig.description || `${appConfig.name} の地域認識トレーニング。`;
  }

  function applyAvailableModes() {
    document.querySelectorAll("[data-start-mode]").forEach((button) => {
      const mode = button.dataset.startMode;
      const enabled = appConfig.enabledModes.includes(mode);
      button.disabled = !enabled;
      button.classList.toggle("is-disabled", !enabled);
    });
  }

  function resolveAppConfig(datasetId) {
    const catalog = window.GEOQUIZ_DATASETS || [];
    const config = catalog.find((item) => item.id === datasetId) || catalog[0];
    if (!config) throw new Error("Geoquiz dataset catalog is empty.");

    const resolvedDataset = window[config.dataGlobal];
    if (!resolvedDataset) throw new Error(`Dataset global not found: ${config.dataGlobal}`);

    return {
      ...config,
      dataset: resolvedDataset,
      ghostData: window[config.ghostGlobal] || null,
      imageQuestions: window[config.imageQuestionsGlobal] || []
    };
  }

  function resolveDatasetId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("dataset") || params.get("id") || "saitama";
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const min = String(Math.floor(total / 60)).padStart(2, "0");
    const sec = String(total % 60).padStart(2, "0");
    return `${min}:${sec}`;
  }
})();
