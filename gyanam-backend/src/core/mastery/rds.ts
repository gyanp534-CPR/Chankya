import type { TopicAttemptMetric } from "./types.js";

const DEFAULT_IDEAL_ATTEMPT_RATIO = 0.8;
const DEFAULT_MAX_ATTEMPT_DEVIATION = 0.5;
const DEFAULT_IDEAL_INCORRECT_RATE = 0.2;
const DEFAULT_MAX_INCORRECT_EXCESS = 0.5;
const DEFAULT_SD_NORMALIZER = 0.3;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function sampleStdDev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeAttemptRatioDiscipline(attemptRatio: number, ideal: number, maxDeviation: number): number {
  const deviation = Math.abs(attemptRatio - ideal);
  return 1 - clamp(deviation / maxDeviation, 0, 1);
}

function computeIncorrectRateDiscipline(incorrectRate: number, ideal: number, maxExcess: number): number {
  const excess = Math.max(0, incorrectRate - ideal);
  return 1 - clamp(excess / maxExcess, 0, 1);
}

export function computeRiskDisciplineScore(
  attempts: TopicAttemptMetric[],
  options: {
    recentWindow?: number;
    idealAttemptRatio?: number;
    idealIncorrectRate?: number;
    minScore?: number;
    maxScore?: number;
  } = {},
): number {
  if (attempts.length === 0) {
    return 0.75;
  }

  const recentWindow = options.recentWindow ?? 8;
  const idealAttemptRatio = options.idealAttemptRatio ?? DEFAULT_IDEAL_ATTEMPT_RATIO;
  const idealIncorrectRate = options.idealIncorrectRate ?? DEFAULT_IDEAL_INCORRECT_RATE;
  const minScore = options.minScore ?? 0.5;
  const maxScore = options.maxScore ?? 1;
  const recent = attempts.slice(-recentWindow);

  const attemptRatios = recent.map((attempt) => clamp(attempt.attemptRatio, 0, 1));
  const incorrectRates = recent.map((attempt) => clamp(attempt.incorrectRate, 0, 1));

  const averageAttemptRatio = attemptRatios.reduce((acc, value) => acc + value, 0) / attemptRatios.length;
  const averageIncorrectRate = incorrectRates.reduce((acc, value) => acc + value, 0) / incorrectRates.length;

  const ard = computeAttemptRatioDiscipline(
    averageAttemptRatio,
    idealAttemptRatio,
    DEFAULT_MAX_ATTEMPT_DEVIATION,
  );
  const ird = computeIncorrectRateDiscipline(
    averageIncorrectRate,
    idealIncorrectRate,
    DEFAULT_MAX_INCORRECT_EXCESS,
  );
  const stabilityDiscipline =
    recent.length < 5 ? 0.7 : 1 - clamp(sampleStdDev(attemptRatios) / DEFAULT_SD_NORMALIZER, 0, 1);

  const rdsRaw = 0.4 * ard + 0.4 * ird + 0.2 * stabilityDiscipline;
  return round3(clamp(rdsRaw, minScore, maxScore));
}
