import type { TrapType } from "../../mentor-engine/index.js";

export type QuestionExplanation = {
  correctOption: string;
  concept?: string;
  trapType?: TrapType;
  whyCorrect?: string;
  whyWrong?: Record<string, string>;
  trapInsight?: string;
};

export type AttemptFeedback = {
  isCorrect: boolean;
  chosen: string | null;
  correct: string | null;
  trapType?: TrapType | null;
  trapInsight?: string | null;
  whyWrong?: string | null;
  whyCorrect?: string | null;
  strategy?: string | null;
  correctThinking?: string | null;
};

export function trapInsight(trap: TrapType): string {
  switch (trap) {
    case "hidden_constraint":
      return "You missed a key condition in the question";
    case "option_elimination":
      return "You did not eliminate incorrect options step-by-step";
    case "overgeneralization":
      return "You applied a rule without checking its conditions";
    case "concept_confusion":
      return "Your core concept understanding needs revision";
    default:
      return "Practice targeted questions";
  }
}

export function trapStrategy(trap: TrapType): string {
  switch (trap) {
    case "hidden_constraint":
      return "Slow down and identify constraints before solving";
    case "option_elimination":
      return "Eliminate incorrect options step-by-step";
    case "overgeneralization":
      return "Avoid applying shortcuts without validating conditions";
    case "concept_confusion":
      return "Revisit core concept definitions before attempting questions";
    default:
      return "Practice targeted questions";
  }
}

export function buildAttemptFeedback(params: {
  options: string[];
  selectedIndex: number | null;
  correctIndex: number | null;
  explanation?: QuestionExplanation | null;
  trapType?: TrapType | null;
}): AttemptFeedback {
  const chosen =
    params.selectedIndex !== null && params.selectedIndex >= 0
      ? params.options[params.selectedIndex] ?? null
      : null;
  const correct =
    params.explanation?.correctOption ??
    (params.correctIndex !== null && params.correctIndex >= 0
      ? params.options[params.correctIndex] ?? null
      : null);

  const trap = params.explanation?.trapType ?? params.trapType ?? null;
  const wrongReason = chosen && params.explanation?.whyWrong
    ? params.explanation.whyWrong[chosen] ?? null
    : null;

  return {
    isCorrect: params.selectedIndex !== null && params.correctIndex !== null && params.selectedIndex === params.correctIndex,
    chosen,
    correct,
    trapType: trap,
    trapInsight: trap ? trapInsight(trap) : params.explanation?.trapInsight ?? null,
    whyWrong: wrongReason,
    whyCorrect: params.explanation?.whyCorrect ?? null,
    strategy: trap ? trapStrategy(trap) : null,
    correctThinking: params.explanation?.whyCorrect ?? (trap ? trapStrategy(trap) : null),
  };
}
