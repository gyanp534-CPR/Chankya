import { computeMasteryResults } from "./mastery-engine.js";
import { MODEL_VERSION, type RecomputeReason } from "./constants.js";
import type {
  MasteryEngineOptions,
  MasteryRepository,
  MasteryResult,
  RevisionRepository,
  WeakAreaRepository,
} from "./types.js";

export type MasteryServiceDeps = {
  repository: MasteryRepository;
  weakAreas?: WeakAreaRepository;
  revision?: RevisionRepository;
};

export class MasteryService {
  public constructor(private readonly deps: MasteryServiceDeps) {}

  public async recomputeForUser(
    userId: string,
    recomputeReason: RecomputeReason = "attempt_submission",
    context: {
      computedAt?: Date;
      sourceAttemptId?: string;
      options?: MasteryEngineOptions;
    } = {},
  ): Promise<MasteryResult[]> {
    if (context.sourceAttemptId) {
      const alreadyComputed = await this.deps.repository.hasHistoryForSourceAttempt(
        userId,
        context.sourceAttemptId,
      );
      if (alreadyComputed) {
        return [];
      }
    }

    const signals = await this.deps.repository.getUserTopicSignals(userId);
    const results = computeMasteryResults({
      signals,
      options: {
        ...context.options,
        asOf: context.computedAt ?? context.options?.asOf ?? new Date(),
      },
    });

    if (results.length === 0) {
      return [];
    }

    await this.deps.repository.appendHistory(
      results.map((result) => ({
        ...result,
        userId,
        computedAt: context.computedAt ?? new Date(),
        modelVersion: MODEL_VERSION,
        recomputeReason,
        sourceAttemptId: context.sourceAttemptId,
      })),
    );

    const weakResults = results.filter(
      (result) => result.finalMastery < 50 && result.confidence !== "low",
    );
    const weakTopicIds = weakResults.map((result) => result.topicId);
    for (const weakResult of weakResults) {
      await this.deps.weakAreas?.upsertWeakArea(userId, weakResult.topicId, weakResult.finalMastery);
    }
    await this.deps.weakAreas?.deleteWeakAreasNotInList(userId, weakTopicIds);

    const now = context.computedAt ?? new Date();
    const openTasks = await this.deps.revision?.findOpenTasks(userId);
    const openTopicIds = new Set((openTasks ?? []).map((task) => task.topicId));
    const weakTopicIdSet = new Set(weakTopicIds);

    for (const weakTopicId of weakTopicIds) {
      if (!openTopicIds.has(weakTopicId)) {
        await this.deps.revision?.createRevisionTask(
          userId,
          weakTopicId,
          new Date(now.getTime() + 48 * 60 * 60 * 1000),
        );
        await this.deps.revision?.createRevisionTask(
          userId,
          weakTopicId,
          new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        );
      }
    }

    for (const openTopicId of openTopicIds) {
      if (!weakTopicIdSet.has(openTopicId)) {
        await this.deps.revision?.deleteFutureTasksForTopic(userId, openTopicId, now);
      }
    }

    return results;
  }

  public async recomputeForAllUsers(): Promise<void> {
    const userIds = await this.deps.repository.getAllUserIdsWithAttempts();
    for (const userId of userIds) {
      await this.recomputeForUser(userId, "manual_recompute");
    }
  }
}
