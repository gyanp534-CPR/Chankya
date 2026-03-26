import type { Difficulty } from "@gyanam/shared";

export type ConceptAttemptSignal = {
  conceptId: string;
  correct: boolean;
  difficulty: Difficulty;
  timeSpentSeconds: number;
  answeredAt: Date;
};

export type AggregatedConceptPerformance = {
  conceptId: string;
  scoreDelta: number;
  attemptsDelta: number;
  correctAttemptsDelta: number;
  incorrectAttemptsDelta: number;
  averageTimeSeconds: number;
  lastAnsweredAt: Date;
};

function difficultyWeight(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy":
      return 1;
    case "medium":
      return 2;
    case "hard":
      return 3;
    default:
      return 1;
  }
}

function timeAdjustment(timeSpentSeconds: number): number {
  if (timeSpentSeconds <= 20) {
    return 1;
  }
  if (timeSpentSeconds <= 60) {
    return 0;
  }
  return -1;
}

export function aggregateConceptPerformance(
  signals: ConceptAttemptSignal[],
): AggregatedConceptPerformance[] {
  const grouped = new Map<string, ConceptAttemptSignal[]>();

  for (const signal of signals) {
    const bucket = grouped.get(signal.conceptId) ?? [];
    bucket.push(signal);
    grouped.set(signal.conceptId, bucket);
  }

  return [...grouped.entries()].map(([conceptId, items]) => {
    let scoreDelta = 0;
    let correctAttemptsDelta = 0;
    let incorrectAttemptsDelta = 0;
    let totalTime = 0;
    let lastAnsweredAt = items[0]?.answeredAt ?? new Date(0);

    for (const item of items) {
      const weightedBase = difficultyWeight(item.difficulty);
      const delta = item.correct
        ? weightedBase + timeAdjustment(item.timeSpentSeconds)
        : -weightedBase + timeAdjustment(item.timeSpentSeconds);

      scoreDelta += delta;
      totalTime += item.timeSpentSeconds;
      if (item.correct) {
        correctAttemptsDelta += 1;
      } else {
        incorrectAttemptsDelta += 1;
      }
      if (item.answeredAt > lastAnsweredAt) {
        lastAnsweredAt = item.answeredAt;
      }
    }

    return {
      conceptId,
      scoreDelta,
      attemptsDelta: items.length,
      correctAttemptsDelta,
      incorrectAttemptsDelta,
      averageTimeSeconds: Math.round((totalTime / items.length) * 100) / 100,
      lastAnsweredAt,
    };
  });
}
