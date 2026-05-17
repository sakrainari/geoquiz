(function () {
  class QuizEngine {
    constructor(dataset) {
      this.dataset = dataset;
      this.answers = dataset.municipalities;
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
      if (mode === "ma") {
        const groups = new Map();
        this.answers.forEach((item) => {
          const key = `${item.area_code}|${item.ma_name}`;
          if (!groups.has(key)) {
            groups.set(key, {
              id: key,
              area_code: item.area_code,
              ma_name: item.ma_name,
              answerLabel: Math.random() > 0.45 ? item.ma_name : item.area_code,
              memberIds: []
            });
          }
          groups.get(key).memberIds.push(item.id);
        });
        return shuffle([...groups.values()]);
      }

      return shuffle(this.answers.map((item) => ({
        id: item.id,
        answerId: item.id,
        answerLabel: item.name
      })));
    }

    currentQuestion() {
      return this.questions[this.index] || null;
    }

    questionText() {
      const q = this.currentQuestion();
      if (!q) return "終了";
      if (this.mode === "ma") return `${q.answerLabel} のエリアをクリック`;
      return `${q.answerLabel} をクリック`;
    }

    answer(featureProperties) {
      if (this.gameOver || !this.currentQuestion()) return { ignored: true };

      const q = this.currentQuestion();
      const stat = this.stats.get(featureProperties.id);
      const correct = this.mode === "ma"
        ? featureProperties.ma_name === q.ma_name || featureProperties.area_code === q.area_code
        : featureProperties.id === q.answerId;

      if (correct) {
        const elapsed = Date.now() - this.questionStartedAt;
        if (this.mode === "ma") {
          this.answers
            .filter((item) => item.ma_name === q.ma_name || item.area_code === q.area_code)
            .forEach((item) => {
              const s = this.stats.get(item.id);
              if (s && !s.correct) {
                s.correct = true;
                s.answerTimeMs = elapsed;
              }
            });
        } else if (stat && !stat.correct) {
          stat.correct = true;
          stat.answerTimeMs = elapsed;
        }
        this.correct += 1;
        this.index += 1;
        this.questionStartedAt = Date.now();
        if (this.index >= this.questions.length) this.gameOver = true;
        return { correct: true, question: q, finished: this.gameOver };
      }

      this.mistakes += 1;
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
