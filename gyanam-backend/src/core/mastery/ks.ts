import type { Difficulty } from "@gyanam/shared";
import type { TopicSignal } from "./types.js";

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

const DIFFICULTY_WEIGHT: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.25,
  hard: 1.5,
};

export type KnowledgeScoreResult = {
  knowledgeScore: number;
  consistencyFactor: number;
  recencyDensity: number;
  dataPointsUsed: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sampleStdDev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function computeKnowledgeScore(
  signals: TopicSignal[],
  options: {
    asOf?: Date;
    lambda?: number;
    consistencyWindow?: number;
    debug?: (data: {
      numerator: number;
      denominator: number;
      knowledgeRatio: number;
      dampener: number;
      consistencyFactor: number;
      dataPointsUsed: number;
    }) => void;
  } = {},
): KnowledgeScoreResult {
  if (signals.length === 0) {
    return {
      knowledgeScore: 0,
      consistencyFactor: 0.7,
      recencyDensity: 0,
      dataPointsUsed: 0,
    };
  }

  const asOf = options.asOf ?? new Date();
  const lambda = options.lambda ?? 0.025;
  const consistencyWindow = options.consistencyWindow ?? 8;
  const sorted = [...signals].sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());

  let numerator = 0;
  let denominator = 0;
  const attemptBuckets = new Map<string, { numerator: number; denominator: number }>();
  let recentCount = 0;

  for (const signal of sorted) {
    const difficultyWeight = DIFFICULTY_WEIGHT[signal.difficulty];
    const daysSinceAttempt = Math.max(0, (asOf.getTime() - signal.answeredAt.getTime()) / MILLIS_PER_DAY);
    const decayWeight = Math.exp(-lambda * daysSinceAttempt);
    const weightedDenominator = difficultyWeight * decayWeight;
    const weightedNumerator = (signal.correct ? 1 : 0) * weightedDenominator;

    denominator += weightedDenominator;
    numerator += weightedNumerator;

    const bucket = attemptBuckets.get(signal.attemptId) ?? { numerator: 0, denominator: 0 };
    bucket.denominator += difficultyWeight;
    bucket.numerator += signal.correct ? difficultyWeight : 0;
    attemptBuckets.set(signal.attemptId, bucket);

    if (daysSinceAttempt <= 30) {
      recentCount += 1;
    }
  }

  const knowledgeRatio = denominator === 0 ? 0 : numerator / denominator;
  const perAttemptRatios = Array.from(attemptBuckets.values()).map((item) =>
    item.denominator === 0 ? 0 : item.numerator / item.denominator,
  );
  const recentAttemptRatios = perAttemptRatios.slice(-consistencyWindow);
  const consistencyStdDev = sampleStdDev(recentAttemptRatios);
  const consistencyFactor = 1 - clamp(consistencyStdDev / 0.3, 0, 1);
  const dampener = 0.85 + 0.15 * consistencyFactor;
  options.debug?.({
    numerator,
    denominator,
    knowledgeRatio,
    dampener,
    consistencyFactor,
    dataPointsUsed: signals.length,
  });

  return {
    knowledgeScore: round2(clamp(knowledgeRatio * 100 * dampener, 0, 100)),
    consistencyFactor: round2(consistencyFactor),
    recencyDensity: round2(recentCount / signals.length),
    dataPointsUsed: signals.length,
  };
}
