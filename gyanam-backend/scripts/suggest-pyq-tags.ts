import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import pyqRows from "../data/pyq/pyq.prelims.v1.json" with { type: "json" };
import conceptKeywords from "../data/concept-keywords.json" with { type: "json" };
import { suggestConcepts } from "../src/core/question-bank/tag-suggester.js";

type PyqRow = {
  id: string;
  questionText: string;
};

type KeywordRow = {
  conceptId: string;
  keywords: string[];
};

async function main() {
  const rows = pyqRows as PyqRow[];
  const keywords = conceptKeywords as KeywordRow[];

  const suggestions = rows.map((row) => {
    const matched = suggestConcepts(row.questionText, keywords, {
      maxTags: 3,
      minConfidence: 0.65,
    });

    return {
      questionId: row.id,
      suggestedConcepts: matched.map((item) => ({
        conceptId: item.conceptId,
        confidence: item.confidence,
        matchedKeywords: item.matchedKeywords,
      })),
      status: "pending",
      approvedConcepts: [] as string[],
      reviewNotes: "",
      needsReview: true,
      source: "keyword_engine_v1",
    };
  });

  const outputPath = resolve(process.cwd(), "data", "question-concept-suggestions.v1.json");
  await writeFile(outputPath, `${JSON.stringify(suggestions, null, 2)}\n`, "utf-8");
  // eslint-disable-next-line no-console
  console.log(`Wrote ${suggestions.length} suggestions to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
