import type { ErrorEngineUserState } from "../../error-engine/index.js";

export type MentorMode = "challenge" | "stabilize" | "revision" | "recovery";

export type MentorFocus = {
  topicId: string;
  topicLabel?: string;
  errorType: string | null;
};

export type MentorFeedback = {
  headline: string;
  message: string;
  mode: MentorMode;
  focus?: MentorFocus[];
  nextAction?: string;
};

type FeedbackInput = {
  state: ErrorEngineUserState;
  weakAreas?: MentorFocus[];
  verbosity?: "short" | "medium" | "long";
};

const MODE_COPY: Record<
  MentorMode,
  {
    headline: string;
    short: string;
    medium: string;
    long: string;
    nextAction?: string;
  }
> = {
  challenge: {
    headline: "You are ready for a push.",
    short: "Steady performance. Time to raise difficulty.",
    medium: "Your recent performance is steady. Let’s step up the difficulty to stretch your range.",
    long: "You are performing consistently, which means you can handle a tougher mix. Let’s raise difficulty to keep growth moving.",
    nextAction: "Move to a harder mixed set.",
  },
  stabilize: {
    headline: "Hold the line.",
    short: "Keep accuracy stable before the next jump.",
    medium: "Stay consistent and keep the accuracy stable before the next jump.",
    long: "You are close to a push, but we’ll stabilize first. Maintain accuracy so the next difficulty jump feels natural.",
    nextAction: "Maintain level with focused practice.",
  },
  revision: {
    headline: "Time for targeted revision.",
    short: "Revise weak areas with PYQ + traps.",
    medium: "We’ll tighten weak areas using PYQ-style traps and elimination practice.",
    long: "We’ve spotted recurring weak spots. We’ll focus on those topics using PYQ-based traps and elimination practice to lock the concepts.",
    nextAction: "Revise weak topics with PYQ + traps.",
  },
  recovery: {
    headline: "Reset and rebuild.",
    short: "Slow down and rebuild core clarity.",
    medium: "We’ll slow down to rebuild concept clarity and restore confidence.",
    long: "Your accuracy has dipped, so we’ll rebuild the core concepts first. A guided, easier set will restore momentum safely.",
    nextAction: "Start with guided easy-medium sets.",
  },
};

const ERROR_HINTS: Record<string, string> = {
  "Memory Gap": "Focus on recall with short spaced reviews.",
  "Partial Knowledge Trap": "Watch for elimination mistakes caused by partial recall.",
  "Concept Confusion": "Rebuild the core concept before speed.",
  "Fact Misassociation": "Separate similar facts with quick contrast notes.",
  "Incomplete Inference": "Slow down and validate multi-step reasoning.",
  Overgeneralization: "Check scope limits and exceptions.",
  Misreading: "Underline qualifiers and negatives before locking.",
  "Equation Setup Error": "Translate words into equations first.",
  "State Construction Failure": "Sketch a quick structure before solving.",
  "Step Skipping": "Write each step to avoid hidden jumps.",
};

function modeFromSystemAction(action: ErrorEngineUserState["systemAction"]): MentorMode {
  switch (action) {
    case "increase_difficulty":
      return "challenge";
    case "focus_revision":
      return "revision";
    case "trigger_recovery":
      return "recovery";
    case "maintain_level":
    default:
      return "stabilize";
  }
}

export function buildMentorFeedback(input: FeedbackInput): MentorFeedback {
  const mode = modeFromSystemAction(input.state.systemAction);
  const copy = MODE_COPY[mode];
  const verbosity = input.verbosity ?? "medium";
  const focus = (input.weakAreas ?? []).filter((area) => Boolean(area.topicId));
  const hintSource = focus.find((area) => area.errorType)?.errorType ?? null;
  const hint = hintSource ? ERROR_HINTS[hintSource] : null;
  const baseMessage = copy[verbosity];
  const message = hint ? `${baseMessage} ${hint}` : baseMessage;

  return {
    headline: copy.headline,
    message,
    mode,
    focus: focus.length > 0 ? focus : undefined,
    nextAction: copy.nextAction,
  };
}
