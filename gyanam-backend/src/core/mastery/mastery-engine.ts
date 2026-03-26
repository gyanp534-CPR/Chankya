import { computeConfidenceBand } from "./confidence.js";
import { computeKnowledgeScore } from "./ks.js";
import { computeRiskDisciplineScore } from "./rds.js";
import type { MasteryEngineInput, MasteryResult, TopicAttemptMetric, TopicSignal } from "./types.js";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildAttemptMetrics(signals: TopicSignal[]): TopicAttemptMetric[] {
  const attemptMap = new Map<string, TopicAttemptMetric>();

  for (const signal of signals) {
    if (attemptMap.has(signal.attemptId)) {
      continue;
    }

    const attemptRatio =
      signal.totalQuestions > 0 ? clamp(signal.attemptedCount / signal.totalQuestions, 0, 1) : 0;
    const incorrectRate =
      signal.attemptedCount > 0 ? clamp(signal.incorrectCount / signal.attemptedCount, 0, 1) : 1;

    attemptMap.set(signal.attemptId, {
      attemptId: signal.attemptId,
      attemptRatio,
      incorrectRate,
    });
  }

  return Array.from(attemptMap.values());
}

export function computeMasteryResults(input: MasteryEngineInput): MasteryResult[] {
  const groupedByTopic = new Map<string, TopicSignal[]>();
  for (const signal of input.signals) {
    const bucket = groupedByTopic.get(signal.topicId) ?? [];
    bucket.push(signal);
    groupedByTopic.set(signal.topicId, bucket);
  }

  const asOf = input.options?.asOf ?? new Date();
  const ksLambda = input.options?.ksLambda ?? 0.025;
  const ksConsistencyWindow = input.options?.ksConsistencyWindow ?? 8;
  const rdsRecentWindow = input.options?.rdsRecentWindow ?? 8;
  const influenceMin = input.options?.rdsInfluenceMin ?? 0.06;
  const influenceMax = input.options?.rdsInfluenceMax ?? 0.1;
  const influenceRampPerAttempt = input.options?.rdsInfluenceRampPerAttempt ?? 0.005;

  return Array.from(groupedByTopic.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([topicId, topicSignals]) => {
      const ks = computeKnowledgeScore(topicSignals, {
        asOf,
        lambda: ksLambda,
        consistencyWindow: ksConsistencyWindow,
      });
      const attempts = buildAttemptMetrics(topicSignals);
      const riskScore = computeRiskDisciplineScore(attempts, { recentWindow: rdsRecentWindow });
      const rdsInfluence = clamp(
        influenceMin + Math.max(0, attempts.length - 1) * influenceRampPerAttempt,
        influenceMin,
        influenceMax,
      );
      const finalMastery = ks.knowledgeScore * ((1 - rdsInfluence) + rdsInfluence * riskScore);

      return {
        topicId,
        knowledgeScore: round2(ks.knowledgeScore),
        riskScore,
        finalMastery: round2(clamp(finalMastery, 0, 100)),
        confidence: computeConfidenceBand({
          dataPointsUsed: ks.dataPointsUsed,
          recencyDensity: ks.recencyDensity,
          consistencyFactor: ks.consistencyFactor,
        }),
        dataPointsUsed: ks.dataPointsUsed,
      };
    });
}
