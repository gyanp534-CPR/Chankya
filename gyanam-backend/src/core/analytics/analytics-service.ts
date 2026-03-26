import type {
  AnalyticsRepository,
  AnalyticsSummary,
  AnalyticsTopicView,
  LatestTopicMastery,
  RevisionDueItem,
} from "./types.js";
import { computePriorityScore } from "../mastery/priority.js";
import { resolveSkillBand } from "../mastery/skill-band.js";

export type AnalyticsServiceDeps = {
  repository: AnalyticsRepository;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export class AnalyticsService {
  public constructor(private readonly deps: AnalyticsServiceDeps) {}

  public async getSummary(userId: string): Promise<AnalyticsSummary> {
    const rows = await this.deps.repository.getLatestTopicMastery(userId);
    const subjectsMap = new Map<string, number[]>();
    for (const row of rows) {
      const bucket = subjectsMap.get(row.subjectId) ?? [];
      bucket.push(row.mastery);
      subjectsMap.set(row.subjectId, bucket);
    }

    const subjects = Array.from(subjectsMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([subjectId, masteries]) => {
        const mastery = round2(average(masteries));
        return {
          subjectId,
          mastery,
          skillBand: resolveSkillBand(mastery),
        };
      });

    const globalMastery = round2(average(subjects.map((subject) => subject.mastery)));
    return {
      globalMastery,
      globalSkillBand: resolveSkillBand(globalMastery),
      subjects,
    };
  }

  public async getTopics(userId: string): Promise<AnalyticsTopicView[]> {
    const [rows, weakTopicIds] = await Promise.all([
      this.deps.repository.getLatestTopicMastery(userId),
      this.deps.repository.getWeakTopicIds(userId),
    ]);
    const weakSet = new Set(weakTopicIds);

    return rows
      .map((row) => ({
        topicId: row.topicId,
        mastery: round2(row.mastery),
        skillBand: resolveSkillBand(row.mastery),
        confidence: row.confidence,
        isWeak: weakSet.has(row.topicId),
        frequencyScore: 1,
        priorityScore: computePriorityScore(row.mastery, 1),
      }))
      .sort((a, b) => a.topicId.localeCompare(b.topicId));
  }

  public async getRevisionDue(userId: string, asOf: Date = new Date()): Promise<RevisionDueItem[]> {
    const rows = await this.deps.repository.getOpenRevisionTasks(userId);
    return rows
      .filter((row) => new Date(row.dueAt).getTime() <= asOf.getTime())
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }
}

export class NoopAnalyticsRepository implements AnalyticsRepository {
  public async getLatestTopicMastery(_userId: string): Promise<LatestTopicMastery[]> {
    return [];
  }

  public async getWeakTopicIds(_userId: string): Promise<string[]> {
    return [];
  }

  public async getOpenRevisionTasks(_userId: string): Promise<RevisionDueItem[]> {
    return [];
  }
}
