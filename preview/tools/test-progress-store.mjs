import { readFile } from "node:fs/promises";
import vm from "node:vm";

const storage = new Map();
const context = {
  console: {
    ...console,
    warn() {}
  },
  window: {
    localStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      },
      removeItem(key) {
        storage.delete(key);
      }
    }
  }
};
context.window.window = context.window;
context.globalThis = context.window;
vm.createContext(context);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const source = await readFile("js/progress-store.js", "utf8");
vm.runInContext(source, context, { filename: "js/progress-store.js" });

const dataset = {
  prefecture: { name: "埼玉県" }
};
const result = {
  mode: "municipality",
  totalQuestions: 2,
  correct: 2,
  mistakes: 1,
  stats: [
    {
      id: "saitama_a",
      name: "A市",
      area_code: "048",
      ma_name: "A MA",
      tags: ["test"],
      mistakes: 1,
      correct: true,
      answerTimeMs: 3200
    },
    {
      id: "saitama_b",
      name: "B市",
      area_code: "04",
      ma_name: "B MA",
      tags: [],
      mistakes: 0,
      correct: true,
      answerTimeMs: 1800
    },
    {
      id: "saitama_c",
      name: "C市",
      area_code: "049",
      ma_name: "C MA",
      tags: [],
      mistakes: 0,
      correct: false,
      answerTimeMs: 0
    }
  ]
};

const first = context.window.ProgressStore.saveSession("saitama", dataset, result);
assert(first.ok, "first progress save should succeed");
assert(first.progress.datasets.saitama.sessions === 1, "dataset sessions should increment");
assert(first.progress.datasets.saitama.modes.municipality.completed === 1, "completed count should increment");
assert(first.progress.datasets.saitama.stats.saitama_a.mistakes === 1, "mistakes should be recorded per stat");
assert(first.progress.datasets.saitama.stats.saitama_a.totalAnswerMs === 3200, "answer time should be recorded per stat");
assert(!first.progress.datasets.saitama.stats.saitama_c, "untouched stats should not be saved");
assert(first.progress.datasets.saitama.lastSession.mistakeIds.length === 1, "last session mistake ids should be recorded");
assert(first.progress.datasets.saitama.lastSession.mistakeIds[0] === "saitama_a", "last session mistake ids should include the missed stat");

const second = context.window.ProgressStore.saveSession("saitama", dataset, result);
assert(second.progress.datasets.saitama.sessions === 2, "dataset sessions should accumulate");
assert(second.progress.datasets.saitama.stats.saitama_a.plays === 2, "stat plays should accumulate");
assert(second.progress.datasets.saitama.stats.saitama_a.mistakes === 2, "stat mistakes should accumulate");
const ranking = context.window.ProgressStore.buildWeakRanking(second.progress.datasets.saitama, 2);
assert(ranking.length === 2, "weak ranking should include saved stats");
assert(ranking[0].id === "saitama_a", "weak ranking should sort by mistakes first");
assert(ranking[0].accuracy === 100, "weak ranking should include accuracy");
const accuracyRanking = context.window.ProgressStore.buildRanking(second.progress.datasets.saitama, "accuracy", 2);
assert(accuracyRanking[0].accuracy === 100, "accuracy ranking should include accuracy values");
const timeRanking = context.window.ProgressStore.buildRanking(second.progress.datasets.saitama, "time", 2);
assert(timeRanking[0].averageTimeMs >= timeRanking[1].averageTimeMs, "time ranking should sort by slow average first");
const lastMistakeItems = context.window.ProgressStore.buildLastMistakeItems(second.progress.datasets.saitama, 5);
assert(lastMistakeItems.length === 1, "last mistake practice items should include only the previous session misses");
assert(lastMistakeItems[0].id === "saitama_a", "last mistake practice items should include the missed id");
const unansweredItems = context.window.ProgressStore.buildUnansweredItems(second.progress.datasets.saitama, 5);
assert(unansweredItems.length === 1, "unanswered practice items should include previous session unanswered stats");
assert(unansweredItems[0].id === "saitama_c", "unanswered practice items should include the unanswered id");
const recentMistakeItems = context.window.ProgressStore.buildRecentMistakeItems(second.progress.datasets.saitama, 5);
assert(recentMistakeItems[0].id === "saitama_a", "recent mistake practice should sort by last mistake");
const exported = context.window.ProgressStore.exportProgress();
const imported = context.window.ProgressStore.importProgress(exported);
assert(imported.ok, "progress import should accept exported progress");

storage.set(context.window.ProgressStore.key, "{broken json");
const recovered = context.window.ProgressStore.loadProgress();
assert(Object.keys(recovered.datasets).length === 0, "broken progress data should recover to an empty store");
assert(context.window.ProgressStore.consumeRecoveryNotice(), "broken progress data should expose a recovery notice");

console.log(JSON.stringify({
  sessions: second.progress.datasets.saitama.sessions,
  savedStats: Object.keys(second.progress.datasets.saitama.stats).length,
  topWeakPoint: ranking[0].name,
  lastMistake: lastMistakeItems[0].name,
  unanswered: unansweredItems[0].name,
  rankingModes: ["weak", "accuracy", "time"],
  status: "ok"
}, null, 2));
