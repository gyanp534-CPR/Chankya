import { describe, expect, it } from "vitest";
import { MasteryService } from "../../src/core/mastery/mastery-service.js";
import type {
  MasteryHistoryWrite,
  MasteryRepository,
  RevisionRepository,
  RevisionTaskRecord,
  TopicSignal,
  WeakAreaRepository,
} from "../../src/core/mastery/types.js";

class InMemoryMasteryRepo implements MasteryRepository {
  public signals: TopicSignal[] = [];
  public history: MasteryHistoryWrite[] = [];

  public async getUserTopicSignals(_userId: string): Promise<TopicSignal[]> {
    return this.signals;
  }

  public async getAllUserIdsWithAttempts(): Promise<string[]> {
    return ["u1"];
  }

  public async appendHistory(rows: MasteryHistoryWrite[]): Promise<void> {
    this.history.push(...rows);
  }

  public async hasHistoryForSourceAttempt(_userId: string, _sourceAttemptId: string): Promise<boolean> {
    return false;
  }
}

class InMemoryWeakAreaRepo implements WeakAreaRepository {
  public areas = new Map<string, number>();

  public async upsertWeakArea(userId: string, topicId: string, mastery: number): Promise<void> {
    this.areas.set(`${userId}:${topicId}`, mastery);
  }

  public async deleteWeakAreasNotInList(userId: string, topicIds: string[]): Promise<void> {
    const keep = new Set(topicIds.map((topicId) => `${userId}:${topicId}`));
    for (const key of this.areas.keys()) {
      if (key.startsWith(`${userId}:`) && !keep.has(key)) {
        this.areas.delete(key);
      }
    }
  }
}

class InMemoryRevisionRepo implements RevisionRepository {
  public tasks: RevisionTaskRecord[] = [];

  public async createRevisionTask(userId: string, topicId: string, dueAt: Date): Promise<void> {
    this.tasks.push({
      id: `${this.tasks.length + 1}`,
      userId,
      topicId,
      dueAt,
      completed: false,
      createdAt: new Date(),
    });
  }

  public async findOpenTasks(userId: string): Promise<RevisionTaskRecord[]> {
    return this.tasks.filter((task) => task.userId === userId && !task.completed);
  }

  public async markCompleted(taskId: string): Promise<void> {
    const task = this.tasks.find((item) => item.id === taskId);
    if (task) {
      task.completed = true;
    }
  }

  public async deleteFutureTasksForTopic(userId: string, topicId: string, asOf: Date = new Date()): Promise<void> {
    this.tasks = this.tasks.filter(
      (task) =>
        !(task.userId === userId && task.topicId === topicId && !task.completed && task.dueAt.getTime() >= asOf.getTime()),
    );
  }
}

function buildSignals(topicId: string, correct: boolean): TopicSignal[] {
  return Array.from({ length: 20 }, (_, index) => ({
    topicId,
    correct,
    difficulty: index % 2 === 0 ? "easy" : "medium",
    answeredAt: new Date("2026-03-04T00:00:00.000Z"),
    attemptId: `a-${index}`,
    totalQuestions: 10,
    attemptedCount: 8,
    incorrectCount: correct ? 1 : 7,
  }));
}

describe("MasteryService revision scheduling", () => {
  it("creates tasks once for weak topics and removes them when topic recovers", async () => {
    const repo = new InMemoryMasteryRepo();
    const weakAreas = new InMemoryWeakAreaRepo();
    const revision = new InMemoryRevisionRepo();
    const service = new MasteryService({ repository: repo, weakAreas, revision });

    repo.signals = buildSignals("t1", false);
    await service.recomputeForUser("u1", "manual_recompute", { computedAt: new Date("2026-03-04T00:00:00.000Z") });
    expect(revision.tasks.filter((task) => task.topicId === "t1" && !task.completed)).toHaveLength(2);

    await service.recomputeForUser("u1", "manual_recompute", { computedAt: new Date("2026-03-04T00:00:00.000Z") });
    expect(revision.tasks.filter((task) => task.topicId === "t1" && !task.completed)).toHaveLength(2);

    repo.signals = buildSignals("t1", true);
    await service.recomputeForUser("u1", "manual_recompute", { computedAt: new Date("2026-03-04T00:00:00.000Z") });
    expect(revision.tasks.filter((task) => task.topicId === "t1" && !task.completed)).toHaveLength(0);
  });
});
