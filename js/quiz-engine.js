(function () {
  class QuizEngine {
    constructor(dataset) {
      this.dataset = dataset;
      this.answers = dataset.municipalities;
      this.dataset.imageQuestions = dataset.imageQuestions || [];
      this.reset("municipality", "normal");
    }

    reset(mode, ruleOrSuddenDeath, options = {}) {
      this.mode = mode;
      this.rule = normalizeRule(ruleOrSuddenDeath);
      this.suddenDeath = this.rule === "sudden_death";
      this.questions = this.buildQuestions(mode, options);
      this.index = 0;
      this.correct = 0;
      this.mistakes = 0;
      this.gameOver = false;
      this.startedAt = Date.now();
      this.questionStartedAt = Date.now();
      this.currentQuestionMistakes = 0;
      this.questionStats = [];
      this.stats = new Map(this.answers.map((item) => [item.id, {
        id: item.id,
        name: item.name,
        area_code: item.area_code,
        ma_name: item.ma_name,
        tags: item.tags || [],
        mistakes: 0,
        correct: false,
        answerTimeMs: 0
      }]));
    }

    buildQuestions(mode, options = {}) {
      const modeDefinition = window.QuizModes.getMode(mode);
      const questions = modeDefinition.buildQuestions(this.answers, this.dataset);
      if (!options.questionIds || !options.questionIds.length) return shuffle(questions);

      const ids = new Set(options.questionIds);
      return shuffle(questions.filter((question) => (
        ids.has(question.id) || ids.has(question.answerId)
      )));
    }

    currentQuestion() {
      return this.questions[this.index] || null;
    }

    questionText() {
      const q = this.currentQuestion();
      if (!q) return "終了";
      return window.QuizModes.getMode(this.mode).questionText(q);
    }

    answer(featureProperties) {
      if (this.gameOver || !this.currentQuestion()) return { ignored: true };

      const q = this.currentQuestion();
      const modeDefinition = window.QuizModes.getMode(this.mode);
      const correct = modeDefinition.isCorrect(q, featureProperties);

      if (correct) {
        const elapsed = Date.now() - this.questionStartedAt;
        const mistakesBeforeCorrect = this.currentQuestionMistakes;
        this.questionStats.push({
          id: questionStatId(q, this.mode, this.index),
          mistakes: mistakesBeforeCorrect,
          correct: true,
          answerTimeMs: elapsed
        });
        modeDefinition.correctMemberIds(q, featureProperties).forEach((id) => {
          const s = this.stats.get(id);
          if (s && !s.correct) {
            s.correct = true;
            s.mistakes = Math.max(s.mistakes, mistakesBeforeCorrect);
            s.answerTimeMs = elapsed;
          }
        });
        this.correct += 1;
        this.index += 1;
        this.questionStartedAt = Date.now();
        this.currentQuestionMistakes = 0;
        if (this.index >= this.questions.length) this.gameOver = true;
        return { correct: true, question: q, finished: this.gameOver, mistakesBeforeCorrect };
      }

      this.mistakes += 1;
      this.currentQuestionMistakes += 1;
      const stat = this.stats.get(featureProperties.id);
      if (stat) stat.mistakes += 1;
      if (this.suddenDeath) this.gameOver = true;
      return { correct: false, question: q, finished: this.gameOver, suddenDeath: this.suddenDeath };
    }

    remaining() {
      return Math.max(this.questions.length - this.index, 0);
    }

    elapsedMs() {
      return Date.now() - this.startedAt;
    }

    result() {
      const reachedQuestions = this.gameOver && this.index < this.questions.length
        ? Math.min(this.index + 1, this.questions.length)
        : this.questions.length;
      return {
        mode: this.mode,
        rule: this.rule,
        totalQuestions: this.questions.length,
        reachedQuestions,
        correct: this.correct,
        mistakes: this.mistakes,
        elapsedMs: this.elapsedMs(),
        questionStats: [...this.questionStats],
        stats: [...this.stats.values()]
      };
    }

    completeAll() {
      const elapsed = this.elapsedMs();
      this.questions.forEach((question) => {
        window.QuizModes.getMode(this.mode).correctMemberIds(question).forEach((id) => {
          const stat = this.stats.get(id);
          if (stat) {
            stat.correct = true;
            stat.answerTimeMs = stat.answerTimeMs || elapsed;
          }
        });
      });
      this.correct = this.questions.length;
      this.index = this.questions.length;
      this.gameOver = true;
    }
  }

  function normalizeRule(value) {
    if (value === true) return "sudden_death";
    if (value === "easy" || value === "normal" || value === "sudden_death") return value;
    return "normal";
  }

  function questionStatId(question, mode, index) {
    if (question?.id) return question.id;
    if (question?.answerId) return question.answerId;
    if (question?.area_code) return `area_code:${question.area_code}`;
    if (question?.broad_area_code) return `broad_area_code:${question.broad_area_code}`;
    return `${mode}:${index}`;
  }

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  window.QuizEngine = QuizEngine;
})();
