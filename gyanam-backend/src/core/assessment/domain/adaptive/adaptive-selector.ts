import type { AdaptiveStrategy, SystemAction, WeakArea } from "./adaptive-types.js";

export function resolveAdaptiveStrategy(input: {
  systemAction?: SystemAction | null;
  weakAreas?: WeakArea[];
}): AdaptiveStrategy {
  switch (input.systemAction) {
    case "increase_difficulty":
      return {
        difficultyMix: { easy: 0.2, medium: 0.4, hard: 0.4 },
        mode: "multi_concept",
      };
    case "focus_revision":
      return {
        difficultyMix: { easy: 0.4, medium: 0.4, hard: 0.2 },
        questionType: "pyq + traps",
        topics: input.weakAreas?.slice(0, 2),
      };
    case "trigger_recovery":
      return {
        difficultyMix: { easy: 0.7, medium: 0.3, hard: 0 },
        mode: "guided",
        skillFocus: ["concept clarity", "elimination"],
      };
    case "maintain_level":
    default:
      return {};
  }
}
