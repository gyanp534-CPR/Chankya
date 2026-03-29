export type PostAttemptResponse = {
  headline: string;
  message: string;
  focus: string[];
  nextAction: {
    label: string;
    actionType: "revise" | "practice" | "challenge";
    topic?: string;
    concept?: string;
    conceptId?: string;
    trapType?: "hidden_constraint" | "option_elimination" | "overgeneralization" | "concept_confusion" | null;
    strategy?: string;
    errorType?: string;
    severity?: "low" | "medium" | "high";
  };
  mode: "challenge" | "revision" | "recovery" | "stabilize";
  explanation?: {
    reason: string;
    signals: {
      accuracy: number;
      weakTopics: number;
      trend: string;
    };
    pattern?: string;
  };
  mentorFeedback?: {
    focus: string[];
  };
};
