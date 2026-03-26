import type { ConceptPerformanceRepository } from "./types.js";

export type ConceptPerformanceServiceDeps = {
  repository: ConceptPerformanceRepository;
};

export class ConceptPerformanceService {
  public constructor(private readonly deps: ConceptPerformanceServiceDeps) {}

  public async updateForAttempt(userId: string, attemptId: string): Promise<void> {
    const aggregates = await this.deps.repository.aggregateSignalsForAttempt(attemptId);
    await this.deps.repository.applyAggregates(userId, aggregates);
  }
}
