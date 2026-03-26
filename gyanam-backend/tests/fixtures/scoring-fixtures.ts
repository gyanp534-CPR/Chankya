export type ScoringQuestionFixture = {
  questionId: string;
  difficulty: "easy" | "medium" | "hard";
  marksCorrect: number;
  marksIncorrect: number;
  selectedOption: "correct" | "incorrect" | "unattempted";
};

export const scoringFixtures: ScoringQuestionFixture[] = [
  { questionId: "q1", difficulty: "easy", marksCorrect: 2, marksIncorrect: -0.66, selectedOption: "correct" },
  { questionId: "q2", difficulty: "medium", marksCorrect: 2, marksIncorrect: -0.66, selectedOption: "incorrect" },
  { questionId: "q3", difficulty: "hard", marksCorrect: 2, marksIncorrect: -0.66, selectedOption: "unattempted" },
];

export const scoringFixtureExpected = {
  rawScore: 1.34,
  attempted: 2,
  correct: 1,
  incorrect: 1,
  unattempted: 1,
};
