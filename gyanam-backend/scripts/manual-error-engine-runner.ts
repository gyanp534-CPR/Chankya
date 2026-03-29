import { ErrorEngineService } from "../src/core/error-engine/error-engine-service.js";
import { loadErrorGraph } from "../src/core/error-engine/error-graph.js";
import type {
  ErrorAttemptInput,
  ErrorEngineRepository,
  UserErrorMemory,
  UserErrorState,
} from "../src/core/error-engine/types.js";

class InMemoryErrorRepo implements ErrorEngineRepository {
  public attempts: Array<{ userId: string; isCorrect: boolean; errorType: string | null; createdAt: Date }> = [];
  public state: Map<string, UserErrorState> = new Map();
  public memory: Map<string, UserErrorMemory[]> = new Map();
  private now: Date = new Date();

  public setNow(now: Date) {
    this.now = now;
  }

  public tick(minutes: number) {
    this.now = new Date(this.now.getTime() + minutes * 60_000);
  }

  public async getUserErrorState(userId: string): Promise<UserErrorState | null> {
    return this.state.get(userId) ?? null;
  }

  public async upsertUserErrorState(state: UserErrorState): Promise<void> {
    this.state.set(state.userId, state);
  }

  public async getUserErrorMemory(userId: string): Promise<UserErrorMemory[]> {
    return this.memory.get(userId) ?? [];
  }

  public async upsertUserErrorMemory(userId: string, state: UserErrorMemory[]): Promise<void> {
    this.memory.set(userId, state);
  }

  public async logAttempt(input: ErrorAttemptInput): Promise<void> {
    this.attempts.push({
      userId: input.userId,
      isCorrect: input.isCorrect,
      errorType: input.errorType ?? null,
      createdAt: new Date(this.now.getTime()),
    });
  }

  public async getRecentAttempts(userId: string, limit: number): Promise<Array<{ isCorrect: boolean; errorType: string | null; createdAt: Date }>> {
    const rows = this.attempts.filter((attempt) => attempt.userId === userId);
    return rows.slice(-limit);
  }

