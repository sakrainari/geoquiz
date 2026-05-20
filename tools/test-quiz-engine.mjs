import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = {
  window: {}
};
context.window.window = context.window;
context.globalThis = context.window;
vm.createContext(context);

async function loadScript(path) {
  const source = await readFile(path, "utf8");
  vm.runInContext(source, context, { filename: path });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

await loadScript("data/prefectures/saitama.js");
await loadScript("data/image-questions/saitama.js");
await loadScript("js/quiz-modes.js");
await loadScript("js/quiz-engine.js");

const dataset = context.window.SAITAMA_MUNICIPALITIES;
dataset.imageQuestions = context.window.SAITAMA_IMAGE_QUESTIONS;
const QuizEngine = context.window.QuizEngine;
const engine = new QuizEngine(dataset);

engine.reset("municipality", false);
assert(engine.questions.length === 63, `municipality questions: expected 63, got ${engine.questions.length}`);

const municipalityQuestion = engine.currentQuestion();
const municipalityAnswer = dataset.municipalities.find((item) => item.id === municipalityQuestion.answerId);
const municipalityResult = engine.answer(municipalityAnswer);
assert(municipalityResult.correct, "municipality mode should accept the matching municipality id");
assert(engine.correct === 1, "municipality correct count should increment");

engine.reset("municipality", false, { questionIds: [municipalityQuestion.answerId] });
assert(engine.questions.length === 1, "municipality practice should filter questions by municipality id");
assert(engine.currentQuestion().answerId === municipalityQuestion.answerId, "municipality practice should keep the requested question");

engine.reset("ma", false);
assert(engine.questions.length === 8, `area code questions: expected 8, got ${engine.questions.length}`);
assert(
  engine.questions.every((question) => question.matchType === "area_code"),
  "area code mode should only generate area_code questions"
);

const areaQuestion = engine.currentQuestion();
const areaAnswer = dataset.municipalities.find((item) => item.area_code === areaQuestion.area_code);
const areaResult = engine.answer(areaAnswer);
assert(areaResult.correct, "area code mode should accept any member of the target area code");
assert(engine.correct === 1, "area code correct count should increment");

engine.reset("ma", false, { questionIds: [areaQuestion.id] });
assert(engine.questions.length === 1, "area-code practice should filter questions by question id");
assert(engine.currentQuestion().area_code === areaQuestion.area_code, "area-code practice should keep the requested area code");

engine.reset("ma", false);
const wrongQuestion = engine.currentQuestion();
const wrongAnswer = dataset.municipalities.find((item) => item.area_code !== wrongQuestion.area_code);
const wrongResult = engine.answer(wrongAnswer);
assert(!wrongResult.correct, "area code mode should reject a different area code");
assert(engine.mistakes === 1, "mistake count should increment on wrong answers");
const retryAnswer = dataset.municipalities.find((item) => item.area_code === wrongQuestion.area_code);
const retryResult = engine.answer(retryAnswer);
assert(retryResult.correct, "area code mode should accept the target area code after a miss");
assert(retryResult.mistakesBeforeCorrect === 1, "correct result should report misses before the correct answer");
assert(
  wrongQuestion.memberIds.every((id) => engine.stats.get(id).mistakes === 1),
  "target area members should inherit the question miss count"
);

engine.reset("image", false);
assert(engine.questions.length === 0, "disabled image placeholders should not create active questions");

engine.reset("puzzle", false);
assert(engine.questions.length === 63, `puzzle questions: expected 63, got ${engine.questions.length}`);
engine.completeAll();
assert(engine.correct === 63, "puzzle completeAll should mark every piece correct");
assert(engine.result().stats.every((item) => item.correct), "puzzle completeAll should mark all stats correct");

console.log(JSON.stringify({
  municipalityQuestions: 63,
  areaCodeQuestions: 8,
  puzzlePieces: 63,
  imageQuestions: 0,
  status: "ok"
}, null, 2));
