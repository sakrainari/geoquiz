(function () {
  const appConfig = resolveAppConfig(resolveDatasetId());
  const dataset = appConfig.dataset;
  const ghostData = appConfig.ghostData;
  const baseLabelOverrides = normalizeLabelOverrideShape(appConfig.labelOverrides);
  dataset.imageQuestions = appConfig.imageQuestions;
  const engine = new window.QuizEngine(dataset);
  let renderer;
  let currentMode = "municipality";
  let lastResultPayload = null;
  let lastReferenceKey = null;
  let areaReferenceFeatures = null;
  let timerId = null;
  let resultTimerId = null;
  let inputUnlockTimerId = null;
  let inputLocked = false;
  let currentRankingType = "weak";
  let currentDatasetProgress = null;
  let currentRankingItems = [];
  let currentPracticeLabel = "";
  let puzzleState = null;
  let previousPuzzleFixed = 0;
  let audioContext = null;
  const labelEditMode = resolveEditMode() === "labels";
  const liteMode = resolveLiteMode();
  const labelEditorDraft = labelEditMode ? loadLabelEditorDraft(appConfig.id) : null;
  const labelOverrides = labelEditorDraft ? labelEditorDraft.overrides : baseLabelOverrides;

  const els = {
    startScreen: document.getElementById("startScreen"),
    gameScreen: document.getElementById("gameScreen"),
    resultScreen: document.getElementById("resultScreen"),
    playMapSlot: document.getElementById("playMapSlot"),
    resultMapSlot: document.getElementById("resultMapSlot"),
    map: document.getElementById("map"),
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
    puzzleControls: document.getElementById("puzzleControls"),
    puzzlePieceSelect: document.getElementById("puzzlePieceSelect"),
    puzzleBestTime: document.getElementById("puzzleBestTime"),
    suddenDeathToggle: document.getElementById("suddenDeathToggle"),
    mistakeSpeechToggle: document.getElementById("mistakeSpeechToggle"),
    tileLayerToggle: document.getElementById("tileLayerToggle"),
    resetButton: document.getElementById("resetButton"),
    retryButton: document.getElementById("retryButton"),
    resultBackToMenuButton: document.getElementById("resultBackToMenuButton"),
    backToMenuButton: document.getElementById("backToMenuButton"),
    downloadJsonButton: document.getElementById("downloadJsonButton"),
    exportProgressButton: document.getElementById("exportProgressButton"),
    importProgressButton: document.getElementById("importProgressButton"),
    importProgressInput: document.getElementById("importProgressInput"),
    storageNotice: document.getElementById("storageNotice"),
    storageNoticeText: document.getElementById("storageNoticeText"),
    storageNoticeClose: document.getElementById("storageNoticeClose"),
    labelEditorPanel: document.getElementById("labelEditorPanel"),
    labelDraftStatus: document.getElementById("labelDraftStatus"),
    municipalityLabelEditButton: document.getElementById("municipalityLabelEditButton"),
    areaCodeLabelEditButton: document.getElementById("areaCodeLabelEditButton"),
    labelVisibleToggle: document.getElementById("labelVisibleToggle"),
    labelTargetSelect: document.getElementById("labelTargetSelect"),
    labelAngleInput: document.getElementById("labelAngleInput"),
    labelSizeInput: document.getElementById("labelSizeInput"),
    labelOverrideOutput: document.getElementById("labelOverrideOutput"),
    copyLabelOverridesButton: document.getElementById("copyLabelOverridesButton"),
    discardLabelDraftButton: document.getElementById("discardLabelDraftButton"),
    resultTitle: document.getElementById("resultTitle"),
    resultModeLabel: document.getElementById("resultModeLabel"),
    resultSummary: document.getElementById("resultSummary"),
    resultCorrect: document.getElementById("resultCorrect"),
    resultMistakes: document.getElementById("resultMistakes"),
    resultAverage: document.getElementById("resultAverage"),
    resultTotal: document.getElementById("resultTotal"),
    weakRankingList: document.getElementById("weakRankingList"),
    practiceWeakButton: document.getElementById("practiceWeakButton"),
    practiceLastMistakeButton: document.getElementById("practiceLastMistakeButton"),
    practiceUnansweredButton: document.getElementById("practiceUnansweredButton"),
    practiceRecentMistakeButton: document.getElementById("practiceRecentMistakeButton"),
    practiceLowAccuracyButton: document.getElementById("practiceLowAccuracyButton"),
    rankingTitle: document.getElementById("rankingTitle"),
    rankingTabs: [...document.querySelectorAll("[data-ranking-type]")],
    topStatSessions: document.getElementById("topStatSessions"),
    topStatAccuracy: document.getElementById("topStatAccuracy"),
    topStatWeak: document.getElementById("topStatWeak"),
    topStatLastPlay: document.getElementById("topStatLastPlay"),
    topMiniHeatmap: document.getElementById("topMiniHeatmap")
  };

  applyDatasetMeta();
  updateTopStats();
  applyAvailableModes();
  document.body.classList.toggle("is-lite-mode", liteMode);

  document.querySelectorAll("[data-start-mode]").forEach((button) => {
    if (!appConfig.enabledModes.includes(button.dataset.startMode)) return;
    button.addEventListener("click", () => start(button.dataset.startMode));
  });

  els.tileLayerToggle.addEventListener("click", () => {
    if (!renderer) return;
    const active = renderer.toggleTileLayer();
    els.tileLayerToggle.classList.toggle("is-active", active);
  });
  els.resetButton.addEventListener("click", () => start(currentMode));
  els.retryButton.addEventListener("click", () => start(currentMode));
  els.resultBackToMenuButton.addEventListener("click", showStart);
  els.backToMenuButton.addEventListener("click", showStart);
  els.suddenDeathToggle.addEventListener("change", () => {
    engine.suddenDeath = els.suddenDeathToggle.checked;
  });
  populatePuzzleOptions();
  els.puzzlePieceSelect.addEventListener("change", () => {
    if (currentMode === "puzzle") start("puzzle");
  });
  els.downloadJsonButton.addEventListener("click", () => {
    if (lastResultPayload) window.ResultAnalytics.downloadJson(lastResultPayload);
  });
  els.exportProgressButton.addEventListener("click", exportProgressJson);
  els.importProgressButton.addEventListener("click", () => els.importProgressInput.click());
  els.importProgressInput.addEventListener("change", importProgressJson);
  els.storageNoticeClose.addEventListener("click", () => els.storageNotice.classList.add("is-hidden"));
  els.municipalityLabelEditButton.addEventListener("click", () => setLabelEditorScope("municipality"));
  els.areaCodeLabelEditButton.addEventListener("click", () => setLabelEditorScope("areaCode"));
  els.labelVisibleToggle.addEventListener("change", () => {
    if (renderer) renderer.setLabelEditorVisibility(els.labelVisibleToggle.checked);
  });
  els.labelTargetSelect.addEventListener("change", () => {
    if (renderer) renderer.selectLabelTarget(els.labelTargetSelect.value);
  });
  els.labelAngleInput.addEventListener("input", () => {
    if (renderer) renderer.updateSelectedLabel({ angle: Number(els.labelAngleInput.value) });
  });
  els.labelSizeInput.addEventListener("input", () => {
    if (renderer) renderer.updateSelectedLabel({ size: Number(els.labelSizeInput.value) });
  });
  els.copyLabelOverridesButton.addEventListener("click", copyLabelOverrides);
  els.discardLabelDraftButton.addEventListener("click", discardLabelDraft);
  document.addEventListener("keydown", handleLabelEditorKeydown);
  els.practiceWeakButton.addEventListener("click", startPracticeFromRanking);
  els.practiceLastMistakeButton.addEventListener("click", startPracticeFromLastMistakes);
  els.practiceUnansweredButton.addEventListener("click", startPracticeFromUnanswered);
  els.practiceRecentMistakeButton.addEventListener("click", startPracticeFromRecentMistakes);
  els.practiceLowAccuracyButton.addEventListener("click", startPracticeFromLowAccuracy);
  els.rankingTabs.forEach((button) => {
    button.addEventListener("click", () => {
      currentRankingType = button.dataset.rankingType || "weak";
      updateRankingTabs();
      renderRanking(currentDatasetProgress);
    });
  });
  showStorageRecoveryNotice();
  if (labelEditMode) {
    startLabelEditor();
  } else {
    const requestedMode = resolveStartMode();
    if (requestedMode) start(requestedMode);
  }

  function ensureMap() {
    if (renderer) return renderer;
    renderer = new window.MapRenderer("map", dataset, ghostData, { labelOverrides, liteMode });
    window.__geoquizRenderer = renderer;
    els.tileLayerToggle.classList.toggle("is-active", renderer.tileLayerVisible);
    renderer.onClick((feature) => {
      if (currentMode === "puzzle") return;
      if (currentMode === "confirm") return;
      if (currentMode === "confirm_ma") return;
      if (currentMode === "confirm_ma_broad") return;
      if (inputLocked) return;
      const result = engine.answer(feature.properties);
      if (result.ignored) return;
      if (result.correct) {
        lockInput();
        if (currentMode === "ma") {
          renderer.markAreaCodeCorrect(result.question.area_code, result.mistakesBeforeCorrect);
        } else if (currentMode === "ma_broad") {
          renderer.markAreaCodeCorrect(result.question.broad_area_code, result.mistakesBeforeCorrect);
        } else {
          renderer.markCorrect(feature.properties.id, result.mistakesBeforeCorrect);
        }
      } else {
        lockInput();
        if (currentMode === "ma" || currentMode === "ma_broad") {
          renderer.flashAreaCodeWrong(feature.properties.area_code);
        } else {
          renderer.flashWrong(feature.properties.id);
        }
        speakMistake(feature.properties);
      }
      updateHud();
      if (result.finished) {
        scheduleResult(result.correct ? 360 : 520);
      } else {
        unlockInputAfter(result.correct ? 360 : 300);
      }
    });
    return renderer;
  }

  function startConfirmMa() {
    clearResultTimer();
    clearInputUnlockTimer();
    unlockInput();
    cancelSpeech();
    currentMode = "confirm_ma";
    areaReferenceFeatures = null;
    currentPracticeLabel = "";
    puzzleState = null;
    previousPuzzleFixed = 0;
    showGame();
    ensureMap().reset();
    renderer.setMode("ma");
    renderer.areaCodeFeaturesByCode.forEach((feature, areaCode) => {
      renderer.markAreaCodeCorrect(areaCode, 0);
    });
    els.resetButton.classList.add("is-hidden");
    els.modeLabel.textContent = "市外局番確認マップ";
    els.questionText.textContent = "全市外局番エリアを確認中";
    els.remainingCount.textContent = "0";
    els.correctCount.textContent = `${renderer.areaCodeFeaturesByCode.size}`;
    els.mistakeCount.textContent = "0";
    els.elapsedTime.textContent = "00:00";
    window.setTimeout(() => {
      renderer.map.invalidateSize();
      renderer.fitToMain();
    }, 80);
  }

  function startConfirmMaBroad() {
    clearResultTimer();
    clearInputUnlockTimer();
    unlockInput();
    cancelSpeech();
    currentMode = "confirm_ma_broad";
    currentPracticeLabel = "";
    puzzleState = null;
    previousPuzzleFixed = 0;
    areaReferenceFeatures = null;
    showGame();
    ensureMap().reset();
    renderer.setMode("ma_broad");
    renderer.areaCodeFeaturesByCode.forEach((feature, areaCode) => {
      renderer.markAreaCodeCorrect(areaCode, 0);
    });
    els.resetButton.classList.add("is-hidden");
    els.modeLabel.textContent = "広域市外局番確認マップ";
    els.questionText.textContent = "全広域市外局番エリアを確認中";
    els.remainingCount.textContent = "0";
    els.correctCount.textContent = `${renderer.areaCodeFeaturesByCode.size}`;
    els.mistakeCount.textContent = "0";
    els.elapsedTime.textContent = "00:00";
    window.setTimeout(() => {
      renderer.map.invalidateSize();
      renderer.fitToMain();
    }, 80);
  }

  function startConfirm() {
    clearResultTimer();
    clearInputUnlockTimer();
    unlockInput();
    cancelSpeech();
    currentMode = "confirm";
    currentPracticeLabel = "";
    puzzleState = null;
    previousPuzzleFixed = 0;
    showGame();
    ensureMap().reset();
    renderer.setMode("confirm");
    dataset.municipalities.forEach((item) => renderer.markCorrect(item.id, 0));
    els.resetButton.classList.add("is-hidden");
    els.modeLabel.textContent = "確認マップ";
    els.questionText.textContent = "全市区町村を確認中";
    els.remainingCount.textContent = "0";
    els.correctCount.textContent = `${dataset.municipalities.length}`;
    els.mistakeCount.textContent = "0";
    els.elapsedTime.textContent = "00:00";
    window.setTimeout(() => {
      renderer.map.invalidateSize();
      renderer.fitToMain();
    }, 80);
  }

  function start(mode, options = {}) {
    if (mode === "confirm") { startConfirm(); return; }
    if (mode === "confirm_ma") { startConfirmMa(); return; }
    if (mode === "confirm_ma_broad") { startConfirmMaBroad(); return; }
    clearResultTimer();
    clearInputUnlockTimer();
    unlockInput();
    cancelSpeech();
    currentMode = mode;
    areaReferenceFeatures = null;
    currentPracticeLabel = options.practiceLabel || "";
    puzzleState = null;
    previousPuzzleFixed = 0;
    els.resetButton.classList.remove("is-hidden");
    if (mode === "puzzle" && liteMode && els.puzzlePieceSelect.value === "all") {
      els.puzzlePieceSelect.value = "small";
    }
    const puzzleIds = mode === "puzzle" ? puzzlePieceIds() : null;
    if (mode === "puzzle") options = { ...options, questionIds: puzzleIds };
    engine.reset(mode, els.suddenDeathToggle.checked, options);
    ensureMap().reset();
    renderer.setMode(mode);
    if (mode === "puzzle") {
      renderer.startPuzzle(updatePuzzleState, { pieceIds: puzzleIds });
      updatePuzzleBestTime();
    }
    showGame();
    lastReferenceKey = null;
    updateHud();
    if (!engine.currentQuestion()) {
      scheduleResult(120);
    }
    startTimer();
    window.setTimeout(() => {
      renderer.map.invalidateSize();
      renderer.fitToMain();
    }, 80);
  }

  function showStart() {
    clearResultTimer();
    clearInputUnlockTimer();
    unlockInput();
    cancelSpeech();
    stopTimer();
    els.resetButton.classList.remove("is-hidden");
    els.startScreen.classList.remove("is-hidden");
    els.gameScreen.classList.add("is-hidden");
    els.resultScreen.classList.add("is-hidden");
    els.puzzleControls.classList.add("is-hidden");
    updateTopStats();
  }

  function showGame() {
    clearInputUnlockTimer();
    unlockInput();
    moveMapTo(els.playMapSlot);
    els.startScreen.classList.add("is-hidden");
    els.gameScreen.classList.remove("is-hidden");
    els.resultScreen.classList.add("is-hidden");
    els.puzzleControls.classList.toggle("is-hidden", currentMode !== "puzzle");
  }

  function startLabelEditor() {
    clearResultTimer();
    clearInputUnlockTimer();
    unlockInput();
    currentMode = "municipality";
    showGame();
    ensureMap().reset();
    renderer.setMode("municipality");
    renderer.enableLabelEditor(updateLabelEditorPanel);
    if (!renderer.tileLayerVisible) {
      renderer.toggleTileLayer();
      els.tileLayerToggle.classList.add("is-active");
    }
    els.labelEditorPanel.classList.remove("is-hidden");
    els.modeLabel.textContent = "ラベル調整モード";
    els.remainingCount.textContent = "0";
    els.correctCount.textContent = "0";
    els.mistakeCount.textContent = "0";
    els.elapsedTime.textContent = "00:00";
    setLabelEditorScope("municipality");
  }

  function updateLabelEditorPanel(state) {
    const selected = state.selected;
    if (selected) {
      els.labelAngleInput.value = `${Math.round(selected.angle || 0)}`;
      els.labelSizeInput.value = `${selected.size || 10}`;
    }
    renderLabelTargetOptions(state.targets || [], state.selectedId || "");
    const normalized = normalizeLabelOverrideShape(state.overrides);
    els.labelOverrideOutput.value = `window.SAITAMA_LABEL_OVERRIDES = ${JSON.stringify(normalized, null, 2)};\n`;
    updateLabelDraft(normalized);
  }

  function renderLabelTargetOptions(targets, selectedId) {
    const previousValue = els.labelTargetSelect.value;
    els.labelTargetSelect.innerHTML = targets.map((target) => (
      `<option value="${escapeHtml(target.id)}">${target.edited ? "＊" : ""}${escapeHtml(target.label)}</option>`
    )).join("");
    const nextValue = selectedId || (targets.some((target) => target.id === previousValue) ? previousValue : "");
    if (nextValue) els.labelTargetSelect.value = nextValue;
  }

  function setLabelEditorScope(scope) {
    if (!renderer) return;
    renderer.setLabelEditorScope(scope);
    const municipalityActive = scope === "municipality";
    els.municipalityLabelEditButton.classList.toggle("is-active", municipalityActive);
    els.municipalityLabelEditButton.setAttribute("aria-selected", municipalityActive ? "true" : "false");
    els.areaCodeLabelEditButton.classList.toggle("is-active", !municipalityActive);
    els.areaCodeLabelEditButton.setAttribute("aria-selected", municipalityActive ? "false" : "true");
    els.questionText.textContent = municipalityActive
      ? "市区町村ラベルの文字か丸点をドラッグして移動"
      : "市外局番ラベルの文字か丸点をドラッグして移動";
  }

  async function copyLabelOverrides() {
    const text = els.labelOverrideOutput.value || "{}";
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    if (els.labelDraftStatus) {
      els.labelDraftStatus.textContent = "コピーしました。補正ファイルへ貼り付けると公開用ラベルに反映されます。";
      els.labelDraftStatus.classList.add("is-dirty");
    }
  }

  function updateLabelDraft(overrides) {
    if (!labelEditMode || !els.labelDraftStatus) return;
    const dirty = !sameLabelOverrides(overrides, baseLabelOverrides);
    if (dirty) {
      saveLabelEditorDraft(appConfig.id, overrides);
      els.labelDraftStatus.textContent = "未保存変更あり。一時保存済み。コピーして label-overrides.js に反映してください。";
      els.labelDraftStatus.classList.add("is-dirty");
    } else {
      clearLabelEditorDraft(appConfig.id);
      els.labelDraftStatus.textContent = "補正ファイルと同期済み";
      els.labelDraftStatus.classList.remove("is-dirty");
    }
  }

  function discardLabelDraft() {
    clearLabelEditorDraft(appConfig.id);
    window.location.reload();
  }

  function handleLabelEditorKeydown(event) {
    if (!labelEditMode || !renderer) return;
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const activeTag = document.activeElement && document.activeElement.tagName;
    const activeType = document.activeElement && document.activeElement.type;
    if (activeTag === "TEXTAREA" || activeTag === "SELECT") return;
    if (activeTag === "INPUT" && activeType !== "checkbox") return;
    const step = event.shiftKey ? 0.002 : 0.0003;
    const lat = event.key === "ArrowUp" ? step : event.key === "ArrowDown" ? -step : 0;
    const lng = event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0;
    renderer.nudgeSelectedLabel(lat, lng);
    event.preventDefault();
  }

  function showResult() {
    clearResultTimer();
    clearInputUnlockTimer();
    lockInput();
    cancelSpeech();
    stopTimer();
    const result = engine.result();
    const summary = window.ResultAnalytics.summarize(result);
    const savedProgress = window.ProgressStore.saveSession(appConfig.id, dataset, result);
    const datasetProgress = savedProgress.progress.datasets[appConfig.id];
    currentDatasetProgress = datasetProgress;
    renderer.applyProgressHeatmap(currentDatasetProgress, result.mode);
    lastResultPayload = window.ResultAnalytics.buildWeakPointExport(result, dataset.prefecture);

    els.resultModeLabel.textContent = currentPracticeLabel
      ? `${modeName(result.mode)} / ${currentPracticeLabel}`
      : modeName(result.mode);
    els.resultTitle.textContent = result.correct >= result.totalQuestions ? "Complete" : "Game Over";
    els.resultSummary.textContent = result.mistakes === 0
      ? `ノーミス。かなり仕上がっています。累積 ${datasetProgress?.sessions || 0} 回目の記録を保存しました。`
      : `弱点 ${lastResultPayload.weakPoints.length} 件をJSONに出力できます。累積 ${datasetProgress?.sessions || 0} 回目の記録を保存しました。`;
    els.resultCorrect.textContent = `${summary.correct}`;
    els.resultMistakes.textContent = `${summary.mistakes}`;
    els.resultAverage.textContent = `${(summary.averageTimeMs / 1000).toFixed(1)}s`;
    els.resultTotal.textContent = `${summary.totalQuestions}`;
    updateRankingTabs();
    renderRanking(datasetProgress);

    els.startScreen.classList.add("is-hidden");
    els.gameScreen.classList.add("is-hidden");
    els.resultScreen.classList.remove("is-hidden");
    moveMapTo(els.resultMapSlot);
    window.setTimeout(() => {
      renderer.map.invalidateSize();
      renderer.fitToMain();
    }, 80);
  }

  function updateRankingTabs() {
    els.rankingTabs.forEach((button) => {
      const active = button.dataset.rankingType === currentRankingType;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    els.rankingTitle.textContent = rankingTitle(currentRankingType);
  }

  function renderRanking(datasetProgress) {
    const ranking = window.ProgressStore.buildRanking(datasetProgress, currentRankingType, 5);
    currentRankingItems = ranking;
    updatePracticeButtons(datasetProgress);
    if (!ranking.length) {
      els.weakRankingList.innerHTML = `<li class="ranking-empty">累積データがまだありません。</li>`;
      return;
    }

    const maxValue = Math.max(...ranking.map((item) => rankingBarValue(item, currentRankingType)), 1);
    els.weakRankingList.innerHTML = ranking.map((item, index) => {
      const value = rankingBarValue(item, currentRankingType);
      const width = Math.max((value / maxValue) * 100, value > 0 ? 10 : 4);
      return `
        <li class="ranking-item">
          <span class="ranking-rank">${index + 1}</span>
          <span class="ranking-main">
            <span class="ranking-name">${escapeHtml(item.name)}</span>
            <span class="ranking-bar" aria-hidden="true"><span style="width:${width.toFixed(0)}%"></span></span>
          </span>
          <span class="ranking-meta">${rankingMeta(item)}</span>
        </li>
      `;
    }).join("");
  }

  function startPracticeFromRanking() {
    if (!currentRankingItems.length) return;
    const questionIds = practiceQuestionIds(currentRankingItems, currentMode);
    if (!questionIds.length) return;
    start(currentMode, {
      questionIds,
      practiceLabel: `${rankingTitle(currentRankingType)}から再出題`
    });
  }

  function startPracticeFromLastMistakes() {
    const items = window.ProgressStore.buildLastMistakeItems(currentDatasetProgress, 5);
    startPracticeFromItems(items, "前回ミスから再出題");
  }

  function startPracticeFromUnanswered() {
    const items = window.ProgressStore.buildUnansweredItems(currentDatasetProgress, 5);
    startPracticeFromItems(items, "未正解から再出題");
  }

  function startPracticeFromRecentMistakes() {
    const items = window.ProgressStore.buildRecentMistakeItems(currentDatasetProgress, 5);
    startPracticeFromItems(items, "最近ミスから再出題");
  }

  function startPracticeFromLowAccuracy() {
    const items = window.ProgressStore.buildRanking(currentDatasetProgress, "accuracy", 5);
    startPracticeFromItems(items, "低正答率から優先出題");
  }

  function startPracticeFromItems(items, label) {
    const questionIds = practiceQuestionIds(items, currentMode);
    if (!questionIds.length) return;
    start(currentMode, {
      questionIds,
      practiceLabel: label
    });
  }

  function updatePracticeButtons(datasetProgress) {
    els.practiceWeakButton.disabled = !currentRankingItems.length;
    els.practiceLastMistakeButton.disabled = !window.ProgressStore.buildLastMistakeItems(datasetProgress, 5).length;
    els.practiceUnansweredButton.disabled = !window.ProgressStore.buildUnansweredItems(datasetProgress, 5).length;
    els.practiceRecentMistakeButton.disabled = !window.ProgressStore.buildRecentMistakeItems(datasetProgress, 5).length;
    els.practiceLowAccuracyButton.disabled = !window.ProgressStore.buildRanking(datasetProgress, "accuracy", 5).length;
  }

  function practiceQuestionIds(ranking, mode) {
    if (mode === "ma") {
      return [...new Set(ranking
        .map((item) => item.area_code)
        .filter(Boolean)
        .map((areaCode) => `area_code:${areaCode}`))];
    }
    if (mode === "ma_broad") {
      return [...new Set(ranking
        .map((item) => item.id)
        .filter((id) => id && id.startsWith("broad_area_code:")))];
    }
    return ranking.map((item) => item.id).filter(Boolean);
  }

  function rankingTitle(type) {
    if (type === "accuracy") return "正答率ランキング";
    if (type === "time") return "平均時間ランキング";
    return "苦手ランキング";
  }

  function rankingBarValue(item, type) {
    if (type === "accuracy") return Math.max(100 - item.accuracy, 1);
    if (type === "time") return item.averageTimeMs || 0;
    return item.mistakes || 0;
  }

  function rankingMeta(item) {
    const average = item.averageTimeMs ? `${(item.averageTimeMs / 1000).toFixed(1)}s` : "-";
    return `ミス${item.mistakes} / 正答率${item.accuracy}% / 平均${average}`;
  }

  function updateHud() {
    els.questionText.textContent = currentMode === "puzzle"
      ? "ポリゴンをドラッグして元の位置へ戻す"
      : engine.questionText();
    els.modeLabel.textContent = currentPracticeLabel
      ? `${modeName(currentMode)} / ${currentPracticeLabel}`
      : modeName(currentMode);
    els.remainingCount.textContent = currentMode === "puzzle" && puzzleState
      ? `${Math.max(puzzleState.total - puzzleState.fixed, 0)}`
      : `${engine.remaining()}`;
    els.correctCount.textContent = currentMode === "puzzle" && puzzleState
      ? `${puzzleState.fixed}`
      : `${engine.correct}`;
    els.mistakeCount.textContent = `${engine.mistakes}`;
    els.elapsedTime.textContent = formatTime(engine.elapsedMs());
    updateReferencePreview();
  }

  function updatePuzzleState(state) {
    if (state.fixed > previousPuzzleFixed) playPuzzleTone(state.complete ? "complete" : "snap");
    previousPuzzleFixed = state.fixed;
    puzzleState = state;
    els.remainingCount.textContent = `${Math.max(state.total - state.fixed, 0)}`;
    els.correctCount.textContent = `${state.fixed}`;
    els.questionText.textContent = state.complete
      ? "完成"
      : `ポリゴンをドラッグして元の位置へ戻す (${state.fixed}/${state.total})`;
    if (state.complete && !engine.gameOver) {
      engine.completeAll();
      savePuzzleBestTime(engine.elapsedMs());
      scheduleResult(360);
    }
  }

  function populatePuzzleOptions() {
    const regions = [...new Set(dataset.municipalities.map((item) => item.region).filter(Boolean))].sort();
    els.puzzlePieceSelect.insertAdjacentHTML("beforeend", regions.map((region) => (
      `<option value="region:${escapeHtml(region)}">${escapeHtml(region)}</option>`
    )).join(""));
  }

  function puzzlePieceIds() {
    const value = els.puzzlePieceSelect.value || "all";
    if (value === "small") return dataset.municipalities.slice(0, 15).map((item) => item.id);
    if (value.startsWith("region:")) {
      const region = value.replace("region:", "");
      return dataset.municipalities.filter((item) => item.region === region).map((item) => item.id);
    }
    return dataset.municipalities.map((item) => item.id);
  }

  function puzzleBestKey() {
    return `geoquiz:puzzle-best:${appConfig.id}:${els.puzzlePieceSelect.value || "all"}`;
  }

  function puzzleBestMs() {
    try {
      return Number(window.localStorage.getItem(puzzleBestKey()) || "0");
    } catch {
      return 0;
    }
  }

  function updatePuzzleBestTime() {
    const best = puzzleBestMs();
    els.puzzleBestTime.textContent = best > 0 ? formatTime(best) : "--:--";
  }

  function savePuzzleBestTime(elapsedMs) {
    const best = puzzleBestMs();
    if (best > 0 && elapsedMs >= best) return;
    try {
      window.localStorage.setItem(puzzleBestKey(), String(elapsedMs));
    } catch {
      // Best time is a convenience metric; gameplay can continue without storage.
    }
    updatePuzzleBestTime();
  }

  function playPuzzleTone(type) {
    try {
      audioContext = audioContext || new (window.AudioContext || window.webkitAudioContext)();
      const now = audioContext.currentTime;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(type === "complete" ? 660 : 420, now);
      if (type === "complete") oscillator.frequency.exponentialRampToValueAtTime(880, now + 0.12);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(type === "complete" ? 0.08 : 0.045, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (type === "complete" ? 0.22 : 0.11));
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(now);
      oscillator.stop(now + (type === "complete" ? 0.24 : 0.12));
    } catch {
      // Audio feedback is optional.
    }
  }

  function startTimer() {
    stopTimer();
    timerId = window.setInterval(updateHud, 500);
  }

  function stopTimer() {
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  }

  function lockInput() {
    inputLocked = true;
  }

  function unlockInput() {
    inputLocked = false;
  }

  function unlockInputAfter(ms) {
    clearInputUnlockTimer();
    inputUnlockTimerId = window.setTimeout(() => {
      inputUnlockTimerId = null;
      unlockInput();
    }, ms);
  }

  function scheduleResult(ms) {
    clearResultTimer();
    resultTimerId = window.setTimeout(showResult, ms);
  }

  function clearResultTimer() {
    if (resultTimerId) window.clearTimeout(resultTimerId);
    resultTimerId = null;
  }

  function clearInputUnlockTimer() {
    if (inputUnlockTimerId) window.clearTimeout(inputUnlockTimerId);
    inputUnlockTimerId = null;
  }

  function moveMapTo(slot) {
    if (slot && els.map.parentElement !== slot) slot.appendChild(els.map);
  }

  function speakMistake(featureProperties) {
    if (!els.mistakeSpeechToggle.checked || !("speechSynthesis" in window)) return;
    const label = (currentMode === "ma" || currentMode === "ma_broad") ? pronounceAreaCode(featureProperties.area_code) : featureProperties.name;
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

  function cancelSpeech() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  function pronounceAreaCode(areaCode) {
    return String(areaCode || "")
      .split("")
      .map((char) => (char === "0" ? "ゼロ" : char))
      .join(" ");
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
    if (currentMode === "ma_broad") {
      if (!areaReferenceFeatures) {
        areaReferenceFeatures = window.MaUnion.buildMaBroadCollections(dataset);
      }
      return areaReferenceFeatures.find((feature) => feature.properties.area_code === question.broad_area_code);
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
      imageQuestions: window[config.imageQuestionsGlobal] || [],
      labelOverrides: window[config.labelOverridesGlobal] || {}
    };
  }

  function resolveDatasetId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("dataset") || params.get("id") || "saitama";
  }

  function resolveEditMode() {
    const params = new URLSearchParams(window.location.search);
    return params.get("edit") || "";
  }

  function resolveStartMode() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode") || "";
    return appConfig.enabledModes.includes(mode) ? mode : "";
  }

  function resolveLiteMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("lite") === "1") return true;
    return window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
  }

  function labelDraftKey(datasetId) {
    return `geoquiz:label-draft:${datasetId}`;
  }

  function loadLabelEditorDraft(datasetId) {
    try {
      const raw = window.localStorage.getItem(labelDraftKey(datasetId));
      if (!raw) return null;
      const payload = JSON.parse(raw);
      return {
        ...payload,
        overrides: normalizeLabelOverrideShape(payload.overrides || payload)
      };
    } catch {
      try {
        window.localStorage.removeItem(labelDraftKey(datasetId));
      } catch {
        // Ignore draft cleanup failures. The editor can continue from checked-in data.
      }
      return null;
    }
  }

  function saveLabelEditorDraft(datasetId, overrides) {
    try {
      window.localStorage.setItem(labelDraftKey(datasetId), JSON.stringify({
        datasetId,
        updatedAt: new Date().toISOString(),
        overrides: normalizeLabelOverrideShape(overrides)
      }));
    } catch {
      // The editor still exposes copyable output when localStorage is unavailable.
    }
  }

  function clearLabelEditorDraft(datasetId) {
    try {
      window.localStorage.removeItem(labelDraftKey(datasetId));
    } catch {
      // Ignore storage cleanup failures.
    }
  }

  function normalizeLabelOverrideShape(overrides) {
    const raw = overrides || {};
    const municipalities = raw.municipalities || Object.fromEntries(Object.entries(raw)
      .filter(([key, value]) => key !== "areaCodes" && key !== "municipalities" && value && typeof value === "object"));
    return {
      municipalities: compactLabelOverrides(municipalities),
      areaCodes: compactLabelOverrides(raw.areaCodes || {})
    };
  }

  function compactLabelOverrides(overrides) {
    return Object.fromEntries(Object.entries(overrides || {})
      .filter(([, value]) => value && typeof value === "object" && !Array.isArray(value))
      .map(([id, value]) => [id, {
        point: Array.isArray(value.point) ? value.point : undefined,
        angle: typeof value.angle === "number" ? value.angle : undefined,
        size: typeof value.size === "number" ? value.size : undefined
      }]));
  }

  function sameLabelOverrides(a, b) {
    return JSON.stringify(normalizeLabelOverrideShape(a)) === JSON.stringify(normalizeLabelOverrideShape(b));
  }

  function formatTime(ms) {
    const total = Math.floor(ms / 1000);
    const min = String(Math.floor(total / 60)).padStart(2, "0");
    const sec = String(total % 60).padStart(2, "0");
    return `${min}:${sec}`;
  }

  function exportProgressJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      progress: window.ProgressStore.exportProgress()
    };
    window.ResultAnalytics.downloadJson(payload, "geoquiz-progress");
  }

  function updateTopStats() {
    const dp = window.ProgressStore.getDatasetProgress(appConfig.id);
    if (!dp) {
      els.topStatSessions.textContent = "";
      els.topStatAccuracy.textContent = "";
      els.topStatWeak.textContent = "";
      els.topStatLastPlay.textContent = "";
      renderMiniHeatmap(null);
      return;
    }

    els.topStatSessions.textContent = `${dp.sessions || 0}`;

    const statValues = Object.values(dp.stats || {});
    const totalPlays = statValues.reduce((sum, s) => sum + (s.plays || 0), 0);
    const totalCorrect = statValues.reduce((sum, s) => sum + (s.correct || 0), 0);
    els.topStatAccuracy.textContent = totalPlays > 0
      ? `${Math.round((totalCorrect / totalPlays) * 100)}%`
      : "";

    let weakCount = 0;
    statValues.forEach((stat) => {
      const mStat = stat.modes && stat.modes["municipality"];
      if (!mStat || !mStat.recentResults || !mStat.recentResults.length) return;
      const score = mStat.recentResults.reduce((sum, v) => sum + v, 0) / mStat.recentResults.length;
      if (score < 0.4) weakCount++;
    });
    els.topStatWeak.textContent = weakCount > 0 ? `${weakCount}` : "";

    if (dp.updatedAt) {
      const played = new Date(dp.updatedAt);
      const now = new Date();
      const diffDays = Math.floor((now - played) / (1000 * 60 * 60 * 24));
      if (diffDays === 0) {
        els.topStatLastPlay.textContent = "今日";
      } else if (diffDays === 1) {
        els.topStatLastPlay.textContent = "昨日";
      } else {
        els.topStatLastPlay.textContent = `${diffDays}日前`;
      }
    } else {
      els.topStatLastPlay.textContent = "";
    }

    renderMiniHeatmap(dp);
  }

  function renderMiniHeatmap(dp) {
    if (!els.topMiniHeatmap) return;
    if (!dp || !dp.stats) {
      els.topMiniHeatmap.innerHTML = "";
      return;
    }

    const bars = [];
    Object.values(dp.stats).forEach((stat) => {
      const mStat = stat.modes && stat.modes["municipality"];
      if (!mStat || !mStat.recentResults || !mStat.recentResults.length) return;
      const score = mStat.recentResults.reduce((sum, v) => sum + v, 0) / mStat.recentResults.length;
      bars.push(score);
    });

    bars.sort((a, b) => b - a);
    const display = bars.slice(0, 20);

    if (!display.length) {
      els.topMiniHeatmap.innerHTML = "";
      return;
    }

    const BAR_W = 8;
    const BAR_MAX_H = 32;
    const COLOR_STEPS = [
      { threshold: 0.8, color: "#4fb7a5" },
      { threshold: 0.6, color: "#d4b46a" },
      { threshold: 0.4, color: "#e09a5a" },
      { threshold: 0, color: "#e35d5d" }
    ];

    function barColor(score) {
      for (const step of COLOR_STEPS) {
        if (score >= step.threshold) return step.color;
      }
      return COLOR_STEPS[COLOR_STEPS.length - 1].color;
    }

    els.topMiniHeatmap.innerHTML = display.map((score) => {
      const h = Math.max(4, Math.round(score * BAR_MAX_H));
      const color = barColor(score);
      return `<span style="display:inline-block;width:${BAR_W}px;height:${h}px;background:${color};border-radius:2px;margin-right:2px;vertical-align:bottom;"></span>`;
    }).join("");
  }

  function showStorageRecoveryNotice() {
    window.ProgressStore.loadProgress();
    const notice = window.ProgressStore.consumeRecoveryNotice();
    if (!notice) return;
    els.storageNoticeText.textContent = notice;
    els.storageNotice.classList.remove("is-hidden");
  }

  function importProgressJson(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      try {
        const payload = JSON.parse(String(reader.result || "{}"));
        const progress = payload.progress || payload;
        const imported = window.ProgressStore.importProgress(progress);
        currentDatasetProgress = imported.progress.datasets[appConfig.id] || null;
        renderRanking(currentDatasetProgress);
        els.resultSummary.textContent = "累積成績JSONを読み込みました。";
      } catch (error) {
        els.resultSummary.textContent = `累積成績JSONを読み込めませんでした: ${error.message}`;
      } finally {
        event.target.value = "";
      }
    });
    reader.readAsText(file);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