  public async getRecentErrorAttemptsWithTopic(
    userId: string,
    limit: number,
  ): Promise<Array<{ errorType: string | null; topicId: string | null; createdAt: Date }>> {
    const rows = this.attempts.filter((attempt) => attempt.userId === userId && !attempt.isCorrect);
    return rows.slice(-limit).map((attempt) => ({
      errorType: attempt.errorType ?? null,
      topicId: null,
      createdAt: attempt.createdAt,
    }));
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runCase(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`PASS: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    console.error(error instanceof Error ? error.message : error);
  }
}

async function main() {
  const userId = "user-1";
  const createHarness = () => {
    const repo = new InMemoryErrorRepo();
    const service = new ErrorEngineService({ repository: repo, graph: loadErrorGraph() });
    const submit = async (input: Omit<ErrorAttemptInput, "userId" | "questionId">) =>
      service.recordAttempt({
        userId,
        questionId: `q-${Math.random()}`,
        attemptId: undefined,
        ...input,
      });
    return { repo, submit };
  };

  await runCase("Error loop + decline => unstable", async () => {
    const { repo, submit } = createHarness();
    repo.setNow(new Date("2026-03-01T00:00:00.000Z"));
    for (let i = 0; i < 5; i += 1) {
      await submit({ isCorrect: true });
      repo.tick(1);
    }
    for (let i = 0; i < 5; i += 1) {
      await submit({ isCorrect: false, errorType: "Partial Knowledge Trap" });
      repo.tick(1);
    }
    const result = await submit({ isCorrect: false, errorType: "Partial Knowledge Trap" });
    assert(result.dominantError === "Partial Knowledge Trap", "dominantError missing");
    assert(result.trend === "declining", "trend not declining");
    assert(result.userState === "unstable", "userState not unstable");
  });

  await runCase("Stable streak => stable", async () => {
    const { repo, submit } = createHarness();
    repo.setNow(new Date("2026-03-02T00:00:00.000Z"));
    for (let i = 0; i < 10; i += 1) {
      await submit({ isCorrect: true });
      repo.tick(1);
    }
    const result = await submit({ isCorrect: true });
    assert(result.confidenceBand === "high", "confidenceBand not high");
    assert(result.userState === "stable", "userState not stable");
  });

  await runCase("Mixed errors => learning", async () => {
    const { repo, submit } = createHarness();
    repo.setNow(new Date("2026-03-03T00:00:00.000Z"));
    await submit({ isCorrect: false, errorType: "Memory Gap" });
    repo.tick(1);
    await submit({ isCorrect: false, errorType: "Concept Confusion" });
    repo.tick(1);
    const result = await submit({ isCorrect: false, errorType: "Fact Misassociation" });
    assert(result.dominantError === null, "dominantError should be null");
    assert(result.userState === "learning", "userState not learning");
  });

  await runCase("False confidence => avoid high band", async () => {
    const { repo, submit } = createHarness();
    repo.setNow(new Date("2026-03-04T00:00:00.000Z"));
    for (let i = 0; i < 5; i += 1) {
      await submit({ isCorrect: true });
      repo.tick(1);
    }
    for (let i = 0; i < 5; i += 1) {
      await submit({ isCorrect: false, errorType: "Fact Misassociation" });
      repo.tick(1);
    }
    const result = await submit({ isCorrect: false, errorType: "Fact Misassociation" });
    assert(result.trend === "declining", "trend not declining");
    assert(result.confidenceBand !== "high", "confidenceBand should not be high");
  });

  await runCase("Recovery => improving trend", async () => {
    const { repo, submit } = createHarness();
    repo.setNow(new Date("2026-03-05T00:00:00.000Z"));
    for (let i = 0; i < 5; i += 1) {
      await submit({ isCorrect: false, errorType: "Memory Gap" });
      repo.tick(1);
    }
    for (let i = 0; i < 5; i += 1) {
      await submit({ isCorrect: true });
      repo.tick(1);
    }
    const result = await submit({ isCorrect: true });
    assert(result.trend === "improving", "trend not improving");
  });

  await runCase("Flat stagnation => learning", async () => {
    const { repo, submit } = createHarness();
    repo.setNow(new Date("2026-03-06T00:00:00.000Z"));
    const sequence: Array<{ isCorrect: boolean; errorType?: string }> = [
      { isCorrect: true },
      { isCorrect: true },
      { isCorrect: false, errorType: "Memory Gap" },
      { isCorrect: true },
      { isCorrect: false, errorType: "Concept Confusion" },
      { isCorrect: true },
      { isCorrect: false, errorType: "Fact Misassociation" },
      { isCorrect: true },
      { isCorrect: false, errorType: "Partial Knowledge Trap" },
      { isCorrect: true },
    ];
    for (const entry of sequence) {
      await submit(entry);
      repo.tick(1);
    }
    const result = await submit({ isCorrect: true });
    assert(result.trend === "flat", "trend not flat");
    assert(result.userState === "learning", "userState not learning");
  });

  await runCase("High confidence but declining => focus_revision", async () => {
    const { repo, submit } = createHarness();
    repo.setNow(new Date("2026-03-07T00:00:00.000Z"));
    for (let i = 0; i < 5; i += 1) {
      await submit({ isCorrect: true });
      repo.tick(1);
    }
    const decliningErrors = ["Memory Gap", "Concept Confusion", "Fact Misassociation", "Partial Knowledge Trap", "Overgeneralization"];
    for (const errorType of decliningErrors) {
      await submit({ isCorrect: false, errorType });
      repo.tick(1);
    }
    const result = await submit({ isCorrect: false, errorType: "Misreading" });
    assert(result.trend === "declining", "trend not declining");
    assert(result.systemAction === "focus_revision", "systemAction not focus_revision");
  });
}

main().catch((error) => {
  console.error("Manual runner failed:");
  console.error(error);
  process.exitCode = 1;
});
