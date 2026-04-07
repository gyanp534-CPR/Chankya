import type { SkillBand } from "../mastery/skill-band.js";

export type LatestTopicMastery = {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  mastery: number;
  dataPointsUsed: number;
};

export type RevisionDueItem = {
  taskId: string;
  topicId: string;
  topicName: string;
  subjectName: string;
  dueAt: string;
};

export type AnalyticsSummarySubject = {
  subjectId: string;
  subjectName: string;
  mastery: number;
  skillBand: SkillBand;
};

export type AnalyticsSummary = {
  globalMastery: number;
  globalSkillBand: SkillBand;
  subjects: AnalyticsSummarySubject[];
};

export type AnalyticsTopicView = {
  topicId: string;
  topicName: string;
  subjectName: string;
  mastery: number;
  skillBand: SkillBand;
  confidence: "low" | "medium" | "high";
  isWeak: boolean;
  frequencyScore: number;
  priorityScore: number;
  dataPointsUsed: number;
};

export interface AnalyticsRepository {
  getLatestTopicMastery(userId: string): Promise<LatestTopicMastery[]>;
  getWeakTopicIds(userId: string): Promise<string[]>;
  getOpenRevisionTasks(userId: string): Promise<RevisionDueItem[]>;
}
