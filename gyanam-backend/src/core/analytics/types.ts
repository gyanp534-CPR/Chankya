import type { SkillBand } from "../mastery/skill-band.js";

export type LatestTopicMastery = {
  topicId: string;
  subjectId: string;
  mastery: number;
  confidence: "low" | "medium" | "high";
};

export type RevisionDueItem = {
  taskId: string;
  topicId: string;
  dueAt: string;
};

export type AnalyticsSummarySubject = {
  subjectId: string;
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
  mastery: number;
  skillBand: SkillBand;
  confidence: "low" | "medium" | "high";
  isWeak: boolean;
  frequencyScore: number;
  priorityScore: number;
};

export interface AnalyticsRepository {
  getLatestTopicMastery(userId: string): Promise<LatestTopicMastery[]>;
  getWeakTopicIds(userId: string): Promise<string[]>;
  getOpenRevisionTasks(userId: string): Promise<RevisionDueItem[]>;
}
