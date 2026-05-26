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
 *       "municipality": {
 *         "easy":         { "plays": N, "first_try_correct": N },
 *         "normal":       { "plays": N, "first_try_correct": N },
 *         "sudden_death": { "plays": N, "clears": N, "best_streak": N }
 *       },
 *       "ma": {
 *         "easy":         { "plays": N, "first_try_correct": N },
 *         "normal":       { "plays": N, "first_try_correct": N },
 *         "sudden_death": { "plays": N, "clears": N, "best_streak": N }
 *       }
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
  /**
   * datasetId に対応する進捗を返す。
   * 戻り値: { municipality: { easy, normal, sudden_death }, ma: { easy, normal, sudden_death } }
   * 旧フォーマット（flat な easy/normal/sudden_death）は自動的に municipality に移行する。
   */
  function getRegion(datasetId) {
    var stored = load().regions[datasetId];
    if (!stored) return { municipality: {}, ma: {} };

    /* 旧フォーマット（v1 移行前）の互換処理 */
    if (stored.easy !== undefined || stored.normal !== undefined || stored.sudden_death !== undefined) {
      return {
        municipality: {
          easy        : stored.easy         || {},
          normal      : stored.normal       || {},
          sudden_death: stored.sudden_death || {}
        },
        ma: {}
      };
    }

    return {
      municipality: stored.municipality || {},
      ma          : stored.ma           || {}
    };
  }

  /**
   * ゲーム終了後に呼ぶ。
   * quizType : "municipality" | "ma"
   * mode     : "easy" | "normal" | "sudden_death"
   * stats    : { firstTryCorrect, cleared, streak }
   */
  function saveSession(datasetId, quizType, mode, stats) {
    var data = load();
    if (!data.regions[datasetId]) data.regions[datasetId] = {};
    var region = data.regions[datasetId];
    if (!region[quizType]) region[quizType] = {};
    var qt = region[quizType];

    if (mode === "easy" || mode === "normal") {
      if (!qt[mode]) qt[mode] = { plays: 0, first_try_correct: 0 };
      qt[mode].plays += 1;
      qt[mode].first_try_correct += stats.firstTryCorrect || 0;

    } else if (mode === "sudden_death") {
      if (!qt[mode]) qt[mode] = { plays: 0, clears: 0, best_streak: 0 };
      qt[mode].plays += 1;
      if (stats.cleared) qt[mode].clears += 1;
      if ((stats.streak || 0) > qt[mode].best_streak) {
        qt[mode].best_streak = stats.streak;
      }
    }

    save(data);
  }

  /* ── ランク判定 ── */
  /**
   * quizType（"municipality" | "ma"）のランクを返す。
   * regionData は getRegion() の戻り値 { municipality, ma }。
   * @returns "platinum" | "gold" | "bronze" | null
   */
  function getRank(regionData, quizType) {
    var qt = quizType || "municipality";
    var rd = (regionData && regionData[qt]) ? regionData[qt] : (regionData || {});

    var sd = rd.sudden_death;
    if (sd && (sd.clears || 0) > 0) return "platinum";
    var n = rd.normal;
    if (n && (n.first_try_correct || 0) > 0) return "gold";
    var e = rd.easy;
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
