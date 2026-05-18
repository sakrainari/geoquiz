(function () {
  class QuizEngine {
    constructor(dataset) {
      this.dataset = dataset;
      this.answers = dataset.municipalities;
      this.dataset.imageQuestions = dataset.imageQuestions || [];
      this.reset("municipality", false);
    }

    reset(mode, suddenDeath) {
      this.mode = mode;
      this.suddenDeath = suddenDeath;
      this.questions = this.buildQuestions(mode);
      this.index = 0;
      this.correct = 0;
      this.mistakes = 0;
      this.gameOver = false;
      this.startedAt = Date.now();
      this.questionStartedAt = Date.now();
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

    buildQuestions(mode) {
      const modeDefinition = window.QuizModes.getMode(mode);
      return shuffle(modeDefinition.buildQuestions(this.answers, this.dataset));
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
        modeDefinition.correctMemberIds(q, featureProperties).forEach((id) => {
          const s = this.stats.get(id);
          if (s && !s.correct) {
            s.correct = true;
            s.answerTimeMs = elapsed;
          }
        });
        this.correct += 1;
        this.index += 1;
        this.questionStartedAt = Date.now();
        if (this.index >= this.questions.length) this.gameOver = true;
        return { correct: true, question: q, finished: this.gameOver };
      }

      this.mistakes += 1;
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
      return {
        mode: this.mode,
        totalQuestions: this.questions.length,
        correct: this.correct,
        mistakes: this.mistakes,
        elapsedMs: this.elapsedMs(),
        stats: [...this.stats.values()]
      };
    }
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
