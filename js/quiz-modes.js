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
        return question.memberIds.includes(featureProperties.id);
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
