import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";

type SuggestedConcept = {
  conceptId: string;
  confidence: number;
  matchedKeywords: string[];
};

type ReviewRow = {
  questionId: string;
  suggestedConcepts: SuggestedConcept[];
  status: "pending" | "approved" | "rejected";
  approvedConcepts?: string[];
  reviewNotes?: string;
  source?: string;
};

const prisma = new PrismaClient();
const SUGGESTION_SOURCE = "reviewed_keyword_v1";

async function parseSuggestions(path: string): Promise<ReviewRow[]> {
  const raw = await readFile(path, "utf-8");
  return JSON.parse(raw) as ReviewRow[];
}

async function main() {
  const suggestionsPath = resolve(process.cwd(), "data", "question-concept-suggestions.v1.json");
  const tokenLogPath = resolve(process.cwd(), "data", "tag-token-log.v1.jsonl");
  const rows = await parseSuggestions(suggestionsPath);

  for (const row of rows) {
    if (row.status !== "approved") {
      continue;
    }

    const approvedConcepts = row.approvedConcepts ?? [];
    if (approvedConcepts.length === 0) {
      throw new Error(`Approved row must include approvedConcepts: ${row.questionId}`);
    }
    if (approvedConcepts.length > 3) {
      throw new Error(`Tagging guardrail violated (max 3 concepts): ${row.questionId}`);
    }

    const question = await prisma.question.findUnique({
      where: { id: row.questionId },
      select: { id: true },
    });
    if (!question) {
      throw new Error(`Question not found: ${row.questionId}`);
    }

    for (const conceptId of approvedConcepts) {
      const concept = await prisma.concept.findUnique({
        where: { id: conceptId },
        select: { id: true },
      });
      if (!concept) {
        throw new Error(`Concept not found: ${conceptId}`);
      }

      const suggested = row.suggestedConcepts.find((item) => item.conceptId === conceptId);
      const confidence = suggested?.confidence ?? 1;
      await prisma.questionConcept.upsert({
        where: {
          questionId_conceptId: {
            questionId: row.questionId,
            conceptId,
          },
        },
        update: {
          confidence,
          source: SUGGESTION_SOURCE,
        },
        create: {
          questionId: row.questionId,
          conceptId,
          confidence,
          source: SUGGESTION_SOURCE,
        },
      });

      for (const token of suggested?.matchedKeywords ?? []) {
        const line = JSON.stringify({
          token,
          conceptId,
          questionId: row.questionId,
          source: SUGGESTION_SOURCE,
          createdAt: new Date().toISOString(),
        });
        await appendFile(tokenLogPath, `${line}\n`, "utf-8");
      }
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
