import pyqRows from "../data/pyq/pyq.prelims.v1.json" with { type: "json" };
import tagRows from "../data/question-concept-tags.v1.json" with { type: "json" };

type PyqRow = {
  id: string;
  year: number;
  examStage: string;
  subject: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
};

type TagRow = {
  questionId: string;
  conceptIds: string[];
  source?: string;
};

function main() {
  const questions = pyqRows as PyqRow[];
  const tags = tagRows as TagRow[];

  const questionIds = new Set(questions.map((row) => row.id));
  const taggedQuestionIds = new Set<string>();
  const conceptCounts = new Map<string, number>();
  const subjectCounts = new Map<string, number>();

  for (const question of questions) {
    subjectCounts.set(question.subject, (subjectCounts.get(question.subject) ?? 0) + 1);
  }

  for (const row of tags) {
    if (questionIds.has(row.questionId)) {
      taggedQuestionIds.add(row.questionId);
    }
    for (const conceptId of row.conceptIds) {
      conceptCounts.set(conceptId, (conceptCounts.get(conceptId) ?? 0) + 1);
    }
  }

  const untagged = questions.filter((row) => !taggedQuestionIds.has(row.id)).map((row) => row.id);
  const topConcepts = [...conceptCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 10);

  console.log(JSON.stringify({
    totalQuestions: questions.length,
    taggedQuestions: taggedQuestionIds.size,
    untaggedQuestions: untagged.length,
    coveragePercent: questions.length === 0 ? 0 : Math.round((taggedQuestionIds.size / questions.length) * 10000) / 100,
    bySubject: [...subjectCounts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([subject, count]) => ({ subject, count })),
    topConcepts: topConcepts.map(([conceptId, count]) => ({ conceptId, count })),
    untaggedIds: untagged,
  }, null, 2));
}

main();
