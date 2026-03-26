import type { NormalizedPyqRecord } from "./pyq-review-utils.js";

export type AnswerOption = "A" | "B" | "C" | "D";
export type AnswerStatus =
  | "pending"
  | "ai_provisional"
  | "provisional_correct"
  | "official_confirmed"
  | "dropped"
  | "conflict";

export type PyqEnrichmentRecord = {
  id: string;
  subject?: string;
  subjectSuggestion?: string;
  subjectConfidence?: number;
  subjectStatus?: "pending" | "auto_inferred" | "manual";
  correctAnswer?: AnswerOption | null;
  aiProposedAnswer?: AnswerOption | null;
  aiProposalSource?: string;
  referenceAnswer?: AnswerOption | null;
  referenceSource?: string;
  answerStatus?: AnswerStatus;
  answerSource?: string;
  notes?: string;
};

export type AnswerProposalRecord = {
  id: string;
  proposedAnswer?: AnswerOption | null;
  source?: string;
  confidence?: number | null;
  rationale?: string;
  notes?: string;
};

export type AnswerReferenceRecord = {
  id: string;
  referenceAnswer?: AnswerOption | null;
  source?: string;
  sourceType?: "coaching" | "official" | "manual";
  publishedAt?: string;
  notes?: string;
};

type AnswerProposalMapValue =
  | AnswerOption
  | {
      proposedAnswer?: AnswerOption | null;
      source?: string;
      confidence?: number | null;
      rationale?: string;
      notes?: string;
    };

type AnswerReferenceMapValue =
  | AnswerOption
  | "dropped"
  | {
      referenceAnswer?: AnswerOption | null;
      source?: string;
      sourceType?: "coaching" | "official" | "manual";
      publishedAt?: string;
      notes?: string;
      dropped?: boolean;
    };

type SubjectRule = {
  subject: string;
  keywords: string[];
};

const SUBJECT_RULES: SubjectRule[] = [
  {
    subject: "Polity",
    keywords: [
      "constitution",
      "constitutional",
      "president of india",
      "parliament",
      "money bill",
      "finance bill",
      "governor general",
      "scheduled areas",
      "community reserve",
      "article ",
      "electoral college",
      "fundamental rights",
      "preventive detention",
    ],
  },
  {
    subject: "Economy",
    keywords: [
      "reserve bank",
      "rbi",
      "capital markets",
      "finance commission",
      "minimum support price",
      "central bank",
      "carbon markets",
      "invit",
      "fiscal",
      "tax devolution",
      "gst",
      "green hydrogen",
      "micro, small and medium enterprises",
      "beta",
      "self-help group",
    ],
  },
  {
    subject: "Environment",
    keywords: [
      "biodiversity",
      "nagoya protocol",
      "wetland",
      "microorganisms",
      "mercury pollution",
      "green hydrogen",
      "carbon capture",
      "carbon sequestration",
      "wolbachia",
      "biofilters",
      "mangroves",
      "marshland",
      "hydrofluorocarbons",
      "climate change",
    ],
  },
  {
    subject: "History",
    keywords: [
      "ancient india",
      "ancient south india",
      "sangam",
      "vijayanagara",
      "medieval gujarat",
      "swadeshi movement",
      "constitution day",
      "indian history",
      "buddhist",
      "jain",
      "mahasanghikas",
      "korkai",
      "poompuhar",
      "muchiri",
    ],
  },
  {
    subject: "Geography",
    keywords: [
      "river",
      "lake",
      "monsoon",
      "climate",
      "equator",
      "congo basin",
      "vindhya",
      "western ghats",
      "marshland",
      "sea level",
      "ukraine",
      "sahara",
      "groundwater",
      "tropical rain forests",
      "atmosphere",
    ],
  },
  {
    subject: "Science & Technology",
    keywords: [
      "satellite",
      "accelerometer",
      "microsatellite dna",
      "aerial metagenomics",
      "seismograph",
      "ballistic missiles",
      "cruise missiles",
      "digital currency",
      "dna",
      "stem cells",
      "space",
      "chess olympiad",
    ],
  },
];

function buildHaystack(row: NormalizedPyqRecord) {
  return `${row.questionText} ${row.options.join(" ")}`.toLowerCase();
}

export function suggestSubject(row: NormalizedPyqRecord) {
  const haystack = buildHaystack(row);
  const scores = SUBJECT_RULES.map((rule) => ({
    subject: rule.subject,
    score: rule.keywords.reduce((acc, keyword) => (haystack.includes(keyword) ? acc + 1 : acc), 0),
  })).filter((entry) => entry.score > 0);

  scores.sort((a, b) => b.score - a.score || a.subject.localeCompare(b.subject));
  const best = scores[0];
  const second = scores[1];

  if (!best) {
    return { subject: undefined, confidence: 0 };
  }

  if (best.score >= 2 && (!second || best.score > second.score)) {
    return { subject: best.subject, confidence: best.score };
  }

  if (best.score >= 3) {
    return { subject: best.subject, confidence: best.score };
  }

  return { subject: undefined, confidence: best.score };
}

