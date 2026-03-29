export type PracticeMode = "challenge" | "revision" | "recovery" | "stabilize";

export type AttemptMetrics = {
  accuracy: number;
  correct: number;
  incorrect: number;
  total: number;
  weakTopics: string[];
  errorCount: number;
  recentTrend: "up" | "down" | "flat";
  confidenceBand?: "low" | "medium" | "high" | null;
};

export type ErrorType = "concept" | "misreading" | "calculation" | "time-pressure";

export type TrapType =
  | "hidden_constraint"
  | "option_elimination"
  | "overgeneralization"
  | "concept_confusion";

export type ErrorSignal = {
  type: ErrorType;
  topic: string;
  conceptId?: string;
  conceptName?: string;
};

export type ModeExplanation = {
  reason: string;
  signals: {
    accuracy: number;
    weakTopics: number;
    trend: "up" | "down" | "flat";
  };
  pattern?: string;
};

export const ERROR_WEIGHTS: Record<ErrorType, number> = {
  concept: 3,
  misreading: 2,
  calculation: 1,
  "time-pressure": 2,
};

export type WeightedError = {
  key: string;
  score: number;
  count: number;
  type: ErrorType;
  topic: string;
  conceptId?: string;
  conceptName?: string;
};

export type UserErrorState = {
  key: string;
  strength: number;
  lastSeenAt: Date;
};

export interface UserErrorMemoryRepository {
  getUserErrorMemory(userId: string): Promise<UserErrorState[]>;
  upsertUserErrorMemory(userId: string, state: UserErrorState[]): Promise<void>;
}

export function deriveMode(metrics: AttemptMetrics, prevMode?: PracticeMode | null): PracticeMode {
  const { accuracy, weakTopics, errorCount, total, recentTrend, confidenceBand } = metrics;
  const errorRate = total > 0 ? errorCount / total : 0;

  if (recentTrend === "up" && confidenceBand === "high") {
    return "stabilize";
  }

  if (accuracy < 40 || errorRate > 0.6 || (prevMode === "recovery" && accuracy < 55)) {
    return "recovery";
  }

  if (weakTopics.length >= 3 || (prevMode === "revision" && weakTopics.length >= 2)) {
    return "revision";
  }

  if (accuracy >= 75 && recentTrend === "up") {
    return "challenge";
  }

  if (accuracy >= 60 && recentTrend === "flat") {
    return "stabilize";
  }

  return "revision";
}

export function deriveModeWithReason(
  metrics: AttemptMetrics,
  prevMode?: PracticeMode | null,
): { mode: PracticeMode; explanation: ModeExplanation } {
  const mode = deriveMode(metrics, prevMode);
  let reason = "";

  if (mode === "recovery") {
    reason = "Low accuracy or high error rate detected";
  } else if (mode === "revision") {
    reason = "Multiple weak topics identified";
  } else if (mode === "challenge") {
    reason = "Strong performance with improving trend";
  } else {
    reason = "Stable performance - reinforcing consistency";
  }

  return {
    mode,
    explanation: {
      reason,
      signals: {
        accuracy: metrics.accuracy,
        weakTopics: metrics.weakTopics.length,
        trend: metrics.recentTrend,
      },
    },
  };
}

