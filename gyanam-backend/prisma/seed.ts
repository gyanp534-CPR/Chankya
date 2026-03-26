import { PrismaClient } from "@prisma/client";
import concepts from "./concepts.seed.json" with { type: "json" };
import frequencies from "./concept-frequency.seed.json" with { type: "json" };
import taxonomy from "./taxonomy.seed.json" with { type: "json" };

type SeedConcept = {
  id: string;
  name: string;
  subject: string;
  topicGroup: string;
  version: string;
};

type SeedFrequency = {
  conceptId: string;
  frequencyScore: number;
  frequencyVersion: string;
};

type SeedTopic = {
  name: string;
  weight: number;
};

type SeedSubject = {
  name: string;
  order: number;
  topics: SeedTopic[];
};

type SeedTaxonomy = {
  version: string;
  subjects: SeedSubject[];
};

const prisma = new PrismaClient();

async function main() {
  const conceptsList = concepts as SeedConcept[];
  const frequencyList = frequencies as SeedFrequency[];
  const taxonomySeed = taxonomy as SeedTaxonomy;
  const topicGroupsBySubject = new Map(
    taxonomySeed.subjects.map((subject) => [
      subject.name,
      new Set(subject.topics.map((topic) => topic.name)),
    ]),
  );

  for (const subject of taxonomySeed.subjects) {
    const subjectRecord = await prisma.subject.upsert({
      where: { name: subject.name },
      update: { order: subject.order, deletedAt: null },
      create: { name: subject.name, order: subject.order },
      select: { id: true },
    });

    for (const topic of subject.topics) {
      await prisma.topic.upsert({
        where: {
          subjectId_name: {
            subjectId: subjectRecord.id,
            name: topic.name,
          },
        },
        update: {
          weight: topic.weight,
          deletedAt: null,
        },
        create: {
          subjectId: subjectRecord.id,
          name: topic.name,
          weight: topic.weight,
        },
      });
    }
  }

  for (const concept of conceptsList) {
    const allowedTopicGroups = topicGroupsBySubject.get(concept.subject);
    if (!allowedTopicGroups) {
      throw new Error(`Taxonomy subject missing for concept seed: ${concept.subject} (${concept.id})`);
    }
    if (!allowedTopicGroups.has(concept.topicGroup)) {
      throw new Error(
        `Taxonomy topic missing for concept seed: ${concept.subject} -> ${concept.topicGroup} (${concept.id})`,
      );
    }

    const subject = await prisma.subject.findFirst({
      where: { name: concept.subject, deletedAt: null },
      select: { id: true },
    });

    if (!subject) {
      throw new Error(`Subject not found for concept seed: ${concept.subject} (${concept.id})`);
    }

    await prisma.concept.upsert({
      where: { id: concept.id },
      update: {
        name: concept.name,
        subjectId: subject.id,
        topicGroup: concept.topicGroup,
        version: concept.version,
      },
      create: {
        id: concept.id,
        name: concept.name,
        subjectId: subject.id,
        topicGroup: concept.topicGroup,
        version: concept.version,
      },
    });
  }

  for (const frequency of frequencyList) {
    await prisma.concept.update({
      where: { id: frequency.conceptId },
      data: {
        frequencyScore: frequency.frequencyScore,
        frequencyVersion: frequency.frequencyVersion,
      },
    });
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
