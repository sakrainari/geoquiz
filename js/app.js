(function () {
  const appConfig = resolveAppConfig(resolveDatasetId());
  const dataset = appConfig.dataset;
  const ghostData = appConfig.ghostData;
  const baseLabelOverrides = normalizeLabelOverrideShape(appConfig.labelOverrides);
  const speechReadings = appConfig.speechReadings || {};
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
  let currentRankingPracticeItems = [];
  let currentPracticeLabel = "";
  let puzzleState = null;
  let previousPuzzleFixed = 0;
  let audioContext = null;
  const QUIZ_START_MODES = ["municipality", "ma"];
  const DEFAULT_QUIZ_MODE = appConfig.enabledModes.includes("municipality")
    ? "municipality"
    : (QUIZ_START_MODES.find((mode) => appConfig.enabledModes.includes(mode)) || "municipality");
  const labelEditMode = resolveEditMode() === "labels";
  const liteMode = resolveLiteMode() || !!(appConfig && appConfig.forceLiteMode);
  const labelEditorDraft = labelEditMode ? loadLabelEditorDraft(appConfig.id) : null;
  const labelOverrides = labelEditorDraft ? labelEditorDraft.overrides : baseLabelOverrides;
  let selectedQuizMode = DEFAULT_QUIZ_MODE;
  let countdownTimerId = null;
  let currentRunConfig = null;
  let completedResultState = null;
  let lastFailureHighlight = null;
  const currentSessionSettings = {
    rule: "normal",
    audio: true,
    tileLayerVisible: resolveInitialTileLayerVisibility(),
    layout: resolveInitialLayout()
  };

  const els = {
    startScreen: document.getElementById("startScreen"),
    gameScreen: document.getElementById("gameScreen"),
    resultScreen: document.getElementById("resultScreen"),
    playMapSlot: document.getElementById("playMapSlot"),
    resultMapSlot: document.getElementById("resultMapSlot"),
    prepOverlay: document.getElementById("prepOverlay"),
    prepModeTitle: document.getElementById("prepModeTitle"),
    prepModeCopy: document.getElementById("prepModeCopy"),
    countdownOverlay: document.getElementById("countdownOverlay"),
    countdownText: document.getElementById("countdownText"),
    endOverlay: document.getElementById("endOverlay"),
    endCard: document.getElementById("endCard"),
    endModeLabel: document.getElementById("endModeLabel"),
    endTitle: document.getElementById("endTitle"),
    endSummary: document.getElementById("endSummary"),
    endPrimaryLabel: document.getElementById("endPrimaryLabel"),
    endPrimaryValue: document.getElementById("endPrimaryValue"),
    endFirstTryValue: document.getElementById("endFirstTryValue"),
    endMistakesValue: document.getElementById("endMistakesValue"),
    endAverageValue: document.getElementById("endAverageValue"),
    endTimeLabel: document.getElementById("endTimeLabel"),
    endTimeValue: document.getElementById("endTimeValue"),
    endRestartButton: document.getElementById("endRestartButton"),
    endAnalysisButton: document.getElementById("endAnalysisButton"),
    endTopButton: document.getElementById("endTopButton"),
    endShareButton: document.getElementById("endShareButton"),
    map: document.getElementById("map"),
    appSubtitle: document.getElementById("appSubtitle"),
    appTitle: document.getElementById("appTitle"),
    appDescription: document.getElementById("appDescription"),
    regionSelector: document.getElementById("regionSelector"),
    regionMenu: document.getElementById("regionMenu"),
    quizModeButtons: [...document.querySelectorAll(".mode-grid [data-start-mode]")],
    confirmModeButtons: [...document.querySelectorAll(".mode-grid-confirm [data-start-mode]")],
    startQuizButton: document.getElementById("startQuizButton"),
    startSelectionNote: document.getElementById("startSelectionNote"),
    ruleEasyButton: document.getElementById("ruleEasyButton"),
    ruleNormalButton: document.getElementById("ruleNormalButton"),
    ruleSuddenDeathButton: document.getElementById("ruleSuddenDeathButton"),
    audioOnButton: document.getElementById("audioOnButton"),
    audioOffButton: document.getElementById("audioOffButton"),
    tileLayerOnButton: document.getElementById("tileLayerOnButton"),
    tileLayerOffButton: document.getElementById("tileLayerOffButton"),
    layoutLeftButton: document.getElementById("layoutLeftButton"),
    layoutTopButton: document.getElementById("layoutTopButton"),
    layoutBottomButton: document.getElementById("layoutBottomButton"),
    layoutRightButton: document.getElementById("layoutRightButton"),
    referencePreview: document.getElementById("referencePreview"),
    referencePreviewTop: document.getElementById("referencePreviewTop"),
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
    tileLayerToggleTop: document.getElementById("tileLayerToggleTop"),
    resetButton: document.getElementById("resetButton"),
    retryButton: document.getElementById("retryButton"),
    resultBackToMenuButton: document.getElementById("resultBackToMenuButton"),
    backToMenuButton: document.getElementById("backToMenuButton"),
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
    resultFirstTry: document.getElementById("resultFirstTry"),
    resultAverage: document.getElementById("resultAverage"),
    resultTotalLabel: document.getElementById("resultTotalLabel"),
    resultTotal: document.getElementById("resultTotal"),
    resultTimeLabel: document.getElementById("resultTimeLabel"),
    resultTime: document.getElementById("resultTime"),
    resultPreviousDelta: document.getElementById("resultPreviousDelta"),
    resultBestStatus: document.getElementById("resultBestStatus"),
    resultHistoryCopy: document.getElementById("resultHistoryCopy"),
    resultHistoryMetricLabel: document.getElementById("resultHistoryMetricLabel"),
    resultHistoryBestLabel: document.getElementById("resultHistoryBestLabel"),
    resultHistoryList: document.getElementById("resultHistoryList"),
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
    topMiniHeatmap: document.getElementById("topMiniHeatmap"),
    // グローバルランキング
    globalRankingSubmit: document.getElementById("globalRankingSubmit"),
    rankingNameInput: document.getElementById("rankingNameInput"),
    rankingTimeDisplay: document.getElementById("rankingTimeDisplay"),
    rankingMissesDisplay: document.getElementById("rankingMissesDisplay"),
    rankingMapVisibleDisplay: document.getElementById("rankingMapVisibleDisplay"),
    rankingSubmitBtn: document.getElementById("rankingSubmitBtn"),
    rankingSubmitMsg: document.getElementById("rankingSubmitMsg"),
    rankingViewBtn: document.getElementById("rankingViewBtn"),
    globalRankingModal: document.getElementById("globalRankingModal"),
    globalRankingList: document.getElementById("globalRankingList"),
    globalRankingModalClose: document.getElementById("globalRankingModalClose"),
    globalRankingTabs: [...document.querySelectorAll(".global-ranking-tab")],
    globalRankingQuizTabs: [...document.querySelectorAll(".global-ranking-quiz-tab")]
  };

  applyDatasetMeta();
  renderRegionMenu();
  updateTopStats();
  applyAvailableModes();
  applySessionSettingsToGameControls();
  syncStartSettingsUI();
  setSelectedQuizMode(DEFAULT_QUIZ_MODE);
  document.body.classList.toggle("is-lite-mode", liteMode);

  els.quizModeButtons.forEach((button) => {
    if (!appConfig.enabledModes.includes(button.dataset.startMode)) return;
    button.addEventListener("click", () => openPreparation(button.dataset.startMode));
  });
  els.confirmModeButtons.forEach((button) => {
    if (!appConfig.enabledModes.includes(button.dataset.startMode)) return;
    button.addEventListener("click", () => start(button.dataset.startMode));
  });
  els.startQuizButton.addEventListener("click", () => {
    beginSelectedQuizMode();
  });
  els.ruleEasyButton.addEventListener("click", () => {
    updateSessionSettings({ rule: "easy" });
  });
  els.ruleNormalButton.addEventListener("click", () => {
    updateSessionSettings({ rule: "normal" });
  });
  els.ruleSuddenDeathButton.addEventListener("click", () => {
    updateSessionSettings({ rule: "sudden_death" });
  });
  els.audioOnButton.addEventListener("click", () => {
    updateSessionSettings({ audio: true });
  });
  els.audioOffButton.addEventListener("click", () => {
    updateSessionSettings({ audio: false });
  });
  els.tileLayerOnButton.addEventListener("click", () => {
    updateSessionSettings({ tileLayerVisible: true });
  });
  els.tileLayerOffButton.addEventListener("click", () => {
    updateSessionSettings({ tileLayerVisible: false });
  });
  els.layoutLeftButton.addEventListener("click", () => {
    updateSessionSettings({ layout: "left" });
  });
  els.layoutTopButton.addEventListener("click", () => {
    updateSessionSettings({ layout: "top" });
  });
  els.layoutBottomButton.addEventListener("click", () => {
    updateSessionSettings({ layout: "bottom" });
  });
  els.layoutRightButton.addEventListener("click", () => {
    updateSessionSettings({ layout: "right" });
  });

  els.tileLayerToggle.addEventListener("click", () => {
    if (!renderer) return;
    const active = renderer.toggleTileLayer();
    currentSessionSettings.tileLayerVisible = active;
    syncTileLayerButtons(active);
    syncStartSettingsUI();
  });
  els.resetButton.addEventListener("click", restartCurrentGame);
  els.retryButton.addEventListener("click", restartCurrentGame);
  els.resultBackToMenuButton.addEventListener("click", showStart);
  els.backToMenuButton.addEventListener("click", showStart);
  els.endRestartButton.addEventListener("click", restartCurrentGame);
  els.endAnalysisButton.addEventListener("click", showAnalysisScreen);
  els.endTopButton.addEventListener("click", showStart);
  els.endShareButton.addEventListener("click", shareResultToX);
  if (els.regionSelector) {
    els.regionSelector.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleRegionMenu();
    });
  }
  if (els.regionMenu) {
    els.regionMenu.addEventListener("click", (event) => {
      const button = event.target.closest("[data-dataset-id]");
      if (!button) return;
      event.preventDefault();
      navigateToDataset(button.dataset.datasetId);
    });
  }
  document.addEventListener("click", (event) => {
    if (!els.regionMenu || !els.regionSelector) return;
    if (els.regionMenu.classList.contains("is-hidden")) return;
    if (els.regionMenu.contains(event.target) || els.regionSelector.contains(event.target)) return;
    closeRegionMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRegionMenu();
  });
  els.mistakeSpeechToggle.addEventListener("change", () => {
    currentSessionSettings.audio = els.mistakeSpeechToggle.checked;
    syncStartSettingsUI();
  });
  document.querySelectorAll(".layout-btn").forEach((button) => {
    button.addEventListener("click", () => {
      currentSessionSettings.layout = button.dataset.layout || currentSessionSettings.layout;
      syncStartSettingsUI();
    });
  });
  populatePuzzleOptions();
  els.puzzlePieceSelect.addEventListener("change", () => {
    if (currentMode === "puzzle") start("puzzle");
  });
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
    if (requestedMode) {
      if (isQuizMode(requestedMode)) {
        openPreparation(requestedMode);
      } else {
        start(requestedMode);
      }
    }
  }

  function isQuizMode(mode) {
    return QUIZ_START_MODES.includes(mode);
  }

  function setSelectedQuizMode(mode) {
    const nextMode = appConfig.enabledModes.includes(mode) && isQuizMode(mode)
      ? mode
      : DEFAULT_QUIZ_MODE;
    selectedQuizMode = nextMode;
    els.quizModeButtons.forEach((button) => {
      const active = button.dataset.startMode === nextMode;
      button.classList.toggle("is-selected", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (els.startSelectionNote) {
      els.startSelectionNote.textContent = `${modeName(nextMode)} / ${ruleName(currentSessionSettings.rule)}で開始`;
    }
    if (els.prepModeTitle) els.prepModeTitle.textContent = modeName(nextMode);
    if (els.prepModeCopy) {
      els.prepModeCopy.textContent = "地図と設定を確認してから開始できます。";
    }
  }

  function syncStartSettingsUI() {
    els.ruleEasyButton.classList.toggle("is-active", currentSessionSettings.rule === "easy");
    els.ruleNormalButton.classList.toggle("is-active", currentSessionSettings.rule === "normal");
    els.ruleSuddenDeathButton.classList.toggle("is-active", currentSessionSettings.rule === "sudden_death");
    els.audioOnButton.classList.toggle("is-active", currentSessionSettings.audio);
    els.audioOffButton.classList.toggle("is-active", !currentSessionSettings.audio);
    els.tileLayerOnButton.classList.toggle("is-active", currentSessionSettings.tileLayerVisible);
    els.tileLayerOffButton.classList.toggle("is-active", !currentSessionSettings.tileLayerVisible);
    els.layoutLeftButton.classList.toggle("is-active", currentSessionSettings.layout === "left");
    els.layoutTopButton.classList.toggle("is-active", currentSessionSettings.layout === "top");
    els.layoutBottomButton.classList.toggle("is-active", currentSessionSettings.layout === "bottom");
    els.layoutRightButton.classList.toggle("is-active", currentSessionSettings.layout === "right");
    if (els.startSelectionNote) {
      els.startSelectionNote.textContent = `${modeName(selectedQuizMode || DEFAULT_QUIZ_MODE)} / ${ruleName(currentSessionSettings.rule)}で開始`;
    }
  }

  function updateSessionSettings(nextSettings = {}) {
    Object.assign(currentSessionSettings, nextSettings);
    applySessionSettingsToGameControls();
    syncStartSettingsUI();
  }

  function applySessionSettingsToGameControls() {
    syncRuleLockControls(currentSessionSettings.rule);
    setCheckboxValue(els.mistakeSpeechToggle, currentSessionSettings.audio);
    applyTileLayerSelection(currentSessionSettings.tileLayerVisible);
    applyLayoutSelection(currentSessionSettings.layout);
  }

  function syncRuleLockControls(rule) {
    const suddenDeath = rule === "sudden_death";
    [els.suddenDeathToggle, document.getElementById("suddenDeathToggleTop"), document.getElementById("suddenDeathToggleBar")]
      .filter(Boolean)
      .forEach((element) => {
        element.checked = suddenDeath;
        element.disabled = true;
        element.title = `ルールは開始前に固定されます: ${ruleName(rule)}`;
      });
  }

  function setCheckboxValue(element, checked) {
    if (!element) return;
    if (element.checked !== checked) element.checked = checked;
    element.dispatchEvent(new Event("change"));
  }

  function applyLayoutSelection(layout) {
    const nextLayout = layout || "left";
    const target = document.querySelector(`.layout-btn[data-layout="${nextLayout}"]`);
    if (target) target.click();
  }

  function applyTileLayerSelection(visible) {
    if (renderer && renderer.tileLayerVisible !== visible) {
      renderer.toggleTileLayer();
    }
    syncTileLayerButtons(visible);
  }

  function syncTileLayerButtons(active) {
    els.tileLayerToggle.classList.toggle("is-active", active);
    if (els.tileLayerToggleTop) {
      els.tileLayerToggleTop.classList.toggle("is-active", active);
    }
  }

  function restartCurrentGame() {
    if (currentRunConfig && isQuizMode(currentRunConfig.mode)) {
      if (currentRunConfig.puzzlePieceValue) {
        els.puzzlePieceSelect.value = currentRunConfig.puzzlePieceValue;
      }
      start(currentRunConfig.mode, { ...currentRunConfig.options });
      return;
    }
    if (isQuizMode(currentMode)) start(currentMode);
  }

  function openPreparation(mode) {
    const nextMode = mode || selectedQuizMode || DEFAULT_QUIZ_MODE;
    clearResultTimer();
    clearInputUnlockTimer();
    clearCountdown();
    stopTimer();
    inputLocked = true;
    cancelSpeech();
    hideEndOverlay();
    completedResultState = null;
    setSelectedQuizMode(nextMode);
    applySessionSettingsToGameControls();
    currentMode = nextMode;
    currentRunConfig = null;
    areaReferenceFeatures = null;
    currentPracticeLabel = "";
    puzzleState = null;
    previousPuzzleFixed = 0;
    showGame();
    showPreparationOverlay();
    ensureMap().reset();
    applyTileLayerSelection(currentSessionSettings.tileLayerVisible);
    renderer.setMode(nextMode);
    renderer.setEasyMode(false);
    renderer.fitToMain();
    els.resetButton.classList.add("is-hidden");
    els.puzzleControls.classList.add("is-hidden");
    els.modeLabel.textContent = `${modeName(nextMode)} / 開始前設定`;
    els.questionText.textContent = "地図を確認してから開始";
    els.remainingCount.textContent = "0";
    els.correctCount.textContent = "0";
    els.mistakeCount.textContent = "0";
    els.elapsedTime.textContent = "00:00";
    if (els.referencePreview) els.referencePreview.innerHTML = "";
    if (els.referencePreviewTop) els.referencePreviewTop.innerHTML = "";
  }

  function beginSelectedQuizMode() {
    hidePreparationOverlay();
    start(selectedQuizMode || DEFAULT_QUIZ_MODE);
  }

  function showPreparationOverlay() {
    if (els.prepOverlay) els.prepOverlay.classList.remove("is-hidden");
    if (els.gameScreen) els.gameScreen.classList.add("is-prep-mode");
  }

  function hidePreparationOverlay() {
    if (els.prepOverlay) els.prepOverlay.classList.add("is-hidden");
    if (els.gameScreen) els.gameScreen.classList.remove("is-prep-mode");
  }

  function showEndOverlay() {
    if (els.endOverlay) els.endOverlay.classList.remove("is-hidden");
  }

  function hideEndOverlay() {
    if (els.endOverlay) els.endOverlay.classList.add("is-hidden");
    if (els.endCard) {
      els.endCard.classList.remove("is-clear", "is-game-over");
    }
  }

  function clearCountdown() {
    if (countdownTimerId) window.clearTimeout(countdownTimerId);
    countdownTimerId = null;
    if (els.countdownOverlay) els.countdownOverlay.classList.add("is-hidden");
    if (els.countdownText) els.countdownText.classList.remove("is-word");
  }

  function runCountdown(onComplete) {
    clearCountdown();
    inputLocked = true;
    const steps = ["3", "2", "1", "Start"];
    let stepIndex = 0;
    const tick = () => {
      if (els.countdownText) {
        const value = steps[stepIndex];
        els.countdownText.textContent = value;
        els.countdownText.classList.toggle("is-word", value === "Start");
      }
      if (els.countdownOverlay) els.countdownOverlay.classList.remove("is-hidden");
      const delay = stepIndex === steps.length - 1 ? 520 : 700;
      countdownTimerId = window.setTimeout(() => {
        if (stepIndex === steps.length - 1) {
          clearCountdown();
          onComplete();
          return;
        }
        stepIndex += 1;
        tick();
      }, delay);
    };
    tick();
  }

  function ensureMap() {
    if (renderer) return renderer;
    renderer = new window.MapRenderer("map", dataset, ghostData, {
      labelOverrides,
      liteMode,
      initialView: appConfig.initialView || null,
      labelBehavior: appConfig.labelBehavior || null,
      mapMinZoom: appConfig.mapMinZoom || null,
      mapMaxZoom: appConfig.mapMaxZoom || null,
      preferCanvas: appConfig.preferCanvas || false
    });
    window.__geoquizRenderer = renderer;
    currentSessionSettings.tileLayerVisible = renderer.tileLayerVisible;
    syncTileLayerButtons(renderer.tileLayerVisible);
    syncStartSettingsUI();
    renderer.onClick((feature) => {
      if (currentMode === "puzzle") return;
      if (currentMode === "confirm") return;
      if (currentMode === "confirm_ma") return;
      if (inputLocked) return;
      const result = engine.answer(feature.properties);
      if (result.ignored) return;
      if (result.correct) {
        lastFailureHighlight = null;
        lockInput();
        speakAnswer(feature.properties);
        if (currentMode === "ma") {
          renderer.markAreaCodeCorrect(result.question.area_code, result.mistakesBeforeCorrect);
        } else {
          renderer.markCorrect(feature.properties.id, result.mistakesBeforeCorrect);
        }
      } else {
        lastFailureHighlight = currentMode === "ma"
          ? { kind: "areaCode", value: feature.properties.area_code }
          : { kind: "municipality", value: feature.properties.id };
        lockInput();
        if (currentMode === "ma") {
          renderer.flashAreaCodeWrong(feature.properties.area_code);
        } else {
          renderer.flashWrong(feature.properties.id);
        }
        speakAnswer(feature.properties);
      }
      updateHud();
      if (result.finished) {
        scheduleResult(result.correct ? 360 : 520);
      } else {
        unlockInputAfter(result.correct ? 360 : 300);
      }
    });
    // データセット確定後、アイドル時間にラベル配置計算をキャッシュへ積む
    if (appConfig.warmupLabels !== false) {
      const warmup = () => renderer.warmupPlacements();
      if (typeof requestIdleCallback !== "undefined") {
        requestIdleCallback(warmup, { timeout: 3000 });
      } else {
        setTimeout(warmup, 200);
      }
    }

    return renderer;
  }

  function startConfirmMa() {
    clearResultTimer();
    clearInputUnlockTimer();
    clearCountdown();
    unlockInput();
    cancelSpeech();
    stopTimer();
    applySessionSettingsToGameControls();
    currentRunConfig = null;
    hideEndOverlay();
    hidePreparationOverlay();
    currentMode = "confirm_ma";
    areaReferenceFeatures = null;
    currentPracticeLabel = "";
    puzzleState = null;
    previousPuzzleFixed = 0;
    showGame();
    ensureMap().reset();
    renderer.setMode("ma");
    renderer.setEasyMode(false);
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

  function startConfirm() {
    clearResultTimer();
    clearInputUnlockTimer();
    clearCountdown();
    unlockInput();
    cancelSpeech();
    stopTimer();
    applySessionSettingsToGameControls();
    currentRunConfig = null;
    hideEndOverlay();
    hidePreparationOverlay();
    currentMode = "confirm";
    currentPracticeLabel = "";
    puzzleState = null;
    previousPuzzleFixed = 0;
    showGame();
    ensureMap().reset();
    renderer.setMode("confirm");
    renderer.setEasyMode(false);
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
    clearResultTimer();
    clearInputUnlockTimer();
    clearCountdown();
    stopTimer();
    cancelSpeech();
    applySessionSettingsToGameControls();
    hideEndOverlay();
    hidePreparationOverlay();
    currentMode = mode;
    if (isQuizMode(mode)) setSelectedQuizMode(mode);
    areaReferenceFeatures = null;
    currentPracticeLabel = options.practiceLabel || "";
    completedResultState = null;
    lastFailureHighlight = null;
    puzzleState = null;
    previousPuzzleFixed = 0;
    els.resetButton.classList.remove("is-hidden");
    if (mode === "puzzle" && liteMode && els.puzzlePieceSelect.value === "all") {
      els.puzzlePieceSelect.value = "small";
    }
    const startOptions = { ...options };
    let puzzleIds = null;
    if (mode === "puzzle") {
      puzzleIds = puzzlePieceIds();
      startOptions.questionIds = puzzleIds;
    }
    currentRunConfig = {
      mode,
      options: { ...options },
      rule: currentSessionSettings.rule,
      puzzlePieceValue: mode === "puzzle" ? (els.puzzlePieceSelect.value || "all") : null
    };
    showGame();
    ensureMap().reset();
    applyTileLayerSelection(currentSessionSettings.tileLayerVisible);
    renderer.setMode(mode);
    renderer.setEasyMode(currentSessionSettings.rule === "easy" && ["municipality", "ma"].includes(mode));
    lastReferenceKey = null;
    inputLocked = true;
    engine.reset(mode, currentSessionSettings.rule, startOptions);
    if (mode === "puzzle") {
      renderer.startPuzzle(updatePuzzleState, { pieceIds: puzzleIds });
      updatePuzzleBestTime();
    }
    updateHud();
    if (!engine.currentQuestion()) {
      scheduleResult(120);
    }
    runCountdown(() => {
      engine.startedAt = Date.now();
      engine.questionStartedAt = Date.now();
      updateHud();
      startTimer();
      window.setTimeout(() => {
        renderer.map.invalidateSize();
        renderer.fitToMain();
      }, 80);
      unlockInput();
    });
    if (els.tileLayerToggle) els.tileLayerToggle.disabled = true;
  }

  function showStart() {
    clearResultTimer();
    clearInputUnlockTimer();
    clearCountdown();
    unlockInput();
    cancelSpeech();
    stopTimer();
    els.resetButton.classList.remove("is-hidden");
    els.startScreen.classList.remove("is-hidden");
    els.gameScreen.classList.add("is-hidden");
    els.resultScreen.classList.add("is-hidden");
    els.puzzleControls.classList.add("is-hidden");
    hideEndOverlay();
    hidePreparationOverlay();
    syncStartSettingsUI();
    updateTopStats();
    if (els.tileLayerToggle) els.tileLayerToggle.disabled = false;
  }

  function showGame() {
    clearInputUnlockTimer();
    unlockInput();
    moveMapTo(els.playMapSlot);
    els.startScreen.classList.add("is-hidden");
    els.gameScreen.classList.remove("is-hidden");
    window.setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 50);
    els.resultScreen.classList.add("is-hidden");
    hideEndOverlay();
    els.puzzleControls.classList.toggle("is-hidden", currentMode !== "puzzle");
  }

  function startLabelEditor() {
    clearResultTimer();
    clearInputUnlockTimer();
    clearCountdown();
    unlockInput();
    stopTimer();
    hideEndOverlay();
    hidePreparationOverlay();
    currentMode = "municipality";
    showGame();
    ensureMap().reset();
    renderer.setMode("municipality");
    renderer.setEasyMode(false);
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
    const labelGlobalName = appConfig.labelOverridesGlobal || "GEOQUIZ_LABEL_OVERRIDES";
    els.labelOverrideOutput.value = `window.${labelGlobalName} = ${JSON.stringify(normalized, null, 2)};\n`;
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
    clearCountdown();
    lockInput();
    cancelSpeech();
    stopTimer();
    hidePreparationOverlay();
    const result = engine.result();
    const summary = window.ResultAnalytics.summarize(result);
    const previousDatasetProgress = window.ProgressStore.getDatasetProgress(appConfig.id);
    const previousModeProgress = window.ProgressStore.getModeProgress(previousDatasetProgress, result.mode);
    const savedProgress = window.ProgressStore.saveSession(appConfig.id, dataset, result);
    const datasetProgress = savedProgress.progress.datasets[appConfig.id];
    const currentModeProgress = window.ProgressStore.getModeProgress(datasetProgress, result.mode);
    currentDatasetProgress = datasetProgress;
    lastResultPayload = window.ResultAnalytics.buildWeakPointExport(result, dataset.prefecture);
    completedResultState = {
      result,
      summary,
      datasetProgress,
      previousModeProgress,
      currentModeProgress,
      isClear: result.correct >= result.totalQuestions
    };
    renderEndOverlay(completedResultState);
  }

  function showAnalysisScreen() {
    if (!completedResultState) return;
    const { result, summary, datasetProgress, previousModeProgress, currentModeProgress, isClear } = completedResultState;
    const previousDelta = buildPreviousDelta(summary, previousModeProgress?.lastResult, isClear);
    const bestStatus = buildBestStatus(summary, currentModeProgress, isClear);
    renderer.applyProgressHeatmap(currentDatasetProgress, result.mode);
    const resultModeLabel = buildModeRuleLabel(result.mode, result.rule);
    els.resultModeLabel.textContent = currentPracticeLabel
      ? `${resultModeLabel} / ${currentPracticeLabel}`
      : resultModeLabel;
    els.resultTitle.textContent = isClear ? "Clear" : "Game Over";
    els.resultSummary.textContent = isClear
      ? `一発正解 ${summary.firstTryCount} 問。前回や自己ベストと見比べながら、次の更新ポイントを探せます。`
      : `弱点 ${lastResultPayload.weakPoints.length} 件をJSONに出力できます。累積 ${datasetProgress?.sessions || 0} 回目の記録から、苦手傾向も確認できます。`;
    els.resultCorrect.textContent = `${summary.correct}`;
    els.resultMistakes.textContent = `${summary.mistakes}`;
    els.resultFirstTry.textContent = `${summary.firstTryCount}`;
    els.resultAverage.textContent = `${formatSeconds(summary.averageTimeMs)}`;
    els.resultTotalLabel.textContent = isClear ? "出題数" : "到達問題数";
    els.resultTotal.textContent = `${isClear ? summary.totalQuestions : summary.reachedQuestions}`;
    els.resultTimeLabel.textContent = isClear ? "クリアタイム" : "経過時間";
    els.resultTime.textContent = `${formatTime(result.elapsedMs)}`;
    els.resultPreviousDelta.textContent = previousDelta;
    els.resultBestStatus.textContent = bestStatus;
    renderHistoryPanel(currentModeProgress, isClear);
    updateRankingTabs();
    renderRanking(datasetProgress);
    setupGlobalRankingUI(result, summary, isClear);

    hideEndOverlay();
    els.startScreen.classList.add("is-hidden");
    els.gameScreen.classList.add("is-hidden");
    els.resultScreen.classList.remove("is-hidden");
    moveMapTo(els.resultMapSlot);
    window.setTimeout(() => {
      renderer.map.invalidateSize();
      renderer.fitToMain();
    }, 80);
  }

  function buildPreviousDelta(summary, previousResult, isClear) {
    if (!previousResult) return "初回プレイ";
    if (isClear && previousResult.completed) {
      const deltaMs = summary.elapsedMs - (previousResult.elapsedMs || 0);
      if (deltaMs === 0) return "前回と同タイム";
      return `前回比 ${formatSignedSeconds(deltaMs)}`;
    }
    if (isClear && !previousResult.completed) {
      return "前回は未クリア";
    }
    if (!isClear && previousResult.completed) {
      return "前回はクリア";
    }
    const deltaReached = summary.reachedQuestions - (previousResult.reachedQuestions || 0);
    if (deltaReached === 0) {
      const deltaAvg = summary.averageTimeMs - (previousResult.averageTimeMs || 0);
      if (deltaAvg === 0) return "前回と同記録";
      return `平均 ${formatSignedSeconds(deltaAvg)}`;
    }
    return `前回比 ${deltaReached > 0 ? "+" : ""}${deltaReached}問`;
  }

  function buildBestStatus(summary, currentModeProgress, isClear) {
    if (!currentModeProgress) return "記録なし";
    const best = isClear ? currentModeProgress.bestClear : currentModeProgress.bestGameOver;
    if (!best) return "記録なし";
    const isUpdated = best.playedAt === currentModeProgress.lastResult?.playedAt;
    if (isClear) {
      return isUpdated ? `更新\n${formatTime(best.elapsedMs || 0)}` : formatTime(best.elapsedMs || 0);
    }
    const bestText = `${best.reachedQuestions || 0}問`;
    return isUpdated ? `更新\n${bestText}` : bestText;
  }

  function renderHistoryPanel(modeProgress, isClear) {
    const history = Array.isArray(modeProgress?.sessionHistory) ? modeProgress.sessionHistory.slice(0, 5) : [];
    if (!history.length) {
      els.resultHistoryMetricLabel.textContent = isClear ? "直近5回のクリアタイム" : "直近5回の到達問題数";
      els.resultHistoryBestLabel.textContent = "ベスト 記録なし";
      els.resultHistoryCopy.textContent = "前回比と自己ベストを軸に、直近の流れを短く確認できます。";
      els.resultHistoryList.innerHTML = `<div class="ranking-empty">まだ戦績データがありません。</div>`;
      return;
    }

    const bestEntry = isClear ? modeProgress?.bestClear : modeProgress?.bestGameOver;
    els.resultHistoryMetricLabel.textContent = isClear ? "直近5回のクリアタイム" : "直近5回の到達問題数";
    els.resultHistoryBestLabel.textContent = isClear
      ? `ベスト ${bestEntry ? formatTime(bestEntry.elapsedMs || 0) : "--:--"}`
      : `ベスト ${bestEntry ? `${bestEntry.reachedQuestions || 0}問` : "--"}`
    ;
    els.resultHistoryCopy.textContent = isClear
      ? "右に行くほど新しい記録です。短いほど速く、更新に近づいています。"
      : "右に行くほど新しい記録です。到達問題数が増えるほど、より奥まで進めています。";
    els.resultHistoryList.innerHTML = history
      .slice()
      .reverse()
      .map((entry, index, arr) => {
        const value = isClear ? (entry.elapsedMs || 0) : (entry.reachedQuestions || 0);
        const latest = index === arr.length - 1;
        const isBest = bestEntry && entry.playedAt === bestEntry.playedAt;
        const valueLabel = isClear ? formatTime(value) : `${value}問`;
        const meta = isClear ? formatSeconds(entry.averageTimeMs || 0) : `平均 ${formatSeconds(entry.averageTimeMs || 0)}`;
        return `
          <div class="history-summary-chip${latest ? " is-latest" : ""}${isBest ? " is-best" : ""}">
            <span class="history-summary-label">#${index + 1}${latest ? " 最新" : ""}</span>
            <strong class="history-summary-value">${valueLabel}</strong>
            <span class="history-summary-meta">${meta}</span>
          </div>
        `;
      })
      .join("");
  }

  function renderEndOverlay(state) {
    const { result, summary, datasetProgress, isClear } = state;
    if (isClear) {
      lastFailureHighlight = null;
    } else {
      highlightFailureTarget();
    }
    if (els.endModeLabel) {
      const resultModeLabel = buildModeRuleLabel(result.mode, result.rule);
      els.endModeLabel.textContent = currentPracticeLabel
        ? `${resultModeLabel} / ${currentPracticeLabel}`
        : resultModeLabel;
    }
    if (els.endCard) {
      els.endCard.classList.toggle("is-clear", isClear);
      els.endCard.classList.toggle("is-game-over", !isClear);
    }
    els.endTitle.textContent = isClear ? "Clear" : "Game Over";
    els.endSummary.textContent = isClear
      ? `問題数 ${summary.totalQuestions} を走破しました。累積 ${datasetProgress?.sessions || 0} 回目の記録を保存しています。`
      : `到達問題数 ${summary.reachedQuestions} で終了。最後のミス地点を地図上で確認できます。`;
    els.endPrimaryLabel.textContent = isClear ? "問題数" : "到達問題数";
    els.endPrimaryValue.textContent = `${isClear ? summary.totalQuestions : summary.reachedQuestions}`;
    els.endFirstTryValue.textContent = `${summary.firstTryCount}`;
    els.endMistakesValue.textContent = `${summary.mistakes}`;
    els.endAverageValue.textContent = formatSeconds(summary.averageTimeMs);
    els.endTimeLabel.textContent = isClear ? "クリアタイム" : "経過時間";
    els.endTimeValue.textContent = formatTime(result.elapsedMs);
    showEndOverlay();
  }

  function highlightFailureTarget() {
    if (!renderer || !lastFailureHighlight) return;
    if (lastFailureHighlight.kind === "areaCode") {
      renderer.highlightFailureAreaCode(lastFailureHighlight.value);
      return;
    }
    renderer.highlightFailureFeature(lastFailureHighlight.value);
  }

  function shareResultToX() {
    if (!completedResultState) return;
    const shareText = buildShareText(completedResultState);
    const url = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function buildShareText(state) {
    const { result, summary, isClear } = state;
    const totalQuestions = summary?.totalQuestions ?? result?.totalQuestions ?? 0;
    const reachedQuestions = summary?.reachedQuestions ?? result?.reachedQuestions ?? totalQuestions;
    const firstTryCount = summary?.firstTryCount ?? countFirstTryAnswers(result);
    const mistakes = summary?.mistakes ?? result?.mistakes ?? 0;
    const averageTimeMs = summary?.averageTimeMs ?? 0;
    const lines = [
      `GeoQuiz ${dataset.prefecture.name} ${buildModeRuleLabel(result.mode, result.rule)} ${isClear ? "Clear" : "Game Over"}`
    ];
    if (isClear) {
      lines.push(
        `問題数 ${totalQuestions} / 一発正解 ${firstTryCount} / ミス ${mistakes} / 平均回答 ${formatSeconds(averageTimeMs)} / クリアタイム ${formatTime(result.elapsedMs)}`
      );
    } else {
      lines.push(
        `到達問題数 ${reachedQuestions} / 一発正解 ${firstTryCount} / ミス ${mistakes} / 平均回答 ${formatSeconds(averageTimeMs)}`
      );
    }
    lines.push(`#GeoQuiz #${dataset.prefecture.name}`);
    return lines.join("\n");
  }

  function countFirstTryAnswers(result) {
    if (!result || !Array.isArray(result.stats)) return 0;
    if (Array.isArray(result.questionStats) && result.questionStats.length) {
      return result.questionStats.filter((item) => item.correct && item.mistakes === 0).length;
    }
    return result.stats.filter((item) => item.correct && item.mistakes === 0).length;
  }

  function updateRankingTabs() {
    els.rankingTabs.forEach((button) => {
      const active = button.dataset.rankingType === currentRankingType;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", active ? "true" : "false");
    });
    els.rankingTitle.textContent = rankingTitle(currentRankingType);
  }

  // ── グローバルランキング UI ────────────────────────────────────────
  function setupGlobalRankingUI(result, summary, isClear) {
    const hasFirebase = typeof window.submitRankingScore === "function"
      && typeof window.fetchRankingScores === "function";
    const isEasy = result.rule === "easy";
    const showSubmit = !isEasy && isClear && hasFirebase;

    // 表示/非表示切り替え
    if (els.globalRankingSubmit) els.globalRankingSubmit.style.display = showSubmit ? "" : "none";
    if (els.rankingViewBtn)      els.rankingViewBtn.style.display      = hasFirebase ? "" : "none";
    if (!hasFirebase) return;

    const timeSeconds = Math.round(result.elapsedMs / 100) / 10;
    const misses      = summary.mistakes;
    const mapVisible  = !!currentSessionSettings.tileLayerVisible;
    const modeKey     = result.rule === "sudden_death" ? "sudden_death" : "normal";
    const quizMode    = result.mode || "municipality";

    if (showSubmit) {
      // フィールド更新
      if (els.rankingTimeDisplay)     els.rankingTimeDisplay.textContent     = formatTime(result.elapsedMs);
      if (els.rankingMissesDisplay)   els.rankingMissesDisplay.textContent   = misses;
      if (els.rankingMapVisibleDisplay) els.rankingMapVisibleDisplay.textContent = mapVisible ? "あり" : "なし";

      // 前回の名前を復元
      const savedName = localStorage.getItem("geoquiz:playerName") || "";
      if (els.rankingNameInput) els.rankingNameInput.value = savedName;

      // ボタン状態リセット
      if (els.rankingSubmitBtn) { els.rankingSubmitBtn.style.display = ""; els.rankingSubmitBtn.disabled = false; els.rankingSubmitBtn.textContent = "登録する"; }
      if (els.rankingSubmitMsg) els.rankingSubmitMsg.style.display = "none";

      // 登録ボタン
      if (els.rankingSubmitBtn) {
        els.rankingSubmitBtn.onclick = async () => {
          const rawName = (els.rankingNameInput?.value || "").trim();
          const name = rawName || "匿名";
          localStorage.setItem("geoquiz:playerName", rawName);
          els.rankingSubmitBtn.disabled = true;
          els.rankingSubmitBtn.textContent = "送信中…";
          const res = await window.submitRankingScore(appConfig.id, {
            name, time: timeSeconds, misses, mode: modeKey, quizMode, mapVisible, datasetId: appConfig.id
          });
          if (res.success) {
            els.rankingSubmitBtn.style.display = "none";
            if (els.rankingSubmitMsg) els.rankingSubmitMsg.style.display = "";
          } else {
            els.rankingSubmitBtn.disabled = false;
            els.rankingSubmitBtn.textContent = "登録する";
          }
        };
      }
    }

    // ランキングを見るボタン
    if (els.rankingViewBtn) {
      let currentMapFilter  = mapVisible;
      let currentQuizMode   = quizMode;

      els.rankingViewBtn.onclick = async () => {
        if (!els.globalRankingModal) return;
        // 地図タブの初期状態を現在の設定に合わせる
        if (els.globalRankingTabs) {
          els.globalRankingTabs.forEach(t => {
            t.classList.toggle("is-active", t.dataset.map === String(currentMapFilter));
          });
        }
        // クイズモードタブの初期状態を現在のモードに合わせる
        if (els.globalRankingQuizTabs) {
          els.globalRankingQuizTabs.forEach(t => {
            t.classList.toggle("is-active", t.dataset.quizMode === currentQuizMode);
          });
        }
        els.globalRankingModal.style.display = "";
        await loadGlobalRankingList(modeKey, currentQuizMode, currentMapFilter);
      };

      // 地図タブ切り替え
      if (els.globalRankingTabs) {
        els.globalRankingTabs.forEach(tab => {
          tab.onclick = async () => {
            els.globalRankingTabs.forEach(t => t.classList.remove("is-active"));
            tab.classList.add("is-active");
            currentMapFilter = tab.dataset.map === "true";
            await loadGlobalRankingList(modeKey, currentQuizMode, currentMapFilter);
          };
        });
      }

      // クイズモードタブ切り替え
      if (els.globalRankingQuizTabs) {
        els.globalRankingQuizTabs.forEach(tab => {
          tab.onclick = async () => {
            els.globalRankingQuizTabs.forEach(t => t.classList.remove("is-active"));
            tab.classList.add("is-active");
            currentQuizMode = tab.dataset.quizMode;
            await loadGlobalRankingList(modeKey, currentQuizMode, currentMapFilter);
          };
        });
      }

      // モーダルを閉じる
      if (els.globalRankingModalClose) {
        els.globalRankingModalClose.onclick = () => {
          if (els.globalRankingModal) els.globalRankingModal.style.display = "none";
        };
      }
      if (els.globalRankingModal) {
        els.globalRankingModal.onclick = (e) => {
          if (e.target === els.globalRankingModal) els.globalRankingModal.style.display = "none";
        };
      }
    }
  }

  async function loadGlobalRankingList(mode, quizMode, mapVisible) {
    if (!els.globalRankingList) return;
    els.globalRankingList.innerHTML = '<div class="global-ranking-loading">読み込み中…</div>';
    const scores = await window.fetchRankingScores(appConfig.id, mode, quizMode, mapVisible, 10);
    const myId   = typeof window.getClientId === "function" ? window.getClientId() : null;

    if (!scores.length) {
      els.globalRankingList.innerHTML = '<div class="global-ranking-empty">まだ記録がありません</div>';
      return;
    }
    els.globalRankingList.innerHTML = scores.map(s => {
      const isMe   = myId && s.clientId === myId;
      const tStr   = formatRankingTime(s.time);
      const name   = escapeGRHtml(s.name || "匿名");
      return `<div class="global-ranking-item${isMe ? " is-mine" : ""}">
        <span class="global-ranking-rank">${s.rank}位</span>
        <span class="global-ranking-name">${name}</span>
        <span class="global-ranking-time">${tStr}</span>
        <span class="global-ranking-misses">ミス${s.misses ?? 0}</span>
      </div>`;
    }).join("");
  }

  function formatRankingTime(seconds) {
    const s   = typeof seconds === "number" ? seconds : 0;
    const m   = Math.floor(s / 60);
    const rem = (s % 60).toFixed(1).padStart(4, "0");
    return `${m}:${rem}`;
  }

  function escapeGRHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }
  // ─────────────────────────────────────────────────────────────────

  function renderRanking(datasetProgress) {
    const practiceRanking = window.ProgressStore.buildRanking(datasetProgress, currentRankingType, 10, currentMode);
    const ranking = practiceRanking.slice(0, 5);
    currentRankingPracticeItems = practiceRanking;
    currentRankingItems = ranking;
    updatePracticeButtonLabels();
    updatePracticeButtons(datasetProgress);
    if (!ranking.length) {
      els.weakRankingList.innerHTML = `<li class="ranking-empty">累積データがまだありません。</li>`;
      return;
    }

    els.weakRankingList.innerHTML = ranking.map((item, index) => {
      return `
        <li class="ranking-item">
          <span class="ranking-rank">${index + 1}</span>
          <span class="ranking-main">
            <span class="ranking-name">${escapeHtml(item.name)}</span>
          </span>
          <span class="ranking-meta">${rankingMeta(item)}</span>
        </li>
      `;
    }).join("");
  }

  function startPracticeFromRanking() {
    if (!currentRankingPracticeItems.length) return;
    const questionIds = practiceQuestionIds(currentRankingPracticeItems, currentMode);
    if (!questionIds.length) return;
    start(currentMode, {
      questionIds,
      practiceLabel: rankingPracticeLabel(currentRankingType)
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
    const items = window.ProgressStore.buildRanking(currentDatasetProgress, "accuracy", 5, currentMode);
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
    els.practiceWeakButton.disabled = !currentRankingPracticeItems.length;
    els.practiceLastMistakeButton.disabled = !window.ProgressStore.buildLastMistakeItems(datasetProgress, 5).length;
    els.practiceUnansweredButton.disabled = !window.ProgressStore.buildUnansweredItems(datasetProgress, 5).length;
    els.practiceRecentMistakeButton.disabled = !window.ProgressStore.buildRecentMistakeItems(datasetProgress, 5).length;
    els.practiceLowAccuracyButton.disabled = !window.ProgressStore.buildRanking(datasetProgress, "accuracy", 5, currentMode).length;
  }

  function updatePracticeButtonLabels() {
    if (!els.practiceWeakButton) return;
    els.practiceWeakButton.textContent = rankingPracticeLabel(currentRankingType);
  }

  function practiceQuestionIds(ranking, mode) {
    if (mode === "ma") {
      return [...new Set(ranking
        .map((item) => item.area_code)
        .filter(Boolean)
        .map((areaCode) => `area_code:${areaCode}`))];
    }
    return ranking.map((item) => item.id).filter(Boolean);
  }

  function rankingTitle(type) {
    if (type === "accuracy") return "正答率ランキング";
    if (type === "time") return "平均時間ランキング";
    return "苦手ランキング";
  }

  function rankingPracticeLabel(type) {
    if (type === "accuracy") return "低正答率上位10件を再出題";
    if (type === "time") return "平均時間上位10件を再出題";
    return "苦手上位10件を再出題";
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
    const ruleLabel = ruleName(engine.rule || currentSessionSettings.rule);
    els.modeLabel.textContent = currentPracticeLabel
      ? `${modeName(currentMode)} / ${ruleLabel} / ${currentPracticeLabel}`
      : `${modeName(currentMode)} / ${ruleLabel}`;
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

  function speakAnswer(featureProperties) {
    if (!els.mistakeSpeechToggle.checked || !("speechSynthesis" in window)) return;
    const label = currentMode === "ma"
      ? pronounceAreaCode(featureProperties.area_code)
      : pronouncePlaceName(featureProperties.name);
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

  function pronouncePlaceName(name) {
    const raw = String(name || "");
    return speechReadings[raw] || raw;
  }

  function ruleName(rule) {
    if (rule === "easy") return "イージー";
    if (rule === "sudden_death") return "サドンデス";
    return "ノーマル";
  }

  function buildModeRuleLabel(mode, rule) {
    return `${modeName(mode)} / ${ruleName(rule)}`;
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
      if (els.referencePreviewTop) els.referencePreviewTop.innerHTML = "";
      return;
    }

    const feature = referenceFeatureForQuestion(question);
    const previewHtml = feature ? renderReferenceSvg(feature) : "";
    els.referencePreview.innerHTML = previewHtml;
    if (els.referencePreviewTop) els.referencePreviewTop.innerHTML = previewHtml;
  }

  function referenceFeatureForQuestion(question) {
    if (currentMode === "ma") {
      const features = renderer ? renderer.getMaCollections("area_code") : (areaReferenceFeatures || (areaReferenceFeatures = window.MaUnion.buildMaCollections(dataset, "area_code")));
      return features.find((feature) => feature.properties.area_code === question.area_code);
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
    if (els.regionSelector) els.regionSelector.textContent = `${appConfig.name} ▾`;
    if (els.map) els.map.setAttribute("aria-label", `${appConfig.name}クイズ地図`);
    applyDatasetModeDescriptions();
  }

  function renderRegionMenu() {
    if (!els.regionMenu) return;
    const catalog = window.GEOQUIZ_DATASETS || [];
    els.regionMenu.innerHTML = catalog.map((item) => {
      const active = item.id === appConfig.id;
      const meta = [
        item.shortName || item.name,
        item.enabledModes?.includes("ma") ? "市区町村 + 市外局番" : "市区町村"
      ].join(" · ");
      return `<button class="region-menu-item${active ? " is-active" : ""}" type="button" role="menuitem" data-dataset-id="${escapeHtml(item.id)}">
        <span class="region-menu-name">${escapeHtml(item.name)}</span>
        <span class="region-menu-meta">${escapeHtml(meta)}</span>
      </button>`;
    }).join("");
  }

  function toggleRegionMenu() {
    if (!els.regionMenu || !els.regionSelector) return;
    const opening = els.regionMenu.classList.contains("is-hidden");
    if (opening) {
      els.regionMenu.classList.remove("is-hidden");
      els.regionSelector.setAttribute("aria-expanded", "true");
      return;
    }
    closeRegionMenu();
  }

  function closeRegionMenu() {
    if (!els.regionMenu || !els.regionSelector) return;
    els.regionMenu.classList.add("is-hidden");
    els.regionSelector.setAttribute("aria-expanded", "false");
  }

  function navigateToDataset(datasetId) {
    if (!datasetId || datasetId === appConfig.id) {
      closeRegionMenu();
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("dataset", datasetId);
    url.searchParams.delete("id");
    window.location.href = url.toString();
  }

  function applyDatasetModeDescriptions() {
    const municipalityButton = document.querySelector('[data-start-mode="municipality"] .mode-card-desc');
    const areaCodeButton = document.querySelector('[data-start-mode="ma"] .mode-card-desc');
    const confirmButton = document.querySelector('[data-start-mode="confirm"] .mode-card-desc');
    const confirmAreaCodeButton = document.querySelector('[data-start-mode="confirm_ma"] .mode-card-desc');
    const areaCodeCount = new Set(dataset.municipalities.map((item) => item.area_code).filter(Boolean)).size;
    if (municipalityButton) {
      municipalityButton.textContent = `市町村名から場所を当てる · ${dataset.municipalities.length}問`;
    }
    if (areaCodeButton) {
      areaCodeButton.textContent = `番号からエリアを当てる · ${areaCodeCount}問`;
    }
    if (confirmButton) {
      confirmButton.textContent = `全${dataset.municipalities.length}市区町村を表示して確認`;
    }
    if (confirmAreaCodeButton) {
      confirmAreaCodeButton.textContent = `全${areaCodeCount}市外局番エリアを表示して確認`;
    }
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
      labelOverrides: window[config.labelOverridesGlobal] || {},
      speechReadings: window[config.speechReadingsGlobal] || {}
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

  function resolveInitialLayout() {
    try {
      return window.localStorage.getItem("geoquiz:layout") || "left";
    } catch {
      return "left";
    }
  }

  function resolveInitialTileLayerVisibility() {
    try {
      return window.localStorage.getItem("geoquiz:tilelayer") === "1";
    } catch {
      return false;
    }
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

  function formatSeconds(ms) {
    return `${(ms / 1000).toFixed(1)}秒`;
  }

  function formatSignedSeconds(ms) {
    const sign = ms < 0 ? "-" : "+";
    return `${sign}${(Math.abs(ms) / 1000).toFixed(1)}秒`;
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
