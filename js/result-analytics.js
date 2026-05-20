(function () {
  function summarize(result) {
    const answered = result.stats.filter((item) => item.correct && item.answerTimeMs > 0);
    const averageTimeMs = answered.length
      ? Math.round(answered.reduce((sum, item) => sum + item.answerTimeMs, 0) / answered.length)
      : 0;
    return {
      totalQuestions: result.totalQuestions,
      correct: result.correct,
      mistakes: result.mistakes,
      averageTimeMs
    };
  }

  function buildWeakPointExport(result, prefecture) {
    const summary = summarize(result);
    return {
      app: "Japan Area Code Map Quiz",
      version: "0.1.0",
      mode: result.mode,
      prefecture: prefecture.name,
      playedAt: new Date().toISOString(),
      summary,
      weakPoints: result.stats
        .filter((item) => item.mistakes > 0 || !item.correct)
        .sort((a, b) => b.mistakes - a.mistakes || a.name.localeCompare(b.name, "ja"))
        .map((item) => ({
          id: item.id,
          name: item.name,
          area_code: item.area_code,
          ma_name: item.ma_name,
          mistakes: item.mistakes,
          answerTimeMs: item.answerTimeMs,
          tags: item.tags
        }))
    };
  }

  function downloadJson(payload, prefix = "geoquiz-weakpoints") {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  window.ResultAnalytics = { summarize, buildWeakPointExport, downloadJson };
})();
