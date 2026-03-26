import { PrismaClient } from "@prisma/client";
import tagRows from "../data/question-concept-tags.v1.json" with { type: "json" };

type TagRow = {
  questionId: string;
  conceptIds: string[];
  source?: string;
};

const prisma = new PrismaClient();

async function main() {
  const rows = tagRows as TagRow[];
  for (const row of rows) {
    if (row.conceptIds.length === 0) {
      throw new Error(`No concept tags provided for question: ${row.questionId}`);
    }
    if (row.conceptIds.length > 3) {
      throw new Error(`Tagging guardrail violated (max 3 concepts): ${row.questionId}`);
    }

    const question = await prisma.question.findUnique({
      where: { id: row.questionId },
      select: { id: true },
    });
    if (!question) {
      throw new Error(`Question not found for tag mapping: ${row.questionId}`);
    }

    for (const conceptId of row.conceptIds) {
      const concept = await prisma.concept.findUnique({
        where: { id: conceptId },
        select: { id: true },
      });
      if (!concept) {
        throw new Error(`Concept not found for tag mapping: ${conceptId}`);
      }

      await prisma.questionConcept.upsert({
        where: {
          questionId_conceptId: {
            questionId: row.questionId,
            conceptId,
          },
        },
        update: {
          source: row.source ?? "manual_tag_v1",
          confidence: 1.0,
        },
        create: {
          questionId: row.questionId,
          conceptId,
          source: row.source ?? "manual_tag_v1",
          confidence: 1.0,
        },
      });
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
