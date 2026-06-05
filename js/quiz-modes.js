(function () {
  const QuizModes = {
    municipality: {
      id: "municipality",
      label: "市区町村モード",
      buildQuestions(answers) {
        return answers.map((item) => ({
          id: item.id,
          answerId: item.id,
          answerLabel: item.name,
          memberIds: [item.id]
        }));
      },
      questionText(question) {
        return `${question.answerLabel} をクリック`;
      },
      isCorrect(question, featureProperties) {
        return featureProperties.id === question.answerId;
      },
      correctMemberIds(question) {
        return question.memberIds;
      }
    },
    ma: {
      id: "ma",
      label: "市外局番モード",
      buildQuestions(answers) {
        const groups = new Map();
        answers.forEach((item) => {
          if (!groups.has(item.area_code)) {
            groups.set(item.area_code, {
              id: `area_code:${item.area_code}`,
              matchType: "area_code",
              area_code: item.area_code,
              answerLabel: item.area_code,
              memberIds: []
            });
          }
          groups.get(item.area_code).memberIds.push(item.id);
        });
        return [...groups.values()];
      },
      questionText(question) {
        return `${question.answerLabel} のエリアをクリック`;
      },
      isCorrect(question, featureProperties) {
        return featureProperties.area_code === question.area_code
          || question.memberIds.includes(featureProperties.id);
      },
      correctMemberIds(question) {
        return question.memberIds;
      }
    },
    puzzle: {
      id: "puzzle",
      label: "パズルモード",
      buildQuestions(answers) {
        return answers.map((item) => ({
          id: item.id,
          answerId: item.id,
          answerLabel: item.name,
          memberIds: [item.id]
        }));
      },
      questionText() {
        return "ポリゴンをドラッグして元の位置へ戻す";
      },
      isCorrect() {
        return false;
      },
      correctMemberIds(question) {
        return question.memberIds;
      }
    },
    municipality_th: {
      id: "municipality_th",
      label: "タイ語名モード",
      buildQuestions(answers) {
        return answers
          .filter((item) => item.name_th)
          .map((item) => ({
            id: item.id,
            answerId: item.id,
            answerLabel: item.name_th,
            nameEn: item.name,
            memberIds: [item.id]
          }));
      },
      questionText(question) {
        return question.answerLabel;
      },
      isCorrect(question, featureProperties) {
        return featureProperties.id === question.answerId;
      },
      correctMemberIds(question) {
        return question.memberIds;
      }
    },
    municipality_th_abbr: {
      id: "municipality_th_abbr",
      label: "タイ語略称モード",
      buildQuestions(answers) {
        return answers
          .filter((item) => item.name_abbr_th)
          .map((item) => ({
            id: item.id,
            answerId: item.id,
            answerLabel: item.name_abbr_th,
            nameEn: item.name,
            nameTh: item.name_th,
            memberIds: [item.id]
          }));
      },
      questionText(question) {
        return question.answerLabel;
      },
      isCorrect(question, featureProperties) {
        return featureProperties.id === question.answerId;
      },
      correctMemberIds(question) {
        return question.memberIds;
      }
    },
    municipality_native: {
      id: "municipality_native",
      label: "現地語名モード",
      buildQuestions(answers) {
        return answers
          .filter((item) => item.name_native)
          .map((item) => ({
            id: item.id,
            answerId: item.id,
            answerLabel: item.name_native,
            nameEn: item.name,
            memberIds: [item.id]
          }));
      },
      questionText(question) {
        return question.answerLabel;
      },
      isCorrect(question, featureProperties) {
        return featureProperties.id === question.answerId;
      },
      correctMemberIds(question) {
        return question.memberIds;
      }
    },
    confirm: {
      id: "confirm",
      label: "確認マップ",
      buildQuestions() { return []; },
      questionText() { return "全市区町村を確認中"; },
      isCorrect() { return false; },
      correctMemberIds() { return []; }
    },
    image: {
      id: "image",
      label: "画像判別モード",
      buildQuestions(answers, dataset) {
        return (dataset.imageQuestions || [])
          .filter((item) => item.enabled)
          .map((item) => ({
            id: item.id,
            type: item.type,
            answerId: item.answerId,
            answerLabel: item.answerName,
            question: item.question,
            image: item.image,
            tags: item.tags || [],
            memberIds: [item.answerId]
          }));
      },
      questionText(question) {
        return question.question || "この画像はどこ？";
      },
      isCorrect(question, answer) {
        return answer.id === question.answerId || answer.answerId === question.answerId;
      },
      correctMemberIds(question) {
        return question.memberIds;
      }
    }
  };

  function getMode(modeId) {
    return QuizModes[modeId] || QuizModes.municipality;
  }

  window.QuizModes = { definitions: QuizModes, getMode };
})();
