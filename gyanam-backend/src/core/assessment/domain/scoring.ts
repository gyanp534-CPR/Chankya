import type { AttemptResponse, Question } from "@gyanam/shared";

const CORRECT = 2;
const INCORRECT = -0.66;

function extractCorrectIndex(question: Question): number {
  const fromTags = question.tags.find((tag) => tag.startsWith("correct:"));
  if (fromTags) {
    const parsed = Number(fromTags.split(":")[1]);
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }

  const maybeScoreable = question as Question & { correctIndex?: number };
  if (typeof maybeScoreable.correctIndex === "number" && maybeScoreable.correctIndex >= 0) {
    return maybeScoreable.correctIndex;
  }

  return -1;
}

export function scoreAttempt(
  questions: Question[],
  responses: AttemptResponse[],
): {
  rawScore: number;
  maxScore: number;
  totalQuestions: number;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  skippedCount: number;
} {
  const responseMap = new Map(responses.map((response) => [response.questionId, response]));
  let rawScore = 0;
  let attemptedCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;

  for (const question of questions) {
    const response = responseMap.get(question.id);
    if (!response || response.selectedIndex === null) {
      continue;
    }

    const correctIndex = extractCorrectIndex(question);
    if (correctIndex < 0) {
      continue;
    }

    attemptedCount += 1;
    if (response.selectedIndex === correctIndex) {
      correctCount += 1;
      rawScore += CORRECT;
    } else {
      incorrectCount += 1;
      rawScore += INCORRECT;
    }
  }

  const totalQuestions = questions.length;
  const skippedCount = totalQuestions - attemptedCount;
  return {
    rawScore: Number(rawScore.toFixed(2)),
    maxScore: totalQuestions * CORRECT,
    totalQuestions,
    attemptedCount,
    correctCount,
    incorrectCount,
    skippedCount,
  };
}
