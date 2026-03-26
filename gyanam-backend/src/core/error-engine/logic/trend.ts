import { CONFIDENCE_COMPARE_WINDOW } from "./confidence.js";

export type AttemptSignal = {
  isCorrect: boolean;
  errorType: string | null;
  createdAt: Date;
};

export function computeTrend(
  attempts: AttemptSignal[],
): "improving" | "declining" | "flat" | null {
  if (attempts.length < CONFIDENCE_COMPARE_WINDOW) {
    return null;
  }

  const lastFive = attempts.slice(-CONFIDENCE_COMPARE_WINDOW);
  const prevFive = attempts.slice(-CONFIDENCE_COMPARE_WINDOW * 2, -CONFIDENCE_COMPARE_WINDOW);
  if (prevFive.length < CONFIDENCE_COMPARE_WINDOW) {
    return "flat";
  }

  const lastAccuracy = lastFive.filter((attempt) => attempt.isCorrect).length / lastFive.length;
  const prevAccuracy = prevFive.filter((attempt) => attempt.isCorrect).length / prevFive.length;
  const delta = lastAccuracy - prevAccuracy;

  if (delta >= 0.1) {
    return "improving";
  }
  if (delta <= -0.1) {
    return "declining";
  }
  return "flat";
}
