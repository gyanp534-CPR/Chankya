export type SystemAction = "increase_difficulty" | "maintain_level" | "focus_revision" | "trigger_recovery";

export type DifficultyMix = {
  easy: number;
  medium: number;
  hard: number;
};

export type WeakArea = {
  topicId: string;
  errorType: string | null;
  frequency: number;
  lastSeen: string;
};

export type AdaptiveStrategy = {
  difficultyMix?: DifficultyMix;
  mode?: "guided" | "multi_concept";
  questionType?: "pyq + traps";
  skillFocus?: Array<"concept clarity" | "elimination">;
  topics?: WeakArea[];
};
