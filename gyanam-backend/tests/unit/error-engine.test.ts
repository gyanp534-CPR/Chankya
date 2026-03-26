import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ErrorEngineService } from "../../src/core/error-engine/error-engine-service.js";
import { loadErrorGraph } from "../../src/core/error-engine/error-graph.js";
import type { ErrorAttemptInput, ErrorEngineRepository, UserErrorState } from "../../src/core/error-engine/types.js";

class InMemoryErrorRepo implements ErrorEngineRepository {
  public attempts: Array<{ userId: string; isCorrect: boolean; errorType: string | null; createdAt: Date }> = [];
  public state: Map<string, UserErrorState> = new Map();

  public async getUserErrorState(userId: string): Promise<UserErrorState | null> {
    return this.state.get(userId) ?? null;
  }

  public async upsertUserErrorState(state: UserErrorState): Promise<void> {
    this.state.set(state.userId, state);
  }

  public async logAttempt(input: ErrorAttemptInput): Promise<void> {
    this.attempts.push({
      userId: input.userId,
      isCorrect: input.isCorrect,
      errorType: input.errorType ?? null,
      createdAt: new Date(),
    });
  }

  public async getRecentAttempts(userId: string, limit: number): Promise<Array<{ isCorrect: boolean; errorType: string | null; createdAt: Date }>> {
    const rows = this.attempts.filter((attempt) => attempt.userId === userId);
    return rows.slice(-limit);
  }
}

function buildService() {
  const repo = new InMemoryErrorRepo();
  const graph = loadErrorGraph();
  const service = new ErrorEngineService({ repository: repo, graph });
  return { repo, service };
}

async function submitAttempt(
  service: ErrorEngineService,
  input: Omit<ErrorAttemptInput, "userId" | "questionId"> & { userId?: string; questionId?: string },
) {
  return service.recordAttempt({
    userId: input.userId ?? "user-1",
    questionId: input.questionId ?? `q-${Math.random()}`,
    attemptId: input.attemptId,
    isCorrect: input.isCorrect,
    errorType: input.errorType,
  });
}

describe("ErrorEngineService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects dominant error and unstable state on sharp decline", async () => {
    const { service } = buildService();

    for (let i = 0; i < 5; i += 1) {
      await submitAttempt(service, { isCorrect: true });
      vi.advanceTimersByTime(60_000);
    }

    for (let i = 0; i < 5; i += 1) {
      await submitAttempt(service, { isCorrect: false, errorType: "Partial Knowledge Trap" });
      vi.advanceTimersByTime(60_000);
    }

    const result = await submitAttempt(service, { isCorrect: false, errorType: "Partial Knowledge Trap" });
    expect(result.dominantError).toBe("Partial Knowledge Trap");
    expect(result.trend).toBe("declining");
    expect(result.userState).toBe("unstable");
  });

  it("marks stable when performance is consistently strong", async () => {
    const { service } = buildService();

    for (let i = 0; i < 10; i += 1) {
      await submitAttempt(service, { isCorrect: true });
      vi.advanceTimersByTime(60_000);
    }

    const result = await submitAttempt(service, { isCorrect: true });
    expect(result.confidenceBand).toBe("high");
    expect(result.userState).toBe("stable");
    expect(result.systemAction).toBe("maintain_level");
  });

  it("keeps dominantError empty for mixed errors", async () => {
    const { service } = buildService();

    await submitAttempt(service, { isCorrect: false, errorType: "Memory Gap" });
    vi.advanceTimersByTime(60_000);
    await submitAttempt(service, { isCorrect: false, errorType: "Concept Confusion" });
    vi.advanceTimersByTime(60_000);
    const result = await submitAttempt(service, { isCorrect: false, errorType: "Fact Misassociation" });

    expect(result.dominantError).toBeNull();
    expect(result.userState).toBe("learning");
  });

  it("avoids high confidence after a false confidence streak", async () => {
    const { service } = buildService();

    for (let i = 0; i < 5; i += 1) {
      await submitAttempt(service, { isCorrect: true });
      vi.advanceTimersByTime(60_000);
    }

    for (let i = 0; i < 5; i += 1) {
      await submitAttempt(service, { isCorrect: false, errorType: "Fact Misassociation" });
      vi.advanceTimersByTime(60_000);
    }

    const result = await submitAttempt(service, { isCorrect: false, errorType: "Fact Misassociation" });
    expect(result.trend).toBe("declining");
    expect(result.confidenceBand).not.toBe("high");
  });

  it("captures recovery trend after improvement", async () => {
    const { service } = buildService();

    for (let i = 0; i < 5; i += 1) {
      await submitAttempt(service, { isCorrect: false, errorType: "Memory Gap" });
      vi.advanceTimersByTime(60_000);
    }

    for (let i = 0; i < 5; i += 1) {
      await submitAttempt(service, { isCorrect: true });
      vi.advanceTimersByTime(60_000);
    }

    const result = await submitAttempt(service, { isCorrect: true });
    expect(result.trend).toBe("improving");
    expect(["learning", "stable"]).toContain(result.userState);
  });
});
