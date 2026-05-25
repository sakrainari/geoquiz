(function () {
  const STORAGE_KEY = "geoquiz:progress:v1";
  const STORAGE_VERSION = 1;
  let recoveryNotice = null;

  function loadProgress() {
    if (!canUseStorage()) return emptyProgress();

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyProgress();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.version !== STORAGE_VERSION || typeof parsed !== "object") {
        return emptyProgress();
      }
      return normalizeProgress(parsed);
    } catch (error) {
      recoveryNotice = "累積成績データが壊れていたため、保存データを初期化しました。";
      console.warn("GeoQuiz progress data was reset because it could not be read.", error);
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore storage cleanup failures. The app can continue with session-only data.
      }
      return emptyProgress();
    }
  }

  function saveSession(datasetId, dataset, result) {
    const progress = loadProgress();
    const now = new Date().toISOString();
    const datasetProgress = ensureDataset(progress, datasetId, dataset, now);
    const modeProgress = ensureMode(datasetProgress, result.mode);
    const summary = buildModeSessionSummary(result, now);

    datasetProgress.updatedAt = now;
    datasetProgress.sessions += 1;
    modeProgress.plays += 1;
    if (result.correct >= result.totalQuestions) modeProgress.completed += 1;
    modeProgress.mistakes += result.mistakes;
    modeProgress.totalQuestions += result.totalQuestions;
    modeProgress.totalAnswerMs += totalAnswerMs(result);
    modeProgress.lastResult = summary;
    if (!Array.isArray(modeProgress.sessionHistory)) modeProgress.sessionHistory = [];
    modeProgress.sessionHistory.unshift(summary);
    if (modeProgress.sessionHistory.length > 5) modeProgress.sessionHistory.length = 5;
    if (summary.completed) {
      if (!modeProgress.bestClear || isBetterClear(summary, modeProgress.bestClear)) {
        modeProgress.bestClear = summary;
      }
    } else if (!modeProgress.bestGameOver || isBetterGameOver(summary, modeProgress.bestGameOver)) {
      modeProgress.bestGameOver = summary;
    }
    datasetProgress.lastSession = {
      mode: result.mode,
      playedAt: now,
      mistakeIds: result.stats
        .filter((item) => (item.mistakes || 0) > 0)
        .map((item) => item.id),
      unansweredIds: result.stats
        .filter((item) => !item.correct)
        .map((item) => item.id),
      unansweredItems: result.stats
        .filter((item) => !item.correct)
        .map(toSessionItem)
    };

    result.stats.forEach((item) => {
      if (!isTouched(item)) return;
      const stat = ensureStat(datasetProgress, item);
      const modeStat = ensureStatMode(stat, result.mode);
      const wasCorrect = Boolean(item.correct);

      stat.plays += 1;
      stat.correct += wasCorrect ? 1 : 0;
      stat.mistakes += item.mistakes || 0;
      stat.lastPlayedAt = now;
      if ((item.mistakes || 0) > 0) stat.lastMistakeAt = now;
      stat.totalAnswerMs += item.answerTimeMs || 0;

      modeStat.plays += 1;
      modeStat.correct += wasCorrect ? 1 : 0;
      modeStat.mistakes += item.mistakes || 0;
      modeStat.totalAnswerMs += item.answerTimeMs || 0;

      // 直近5回の結果（1=1発正解, 0=ミスあり）をモード別に保持
      if (wasCorrect) {
        if (!modeStat.recentResults) modeStat.recentResults = [];
        modeStat.recentResults.unshift((item.mistakes || 0) === 0 ? 1 : 0);
        if (modeStat.recentResults.length > 5) modeStat.recentResults.length = 5;
      }
    });

    return persist(progress);
  }

  function getDatasetProgress(datasetId) {
    return loadProgress().datasets[datasetId] || null;
  }

  function getModeProgress(datasetProgress, mode) {
    if (!datasetProgress || !datasetProgress.modes) return null;
    return datasetProgress.modes[mode] || null;
  }

  function buildWeakRanking(datasetProgress, limit = 5, mode = "municipality") {
    return buildRanking(datasetProgress, "weak", limit, mode);
  }

  function buildLastMistakeItems(datasetProgress, limit = 5) {
    if (!datasetProgress || !datasetProgress.lastSession || !datasetProgress.stats) return [];
    const ids = datasetProgress.lastSession.mistakeIds || [];
    return ids
      .map((id) => datasetProgress.stats[id])
      .filter(Boolean)
      .map(toRankingItem)
      .sort((a, b) => b.mistakes - a.mistakes || a.name.localeCompare(b.name, "ja"))
      .slice(0, limit);
  }

  function buildUnansweredItems(datasetProgress, limit = 5) {
    if (!datasetProgress || !datasetProgress.lastSession) return [];
    const items = datasetProgress.lastSession.unansweredItems || [];
    return items
      .map((item) => datasetProgress.stats?.[item.id] ? toRankingItem(datasetProgress.stats[item.id]) : normalizeSessionItem(item))
      .slice(0, limit);
  }

  function buildRecentMistakeItems(datasetProgress, limit = 5) {
    if (!datasetProgress || !datasetProgress.stats) return [];
    return Object.values(datasetProgress.stats)
      .filter((stat) => stat.lastMistakeAt)
      .map(toRankingItem)
      .sort((a, b) => (
        String(b.lastMistakeAt).localeCompare(String(a.lastMistakeAt))
        || b.mistakes - a.mistakes
        || a.name.localeCompare(b.name, "ja")
      ))
      .slice(0, limit);
  }

  function buildRanking(datasetProgress, type = "weak", limit = 5, mode = "municipality") {
    if (!datasetProgress || !datasetProgress.stats) return [];
    const items = mode === "ma"
      ? buildAreaModeRanking(datasetProgress, mode)
      : Object.values(datasetProgress.stats)
        .map((stat) => toRankingItem(stat, mode))
        .filter((stat) => stat.plays > 0);
    items.sort((a, b) => compareRanking(a, b, type));
    return items.slice(0, limit);
  }

  function toRankingItem(stat, mode = "municipality") {
    const modeStat = mode && stat.modes && stat.modes[mode] ? stat.modes[mode] : stat;
    const plays = modeStat?.plays || 0;
    const correct = modeStat?.correct || 0;
    const mistakes = modeStat?.mistakes || 0;
    const averageTimeMs = correct > 0 ? Math.round((modeStat?.totalAnswerMs || 0) / correct) : 0;
    const accuracy = plays > 0 ? Math.round((correct / plays) * 100) : 0;
    return {
      id: stat.id,
      name: stat.name,
      area_code: stat.area_code,
      ma_name: stat.ma_name,
      plays,
      correct,
      mistakes,
      accuracy,
      averageTimeMs,
      lastMistakeAt: stat.lastMistakeAt
    };
  }

  function buildAreaModeRanking(datasetProgress, mode) {
    const grouped = new Map();
    Object.values(datasetProgress.stats).forEach((stat) => {
      const modeStat = stat.modes && stat.modes[mode];
      if (!modeStat || !modeStat.plays) return;
      const key = `area_code:${stat.area_code}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: stat.area_code,
          area_code: stat.area_code,
          ma_name: stat.ma_name,
          plays: 0,
          correct: 0,
          mistakes: 0,
          accuracy: 0,
          averageTimeMs: 0,
          totalAnswerMs: 0,
          lastMistakeAt: null
        });
      }
      const entry = grouped.get(key);
      entry.plays += modeStat.plays || 0;
      entry.correct += modeStat.correct || 0;
      entry.mistakes += modeStat.mistakes || 0;
      entry.totalAnswerMs += modeStat.totalAnswerMs || 0;
      if (stat.lastMistakeAt && (!entry.lastMistakeAt || String(stat.lastMistakeAt).localeCompare(String(entry.lastMistakeAt)) > 0)) {
        entry.lastMistakeAt = stat.lastMistakeAt;
      }
    });

    return [...grouped.values()].map((entry) => ({
      ...entry,
      averageTimeMs: entry.correct > 0 ? Math.round(entry.totalAnswerMs / entry.correct) : 0,
      accuracy: entry.plays > 0 ? Math.round((entry.correct / entry.plays) * 100) : 0
    }));
  }

  function toSessionItem(item) {
    return {
      id: item.id,
      name: item.name,
      area_code: item.area_code,
      ma_name: item.ma_name,
      tags: item.tags || []
    };
  }

  function normalizeSessionItem(item) {
    return {
      ...item,
      plays: 0,
      correct: 0,
      mistakes: 0,
      accuracy: 0,
      averageTimeMs: 0,
      lastMistakeAt: null
    };
  }

  function exportProgress() {
    return loadProgress();
  }

  function importProgress(payload) {
    const progress = typeof payload === "string" ? JSON.parse(payload) : payload;
    if (!progress || progress.version !== STORAGE_VERSION || typeof progress.datasets !== "object") {
      throw new Error("Unsupported progress data.");
    }
    return persist(normalizeProgress(progress));
  }

  function compareRanking(a, b, type) {
    if (type === "accuracy") {
      return a.accuracy - b.accuracy
        || b.mistakes - a.mistakes
        || b.averageTimeMs - a.averageTimeMs
        || a.name.localeCompare(b.name, "ja");
    }
    if (type === "time") {
      return b.averageTimeMs - a.averageTimeMs
        || b.mistakes - a.mistakes
        || a.accuracy - b.accuracy
        || a.name.localeCompare(b.name, "ja");
    }
    return b.mistakes - a.mistakes
      || a.accuracy - b.accuracy
      || b.averageTimeMs - a.averageTimeMs
      || a.name.localeCompare(b.name, "ja");
  }

  function resetProgress() {
    if (!canUseStorage()) return { ok: false, progress: emptyProgress(), error: "localStorage unavailable" };
    window.localStorage.removeItem(STORAGE_KEY);
    return { ok: true, progress: emptyProgress() };
  }

  function consumeRecoveryNotice() {
    const notice = recoveryNotice;
    recoveryNotice = null;
    return notice;
  }

  function persist(progress) {
    if (!canUseStorage()) return { ok: false, progress, error: "localStorage unavailable" };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
      return { ok: true, progress };
    } catch (error) {
      console.warn("GeoQuiz progress data could not be saved.", error);
      return { ok: false, progress, error: error.message };
    }
  }

  function emptyProgress() {
    return {
      app: "Japan Area Code Map Quiz",
      version: STORAGE_VERSION,
      datasets: {}
    };
  }

  function normalizeProgress(progress) {
    return {
      app: progress.app || "Japan Area Code Map Quiz",
      version: STORAGE_VERSION,
      datasets: progress.datasets && typeof progress.datasets === "object" ? progress.datasets : {}
    };
  }

  function ensureDataset(progress, datasetId, dataset, now) {
    if (!progress.datasets[datasetId]) {
      progress.datasets[datasetId] = {
        datasetId,
        version: STORAGE_VERSION,
        name: dataset.prefecture?.name || dataset.name || datasetId,
        createdAt: now,
        updatedAt: now,
        sessions: 0,
        modes: {},
        stats: {}
      };
    }
    return progress.datasets[datasetId];
  }

  function ensureMode(datasetProgress, mode) {
    if (!datasetProgress.modes[mode]) {
      datasetProgress.modes[mode] = {
        plays: 0,
        completed: 0,
        mistakes: 0,
        totalQuestions: 0,
        totalAnswerMs: 0,
        sessionHistory: [],
        lastResult: null,
        bestClear: null,
        bestGameOver: null
      };
    }
    return datasetProgress.modes[mode];
  }

  function buildModeSessionSummary(result, playedAt) {
    const answered = answeredQuestionStats(result);
    const firstTryCount = answered.filter((item) => item.mistakes === 0).length;
    const averageTimeMs = answered.length
      ? Math.round(answered.reduce((sum, item) => sum + item.answerTimeMs, 0) / answered.length)
      : 0;
    return {
      playedAt,
      mode: result.mode,
      completed: result.correct >= result.totalQuestions,
      totalQuestions: result.totalQuestions,
      reachedQuestions: result.reachedQuestions || result.totalQuestions,
      correct: result.correct,
      firstTryCount,
      mistakes: result.mistakes,
      averageTimeMs,
      elapsedMs: result.elapsedMs
    };
  }

  function isBetterClear(next, current) {
    if ((next.elapsedMs || 0) !== (current.elapsedMs || 0)) {
      return (next.elapsedMs || 0) < (current.elapsedMs || 0);
    }
    if ((next.averageTimeMs || 0) !== (current.averageTimeMs || 0)) {
      return (next.averageTimeMs || 0) < (current.averageTimeMs || 0);
    }
    return (next.mistakes || 0) < (current.mistakes || 0);
  }

  function isBetterGameOver(next, current) {
    if ((next.reachedQuestions || 0) !== (current.reachedQuestions || 0)) {
      return (next.reachedQuestions || 0) > (current.reachedQuestions || 0);
    }
    if ((next.averageTimeMs || 0) !== (current.averageTimeMs || 0)) {
      return (next.averageTimeMs || 0) < (current.averageTimeMs || 0);
    }
    return (next.mistakes || 0) < (current.mistakes || 0);
  }

  function ensureStat(datasetProgress, item) {
    if (!datasetProgress.stats[item.id]) {
      datasetProgress.stats[item.id] = {
        id: item.id,
        name: item.name,
        area_code: item.area_code,
        ma_name: item.ma_name,
        tags: item.tags || [],
        plays: 0,
        correct: 0,
        mistakes: 0,
        lastPlayedAt: null,
        lastMistakeAt: null,
        totalAnswerMs: 0,
        modes: {}
      };
    }
    return datasetProgress.stats[item.id];
  }

  function ensureStatMode(stat, mode) {
    if (!stat.modes[mode]) {
      stat.modes[mode] = {
        plays: 0,
        correct: 0,
        mistakes: 0,
        totalAnswerMs: 0
      };
    }
    return stat.modes[mode];
  }

  function answeredQuestionStats(result) {
    if (Array.isArray(result.questionStats) && result.questionStats.length) {
      return result.questionStats.filter((item) => item.correct && item.answerTimeMs > 0);
    }
    return result.stats.filter((item) => item.correct && item.answerTimeMs > 0);
  }

  function totalAnswerMs(result) {
    return answeredQuestionStats(result).reduce((sum, item) => sum + (item.answerTimeMs || 0), 0);
  }

  function isTouched(item) {
    return Boolean(item.correct) || (item.mistakes || 0) > 0 || (item.answerTimeMs || 0) > 0;
  }

  function canUseStorage() {
    try {
      return Boolean(window.localStorage);
    } catch {
      return false;
    }
  }

  window.ProgressStore = {
    key: STORAGE_KEY,
    loadProgress,
    saveSession,
    getDatasetProgress,
    getModeProgress,
    exportProgress,
    importProgress,
    consumeRecoveryNotice,
    buildRanking,
    buildWeakRanking,
    buildLastMistakeItems,
    buildUnansweredItems,
    buildRecentMistakeItems,
    resetProgress
  };
})();
