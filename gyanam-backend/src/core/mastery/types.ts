import type { Difficulty } from "@gyanam/shared";
import type { RecomputeReason } from "./constants.js";
import type { AggregatedConceptPerformance } from "./concept-performance.js";

export type ConfidenceBand = "low" | "medium" | "high";

export interface TopicSignal {
  topicId: string;
  correct: boolean;
  difficulty: Difficulty;
  answeredAt: Date;
  attemptId: string;
  totalQuestions: number;
  attemptedCount: number;
  incorrectCount: number;
}

export interface TopicAttemptMetric {
  attemptId: string;
  attemptRatio: number;
  incorrectRate: number;
}

export interface MasteryResult {
  topicId: string;
  knowledgeScore: number;
  riskScore: number;
  finalMastery: number;
  confidence: ConfidenceBand;
  dataPointsUsed: number;
}

export interface MasteryHistoryWrite extends MasteryResult {
  userId: string;
  computedAt: Date;
  modelVersion: string;
  recomputeReason?: RecomputeReason;
  sourceAttemptId?: string;
}

export interface MasteryRepository {
  getUserTopicSignals(userId: string): Promise<TopicSignal[]>;
  getAllUserIdsWithAttempts(): Promise<string[]>;
  appendHistory(rows: MasteryHistoryWrite[]): Promise<void>;
  hasHistoryForSourceAttempt(userId: string, sourceAttemptId: string): Promise<boolean>;
}

export interface WeakAreaRepository {
  upsertWeakArea(userId: string, topicId: string, mastery: number): Promise<void>;
  deleteWeakAreasNotInList(userId: string, topicIds: string[]): Promise<void>;
}

export interface RevisionTaskRecord {
  id: string;
  userId: string;
  topicId: string;
  dueAt: Date;
  completed: boolean;
  createdAt: Date;
}

export interface RevisionRepository {
  createRevisionTask(userId: string, topicId: string, dueAt: Date): Promise<void>;
  findOpenTasks(userId: string): Promise<RevisionTaskRecord[]>;
  markCompleted(taskId: string): Promise<void>;
  deleteFutureTasksForTopic(userId: string, topicId: string, asOf?: Date): Promise<void>;
}

export interface ConceptPerformanceRepository {
  aggregateSignalsForAttempt(attemptId: string): Promise<AggregatedConceptPerformance[]>;
  applyAggregates(userId: string, aggregates: AggregatedConceptPerformance[]): Promise<void>;
}

export interface MasteryEngineOptions {
  asOf?: Date;
  ksLambda?: number;
  ksConsistencyWindow?: number;
  rdsRecentWindow?: number;
  rdsInfluenceMin?: number;
  rdsInfluenceMax?: number;
  rdsInfluenceRampPerAttempt?: number;
}

export interface MasteryEngineInput {
  signals: TopicSignal[];
  options?: MasteryEngineOptions;
}
