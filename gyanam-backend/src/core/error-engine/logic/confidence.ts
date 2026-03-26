export const CONFIDENCE_RECENT_WINDOW = 10;
export const CONFIDENCE_COMPARE_WINDOW = 5;

export type AttemptSignal = {
  isCorrect: boolean;
  errorType: string | null;
  createdAt: Date;
};

export type ConfidenceSignals = {
  score: number;
  varianceScore: number;
  accuracy: number;
};

export function computeConfidenceSignals(attempts: AttemptSignal[]): ConfidenceSignals | null {
  if (attempts.length === 0) {
    return null;
  }

  const lastFive = attempts.slice(-CONFIDENCE_COMPARE_WINDOW);
  const accuracy = lastFive.filter((attempt) => attempt.isCorrect).length / lastFive.length;

  const incorrects = lastFive.filter((attempt) => !attempt.isCorrect);
  const uniqueErrors = new Set(incorrects.map((attempt) => attempt.errorType ?? "unknown")).size;
  const varianceScore =
    incorrects.length <= 1 ? 1 : 1 - (uniqueErrors - 1) / Math.max(1, incorrects.length - 1);

  const lastThree = lastFive.slice(-3);
  const streakScore = computeStreakScore(lastThree);
  const consistencyScore = computeConsistencyScore(lastFive);

  const confidence = 100 * (0.6 * accuracy + 0.25 * varianceScore + 0.1 * streakScore + 0.05 * consistencyScore);
  return {
    score: Math.round(confidence),
    varianceScore,
    accuracy,
  };
}

export function computeConfidenceBand(
  signals: ConfidenceSignals | null,
  attemptCount: number,
): "low" | "medium" | "high" | null {
  if (!signals) {
    return null;
  }
  if (attemptCount < 5) {
    return "low";
  }
  if (signals.score >= 80 && signals.varianceScore >= 0.7 && signals.accuracy >= 0.7) {
    return "high";
  }
  if (signals.score >= 60) {
    return "medium";
  }
  return "low";
}

function computeStreakScore(lastThree: Array<{ isCorrect: boolean; errorType: string | null }>): number {
  if (lastThree.length < 3) {
    return 0.7;
  }
  const allCorrect = lastThree.every((attempt) => attempt.isCorrect);
  if (allCorrect) {
    return 1;
  }
  const allIncorrectSame = lastThree.every(
    (attempt) => !attempt.isCorrect && attempt.errorType === lastThree[0]?.errorType,
  );
  if (allIncorrectSame) {
    return 0.4;
  }
  return 0.7;
}

function computeConsistencyScore(lastFive: Array<{ createdAt: Date }>): number {
  if (lastFive.length < 2) {
    return 0.8;
  }
  const gaps: number[] = [];
  for (let i = 1; i < lastFive.length; i += 1) {
    const prev = lastFive[i - 1]?.createdAt.getTime() ?? 0;
    const curr = lastFive[i]?.createdAt.getTime() ?? 0;
    if (prev > 0 && curr > 0) {
      gaps.push(Math.abs(curr - prev) / (1000 * 60 * 60));
    }
  }
  if (gaps.length === 0) {
    return 0.8;
  }
  const avgGap = gaps.reduce((acc, value) => acc + value, 0) / gaps.length;
  if (avgGap <= 24) {
    return 1;
  }
  if (avgGap <= 72) {
    return 0.8;
  }
  return 0.6;
}