function aggregateErrors(errors: ErrorSignal[]) {
  const map = new Map<string, number>();
  for (const error of errors) {
    const key = `${error.type}-${error.topic}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2);
}

export type NextAction = {
  label: string;
  actionType: "revise" | "practice" | "challenge";
  topic?: string;
  concept?: string;
  conceptId?: string;
  trapType?: TrapType | null;
  strategy?: string;
  errorType?: ErrorType;
  severity?: "low" | "medium" | "high";
};

function mapErrorToTrap(errorType: ErrorType): TrapType | null {
  switch (errorType) {
    case "misreading":
      return "hidden_constraint";
    case "concept":
      return "concept_confusion";
    case "calculation":
      return "overgeneralization";
    case "time-pressure":
      return "option_elimination";
    default:
      return null;
  }
}

export function trapReadable(trap?: TrapType | null): string {
  switch (trap) {
    case "hidden_constraint":
      return "hidden constraint";
    case "option_elimination":
      return "option elimination";
    case "overgeneralization":
      return "overgeneralization";
    case "concept_confusion":
      return "concept clarity";
    default:
      return "targeted";
  }
}

export function trapToStrategy(trap: TrapType): string {
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

export function scoreErrors(errors: ErrorSignal[]): WeightedError[] {
  const map = new Map<string, WeightedError>();
  for (const error of errors) {
    const key = `${error.type}-${error.topic}-${error.conceptId ?? error.conceptName ?? "none"}`;
    const weight = ERROR_WEIGHTS[error.type];
    if (!map.has(key)) {
      map.set(key, {
        key,
        score: 0,
        count: 0,
        type: error.type,
        topic: error.topic,
        conceptId: error.conceptId,
        conceptName: error.conceptName,
      });
    }
    const item = map.get(key)!;
    item.count += 1;
    item.score += weight;
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}

function updateStrength(prev: number, increment: number) {
  const decay = prev * 0.85;
  const added = increment * 5;
  return Math.min(100, decay + added);
}

export function updateUserErrorState(
  prevState: UserErrorState[],
  session: WeightedError[],
): UserErrorState[] {
  const map = new Map(prevState.map((state) => [state.key, state]));
  for (const error of session.slice(0, 3)) {
    const prev = map.get(error.key);
    let nextStrength = updateStrength(prev?.strength ?? 0, error.score);
    if (!prev) {
      nextStrength = Math.min(100, nextStrength + 25);
    }
    map.set(error.key, {
      key: error.key,
      strength: nextStrength,
      lastSeenAt: new Date(),
    });
  }
  return [...map.values()];
}

export function capUserErrorState(state: UserErrorState[], limit = 20): UserErrorState[] {
  return [...state]
    .sort((a, b) => b.strength - a.strength)
    .slice(0, limit);
}

function classifySeverity(strength: number) {
  if (strength >= 70) {
    return "high";
  }
  if (strength >= 40) {
    return "medium";
  }
  return "low";
}

export type ErrorPattern = {
  type: "repeat_error" | "persistent_error";
  key: string;
  message: string;
};

export type MemoryPriority = "urgent" | "reinforce" | "ignore";

export type DailyFocusItem = {
  key: string;
  errorType: ErrorType;
  topic: string;
  conceptId?: string;
  trapType?: TrapType | null;
  priority: MemoryPriority;
  strength?: number;
  lastSeenAt?: Date;
  reason?: string;
};

type ParsedMemoryKey = {
  errorType: ErrorType;
  topic: string;
  conceptId?: string;
};

function parseMemoryKey(key: string): ParsedMemoryKey | null {
  const errorTypes: ErrorType[] = ["concept", "misreading", "calculation", "time-pressure"];
  const match = errorTypes.find((type) => key.startsWith(`${type}-`));
  if (!match) {
    return null;
  }

  const remainder = key.slice(match.length + 1);
  const parts = remainder.split("-");
  if (parts.length <= 1) {
    return { errorType: match, topic: remainder };
  }

  const last = parts[parts.length - 1] ?? "";
  const looksLikeId = /^c[a-z0-9]{10,}$/i.test(last) || last === "none";
  if (looksLikeId) {
    const topic = parts.slice(0, -1).join("-");
    return { errorType: match, topic, conceptId: last === "none" ? undefined : last };
  }

  return { errorType: match, topic: remainder };
}

function applyInactivityDecay(state: UserErrorState[], now: Date, days = 3): UserErrorState[] {
  const thresholdMs = days * 24 * 60 * 60 * 1000;
  return state.map((entry) => {
    const lastSeen = entry.lastSeenAt instanceof Date ? entry.lastSeenAt : new Date(entry.lastSeenAt);
    const shouldDecay = now.getTime() - lastSeen.getTime() > thresholdMs;
    if (!shouldDecay) {
      return entry;
    }
    return {
      ...entry,
      strength: Math.max(0, entry.strength * 0.7),
    };
  });
}

function classifyStrength(strength: number): MemoryPriority {
  if (strength >= 25) {
    return "urgent";
  }
  if (strength >= 10) {
    return "reinforce";
  }
  return "ignore";
}

function buildReason(item: { errorType: ErrorType; topic: string; trapType?: TrapType | null }): string {
  if (item.trapType) {
    return `You repeatedly made ${trapReadable(item.trapType)} errors in ${item.topic}`;
  }
  return `You repeatedly struggled with ${item.errorType} errors in ${item.topic}`;
}

export async function getDailyFocus(params: {
  userId: string;
  repository: UserErrorMemoryRepository;
  now?: Date;
  trend?: "improving" | "declining" | "flat" | null;
  confidenceBand?: "low" | "medium" | "high" | null;
}): Promise<DailyFocusItem[]> {
  const now = params.now ?? new Date();
  const prevState = await params.repository.getUserErrorMemory(params.userId);
  const decayed = applyInactivityDecay(prevState, now);
  await params.repository.upsertUserErrorMemory(params.userId, capUserErrorState(decayed));

  const items = decayed
    .map((entry) => {
      const parsed = parseMemoryKey(entry.key);
      if (!parsed) {
        return null;
      }
      const trapType = mapErrorToTrap(parsed.errorType);
      const lastSeenAt = entry.lastSeenAt instanceof Date ? entry.lastSeenAt : new Date(entry.lastSeenAt);
      let priority = classifyStrength(entry.strength);
      if (params.trend === "improving" && params.confidenceBand === "high" && priority === "urgent") {
        priority = "reinforce";
      }
      return {
        key: entry.key,
        errorType: parsed.errorType,
        topic: parsed.topic,
        conceptId: parsed.conceptId,
        trapType,
        priority,
        strength: entry.strength,
        lastSeenAt,
        reason: buildReason({ errorType: parsed.errorType, topic: parsed.topic, trapType }),
      } as DailyFocusItem;
    })
    .filter((item): item is DailyFocusItem => Boolean(item))
    .filter((item) => item.priority !== "ignore")
    .sort((a, b) => {
      const rank = (value: MemoryPriority) => (value === "urgent" ? 2 : value === "reinforce" ? 1 : 0);
      const priorityDiff = rank(b.priority) - rank(a.priority);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      const aSeen = a.lastSeenAt ? a.lastSeenAt.getTime() : 0;
      const bSeen = b.lastSeenAt ? b.lastSeenAt.getTime() : 0;
      if (aSeen !== bSeen) {
        return bSeen - aSeen;
      }
      return (b.strength ?? 0) - (a.strength ?? 0);
    });

  if (items.length === 0) {
    return [
      {
        key: "mixed_revision",
        errorType: "concept",
        topic: "General",
        priority: "reinforce",
        reason: "Keep momentum with a mixed practice set",
      },
    ];
  }

  const urgentItems = items.filter((item) => item.priority === "urgent");
  const topUrgent = urgentItems[0];
  if (topUrgent) {
    return [topUrgent];
  }

  return items.slice(0, 3);
}

export function detectRepeatPattern(sessionErrors: WeightedError[]): ErrorPattern | null {
  const top = sessionErrors[0];
  if (!top) {
    return null;
  }
  if (top.count >= 3) {
    return {
      type: "repeat_error",
      key: top.key,
      message: "You are repeatedly making the same mistake",
    };
  }
  return null;
}

export function detectPersistentPattern(userState: UserErrorState[]): ErrorPattern | null {
  const high = userState.find((state) => state.strength >= 80);
  if (!high) {
    return null;
  }
  return {
    type: "persistent_error",
    key: high.key,
    message: "This is a recurring weak area",
  };
}

export function detectPatterns(
  sessionErrors: WeightedError[],
  userState: UserErrorState[],
): ErrorPattern[] {
  const persistent = detectPersistentPattern(userState);
  const repeat = detectRepeatPattern(sessionErrors);
  return [persistent, repeat].filter((pattern): pattern is ErrorPattern => Boolean(pattern));
}

export function deriveNextActionV2(
  mode: PracticeMode,
  sessionErrors: WeightedError[],
  userState: UserErrorState[],
): NextAction {
  const [top] = sessionErrors;

  if (!top) {
    return { label: "Practice mixed set", actionType: "practice" };
  }

  const state = userState.find((entry) => entry.key === top.key);
  const severity = classifySeverity(state?.strength ?? top.score * 10);
  const target = top.conceptName ? `${top.conceptName} (${top.topic})` : top.topic;
  const trap = mapErrorToTrap(top.type);

  if (severity === "high") {
    return {
      label: `Rebuild ${target} fundamentals (${top.type})`,
      actionType: "revise",
      topic: top.topic,
      concept: top.conceptName,
      conceptId: top.conceptId,
      trapType: trap,
      strategy: trap ? trapToStrategy(trap) : undefined,
      errorType: top.type,
      severity,
    };
  }

  if (severity === "medium") {
    return {
      label: trap ? `Fix ${trapReadable(trap)} errors in ${target}` : `Fix ${top.type} errors in ${target}`,
      actionType: "practice",
      topic: top.topic,
      concept: top.conceptName,
      conceptId: top.conceptId,
      trapType: trap,
      strategy: trap ? trapToStrategy(trap) : undefined,
      errorType: top.type,
      severity,
    };
  }

  if (mode === "challenge") {
    return {
      label: "Attempt higher difficulty set",
      actionType: "challenge",
    };
  }

  return { label: "Practice mixed set to stabilize", actionType: "practice", severity };
}

export function deriveNextActionV3(
  mode: PracticeMode,
  sessionErrors: WeightedError[],
  userState: UserErrorState[],
): NextAction {
  const patterns = detectPatterns(sessionErrors, userState);
  const top = sessionErrors[0];
  const target = top?.conceptName ? `${top.conceptName} (${top.topic})` : top?.topic;
  const trap = top ? mapErrorToTrap(top.type) : null;

  if (patterns.find((pattern) => pattern.type === "persistent_error") && top) {
    return {
      label: `Rebuild ${target} fundamentals`,
      actionType: "revise",
      topic: top.topic,
      concept: top.conceptName,
      conceptId: top.conceptId,
      trapType: trap,
      strategy: trap ? trapToStrategy(trap) : undefined,
      errorType: top.type,
      severity: "high",
    };
  }

  if (patterns.find((pattern) => pattern.type === "repeat_error") && top) {
    return {
      label: trap
        ? `Fix ${trapReadable(trap)} errors in ${target}`
        : `Break ${top.type} mistake pattern in ${target}`,
      actionType: "revise",
      topic: top.topic,
      concept: top.conceptName,
      conceptId: top.conceptId,
      trapType: trap,
      strategy: trap ? trapToStrategy(trap) : undefined,
      errorType: top.type,
      severity: "high",
    };
  }

  return deriveNextActionV2(mode, sessionErrors, userState);
}

export async function runMentorEngine(params: {
  userId: string;
  metrics: AttemptMetrics;
  prevMode?: PracticeMode | null;
  errorSignals: ErrorSignal[];
  repository: UserErrorMemoryRepository;
}) {
  const sessionErrors = scoreErrors(params.errorSignals);
  const prevState = await params.repository.getUserErrorMemory(params.userId);
  const shouldDecayOnCorrect = params.metrics.incorrect === 0 && params.metrics.correct > 0;
  const baseState = shouldDecayOnCorrect
    ? prevState.map((entry) => ({
        ...entry,
        strength: Math.max(0, entry.strength * 0.85),
      }))
    : updateUserErrorState(prevState, sessionErrors);
  const nextState = capUserErrorState(baseState);
  await params.repository.upsertUserErrorMemory(params.userId, nextState);

  const patterns = detectPatterns(sessionErrors, nextState);
  const modeResult = deriveModeWithReason(params.metrics, params.prevMode);
  const nextAction = deriveNextActionV3(modeResult.mode, sessionErrors, nextState);

  return {
    mode: modeResult.mode,
    explanation: {
      ...modeResult.explanation,
      pattern: patterns[0]?.message,
    },
    nextAction,
    patterns,
    sessionErrors,
    userErrorState: nextState,
  };
}
