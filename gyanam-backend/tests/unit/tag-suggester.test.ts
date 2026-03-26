import { describe, expect, it } from "vitest";
import { suggestConcepts } from "../../src/core/question-bank/tag-suggester.js";

describe("tag suggester", () => {
  it("returns at most 3 suggestions above threshold", () => {
    const concepts = [
      { conceptId: "POL-PAR-004", keywords: ["money bill", "article 110"] },
      { conceptId: "POL-PAR-006", keywords: ["parliamentary privilege"] },
      { conceptId: "POL-CF-003", keywords: ["basic structure"] },
      { conceptId: "ECO-MON-003", keywords: ["repo rate"] },
    ];

    const suggestions = suggestConcepts(
      "Money Bill under Article 110 and parliamentary privilege concerns are discussed.",
      concepts,
      { maxTags: 3, minConfidence: 0.5 },
    );

    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(suggestions.map((item) => item.conceptId)).toContain("POL-PAR-004");
    expect(suggestions.map((item) => item.conceptId)).toContain("POL-PAR-006");
  });

  it("returns empty list when no concept meets confidence threshold", () => {
    const concepts = [
      { conceptId: "ENV-CNV-001", keywords: ["ramsar", "wetlands convention"] },
    ];

    const suggestions = suggestConcepts(
      "Question about unrelated constitutional doctrine.",
      concepts,
      { minConfidence: 0.65 },
    );

    expect(suggestions).toEqual([]);
  });
});
