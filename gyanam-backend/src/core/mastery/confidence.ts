import type { ConfidenceBand } from "./types.js";

export function computeConfidenceBand(input: {
  dataPointsUsed: number;
  recencyDensity: number;
  consistencyFactor: number;
}): ConfidenceBand {
  if (input.dataPointsUsed < 20) {
    return "low";
  }

  if (input.dataPointsUsed > 60 && input.recencyDensity >= 0.3 && input.consistencyFactor >= 0.6) {
    return "high";
  }

  return "medium";
}
