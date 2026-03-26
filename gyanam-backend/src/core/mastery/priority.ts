export function computePriorityScore(masteryScore: number, frequencyScore: number): number {
  const boundedMastery = Math.min(Math.max(masteryScore, 0), 100);
  const boundedFrequency = Math.max(1, frequencyScore);
  return Math.round((100 - boundedMastery) * boundedFrequency);
}