export function normalizeAnswerOption(value: string | null | undefined): AnswerOption | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "A" || normalized === "B" || normalized === "C" || normalized === "D") {
    return normalized;
  }

  return null;
}

function isDroppedToken(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized === "dropped" || normalized === "drop" || normalized === "x";
}

export function reconcileAnswerEvidence(input: {
  current?: PyqEnrichmentRecord | undefined;
  proposal?: AnswerProposalRecord | undefined;
  reference?: AnswerReferenceRecord | undefined;
}) {
  const proposalAnswer = normalizeAnswerOption(input.proposal?.proposedAnswer);
  const referenceAnswer = normalizeAnswerOption(input.reference?.referenceAnswer);
  const current = input.current;
  const referenceType = input.reference?.sourceType;
  const referenceDropped = input.reference?.notes?.toLowerCase().includes("dropped") ?? false;

  const next: Pick<
    PyqEnrichmentRecord,
    | "correctAnswer"
    | "aiProposedAnswer"
    | "aiProposalSource"
    | "referenceAnswer"
    | "referenceSource"
    | "answerStatus"
    | "answerSource"
  > = {
    correctAnswer: current?.correctAnswer ?? null,
    aiProposedAnswer: proposalAnswer ?? current?.aiProposedAnswer ?? null,
    aiProposalSource: input.proposal?.source ?? current?.aiProposalSource,
    referenceAnswer: referenceAnswer ?? current?.referenceAnswer ?? null,
    referenceSource: input.reference?.source ?? current?.referenceSource,
    answerStatus: current?.answerStatus ?? "pending",
    answerSource: current?.answerSource,
  };

  if (referenceAnswer && referenceType === "official") {
    next.correctAnswer = referenceAnswer;
    next.answerStatus = "official_confirmed";
    next.answerSource = input.reference?.source ?? "official_reference";
    return next;
  }

  if (referenceDropped && referenceType === "official") {
    next.correctAnswer = null;
    next.answerStatus = "dropped";
    next.answerSource = input.reference?.source ?? "official_reference";
    return next;
  }

  if (proposalAnswer && referenceAnswer) {
    if (proposalAnswer === referenceAnswer) {
      next.correctAnswer = proposalAnswer;
      next.answerStatus = "provisional_correct";
      next.answerSource = input.reference?.source ?? input.proposal?.source ?? "verified_reference";
      return next;
    }

    next.correctAnswer = null;
    next.answerStatus = "conflict";
    next.answerSource = undefined;
    return next;
  }

  if (proposalAnswer) {
    next.correctAnswer = proposalAnswer;
    next.answerStatus = "ai_provisional";
    next.answerSource = input.proposal?.source ?? "ai_provisional";
    return next;
  }

  if (referenceAnswer) {
    next.correctAnswer = referenceAnswer;
    next.answerStatus = "provisional_correct";
    next.answerSource = input.reference?.source ?? "reference_only";
    return next;
  }

  next.correctAnswer = null;
  next.answerStatus = "pending";
  next.answerSource = undefined;
  return next;
}

export function parseAnswerProposalRows(payload: unknown): AnswerProposalRecord[] {
  if (Array.isArray(payload)) {
    return payload as AnswerProposalRecord[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  return Object.entries(payload as Record<string, AnswerProposalMapValue>).map(([id, value]) => {
    if (typeof value === "string") {
      return {
        id,
        proposedAnswer: normalizeAnswerOption(value),
        source: "",
        confidence: null,
        rationale: "",
        notes: "",
      } satisfies AnswerProposalRecord;
    }

    return {
      id,
      proposedAnswer: normalizeAnswerOption(value?.proposedAnswer),
      source: value?.source ?? "",
      confidence: value?.confidence ?? null,
      rationale: value?.rationale ?? "",
      notes: value?.notes ?? "",
    } satisfies AnswerProposalRecord;
  });
}

export function parseAnswerReferenceRows(payload: unknown): AnswerReferenceRecord[] {
  if (Array.isArray(payload)) {
    return payload as AnswerReferenceRecord[];
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  return Object.entries(payload as Record<string, AnswerReferenceMapValue>).map(([id, value]) => {
    if (typeof value === "string") {
      if (isDroppedToken(value)) {
        return {
          id,
          referenceAnswer: null,
          source: "",
          sourceType: "official",
          publishedAt: "",
          notes: "dropped",
        } satisfies AnswerReferenceRecord;
      }

      return {
        id,
        referenceAnswer: normalizeAnswerOption(value),
        source: "",
        sourceType: "coaching",
        publishedAt: "",
        notes: "",
      } satisfies AnswerReferenceRecord;
    }

    return {
      id,
      referenceAnswer: normalizeAnswerOption(value?.referenceAnswer),
      source: value?.source ?? "",
      sourceType: value?.sourceType ?? "coaching",
      publishedAt: value?.publishedAt ?? "",
      notes: value?.dropped ? "dropped" : (value?.notes ?? ""),
    } satisfies AnswerReferenceRecord;
  });
}
