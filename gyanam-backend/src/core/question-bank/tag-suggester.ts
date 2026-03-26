export type ConceptKeyword = {
  conceptId: string;
  keywords: string[];
};

export type ConceptSuggestion = {
  conceptId: string;
  confidence: number;
  matchedKeywords: string[];
};

export type SuggestOptions = {
  maxTags?: number;
  minConfidence?: number;
};

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

export function suggestConcepts(
  questionText: string,
  conceptKeywords: ConceptKeyword[],
  options: SuggestOptions = {},
): ConceptSuggestion[] {
  const maxTags = options.maxTags ?? 3;
  const minConfidence = options.minConfidence ?? 0.65;
  const normalizedQuestion = normalize(questionText);

  const scored: ConceptSuggestion[] = [];

  for (const concept of conceptKeywords) {
    if (concept.keywords.length === 0) {
      continue;
    }

    const matched = concept.keywords
      .map((keyword) => normalize(keyword))
      .filter((keyword) => normalizedQuestion.includes(keyword));

    if (matched.length === 0) {
      continue;
    }

    const confidence = matched.length / concept.keywords.length;
    if (confidence >= minConfidence) {
      scored.push({
        conceptId: concept.conceptId,
        confidence: Math.round(confidence * 100) / 100,
        matchedKeywords: matched,
      });
    }
  }

  return scored
    .sort((a, b) => (b.confidence - a.confidence) || a.conceptId.localeCompare(b.conceptId))
    .slice(0, Math.max(1, maxTags));
}
