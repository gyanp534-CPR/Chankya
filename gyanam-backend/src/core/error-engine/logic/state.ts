export function computeUserState(
  confidenceScore: number | null,
  trend: "improving" | "declining" | "flat" | null,
  dominantError: string | null,
): "stable" | "learning" | "unstable" | "recovering" | null {
  if (confidenceScore !== null && confidenceScore < 40 && trend === "declining") {
    return "unstable";
  }
  if (dominantError && confidenceScore !== null && confidenceScore < 50) {
    return "unstable";
  }
  if (trend === "improving" && confidenceScore !== null && confidenceScore < 70) {
    return "recovering";
  }
  if (confidenceScore !== null && confidenceScore >= 80 && (trend === "improving" || trend === "flat")) {
    return "stable";
  }
  return "learning";
}

export function computeSystemAction(
  confidenceBand: "low" | "medium" | "high" | null,
  confidenceScore: number | null,
  trend: "improving" | "declining" | "flat" | null,
  dominantError: string | null,
  userState: "stable" | "learning" | "unstable" | "recovering" | null,
): "increase_difficulty" | "maintain_level" | "focus_revision" | "trigger_recovery" | null {
  if (confidenceScore !== null && confidenceScore < 35 && dominantError) {
    return "trigger_recovery";
  }
  if (userState === "recovering") {
    return "maintain_level";
  }
  if (userState === "learning" && confidenceBand === "low") {
    return "focus_revision";
  }
  if (trend === "declining") {
    return "focus_revision";
  }
  if (confidenceBand === "high" && (trend === "improving" || trend === "flat" || trend === null)) {
    return "increase_difficulty";
  }
  if (confidenceBand === "medium" && (trend === "flat" || trend === null)) {
    return "maintain_level";
  }
  return "maintain_level";
}
