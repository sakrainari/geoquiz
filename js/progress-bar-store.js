/**
 * progress-bar-store.js
 *
 * TOP画面カードの進捗バー・ミニマップ色分け用ストア。
 * 保存キー: geoquiz:progress-bar:v1
 * 既存の geoquiz:progress:v1 (ProgressStore) とは独立した別キー。
 *
 * データ構造:
 * {
 *   "regions": {
 *     "<datasetId>": {
 *       "easy":         { "plays": N, "first_try_correct": N },
 *       "normal":       { "plays": N, "first_try_correct": N },
 *       "sudden_death": { "plays": N, "clears": N, "best_streak": N }
 *     }
 *   }
 * }
 */
(function () {
  var STORAGE_KEY = "geoquiz:progress-bar:v1";

  /* ── ランク定義 ── */
  var RANKS = {
    platinum : { label: "Platinum", color: "#6677bb" },
    gold     : { label: "Gold",     color: "#c8a800" },
    bronze   : { label: "Bronze",   color: "#cd8500" },
  };

  /* 未達成・未プレイ時のグレー */
  var COLOR_NONE = "#2a3a4a";

  /* ── ストレージ操作 ── */
  function load() {
    try {
      var raw = window.localStorage && window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return { regions: {} };
      var parsed = JSON.parse(raw);
      return (parsed && typeof parsed.regions === "object") ? parsed : { regions: {} };
    } catch (e) {
      return { regions: {} };
    }
  }

  function save(data) {
    try {
      if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* quota over 等は無視 */ }
  }

  /* ── データセット単位の読み書き ── */
  function getRegion(datasetId) {
    return load().regions[datasetId] || {};
  }

  /**
   * ゲーム終了後に呼ぶ。
   * mode: "easy" | "normal" | "sudden_death"
   * stats: { firstTryCorrect, totalQuestions, cleared, streak }
   */
  function saveSession(datasetId, mode, stats) {
    var data = load();
    if (!data.regions[datasetId]) data.regions[datasetId] = {};
    var region = data.regions[datasetId];

    if (mode === "easy" || mode === "normal") {
      if (!region[mode]) region[mode] = { plays: 0, first_try_correct: 0 };
      region[mode].plays += 1;
      region[mode].first_try_correct += stats.firstTryCorrect || 0;

    } else if (mode === "sudden_death") {
      if (!region[mode]) region[mode] = { plays: 0, clears: 0, best_streak: 0 };
      region[mode].plays += 1;
      if (stats.cleared) region[mode].clears += 1;
      if ((stats.streak || 0) > region[mode].best_streak) {
        region[mode].best_streak = stats.streak;
      }
    }

    save(data);
  }

  /* ── ランク判定 ── */
  /**
   * regionData から最高ランクを返す。
   * @returns "platinum" | "gold" | "bronze" | null
   */
  function getRank(regionData) {
    if (!regionData) return null;
    var sd = regionData.sudden_death;
    if (sd && (sd.clears || 0) > 0) return "platinum";
    var n = regionData.normal;
    if (n && (n.first_try_correct || 0) > 0) return "gold";
    var e = regionData.easy;
    if (e && (e.first_try_correct || 0) > 0) return "bronze";
    return null;
  }

  /** ランクに対応する色を返す。null の場合は COLOR_NONE。 */
  function rankColor(rank) {
    return rank && RANKS[rank] ? RANKS[rank].color : COLOR_NONE;
  }

  window.ProgressBarStore = {
    STORAGE_KEY : STORAGE_KEY,
    RANKS       : RANKS,
    COLOR_NONE  : COLOR_NONE,
    load        : load,
    save        : save,
    getRegion   : getRegion,
    saveSession : saveSession,
    getRank     : getRank,
    rankColor   : rankColor,
  };
})();
