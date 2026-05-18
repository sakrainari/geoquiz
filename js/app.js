(function () {
  const appConfig = resolveAppConfig(resolveDatasetId());
  const dataset = appConfig.dataset;
  const ghostData = appConfig.ghostData;
  dataset.imageQuestions = appConfig.imageQuestions;
  const engine = new window.QuizEngine(dataset);
  let renderer;
  let currentMode = "municipality";
  let lastResultPayload = null;
  let timerId = null;

  const els = {
    startScreen: document.getElementById("startScreen"),
    gameScreen: document.getElementById("gameScreen"),
    resultScreen: document.getElementById("resultScreen"),
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

  document.querySelectorAll("[data-start-mode]").forEach((button) => {
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
