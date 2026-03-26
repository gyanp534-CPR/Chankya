import type { Question } from "@gyanam/shared";
import { seededShuffle } from "../../../utils/random.js";
import type { AdaptiveStrategy, DifficultyMix } from "./adaptive/adaptive-types.js";

export type AssemblyMode = "practice" | "exam";

function quotaForMode(mode: AssemblyMode, total: number): Record<"easy" | "medium" | "hard", number> {
  if (mode === "exam") {
    const base = Math.floor(total / 3);
    const remainder = total - base * 3;
    return {
      easy: base,
      medium: base + (remainder > 0 ? 1 : 0),
      hard: base + (remainder > 1 ? 1 : 0),
    };
  }

  const easy = Math.floor(total * 0.5);
  const medium = Math.floor(total * 0.3);
  const hard = total - easy - medium;
  return { easy, medium, hard };
}

function quotaForMix(mix: DifficultyMix, total: number): Record<"easy" | "medium" | "hard", number> {
  const normalized = normalizeMix(mix);
  const rawEasy = total * normalized.easy;
  const rawMedium = total * normalized.medium;
  const rawHard = total * normalized.hard;

  const baseEasy = Math.floor(rawEasy);
  const baseMedium = Math.floor(rawMedium);
  const baseHard = Math.floor(rawHard);

  let remaining = total - (baseEasy + baseMedium + baseHard);
  const fractions = [
    { key: "easy" as const, value: rawEasy - baseEasy },
    { key: "medium" as const, value: rawMedium - baseMedium },
    { key: "hard" as const, value: rawHard - baseHard },
  ].sort((a, b) => b.value - a.value);

  const quota = { easy: baseEasy, medium: baseMedium, hard: baseHard };
  for (const item of fractions) {
    if (remaining <= 0) {
      break;
    }
    quota[item.key] += 1;
    remaining -= 1;
  }

  return quota;
}

function normalizeMix(mix: DifficultyMix): DifficultyMix {
  const total = mix.easy + mix.medium + mix.hard;
  if (total <= 0) {
    return { easy: 0.5, medium: 0.3, hard: 0.2 };
  }
  return {
    easy: mix.easy / total,
    medium: mix.medium / total,
    hard: mix.hard / total,
  };
}

function assembleFromPool(
  questions: Question[],
  mode: AssemblyMode,
  seed: number,
  questionCount: number,
  strategy?: AdaptiveStrategy,
): Question[] {
  const buckets: Record<"easy" | "medium" | "hard", Question[]> = {
    easy: [],
    medium: [],
    hard: [],
  };

  for (const question of questions) {
    if (question.difficulty === "easy" || question.difficulty === "medium" || question.difficulty === "hard") {
      buckets[question.difficulty].push(question);
    }
  }

  const easy = seededShuffle(buckets.easy, seed + 11);
  const medium = seededShuffle(buckets.medium, seed + 17);
  const hard = seededShuffle(buckets.hard, seed + 23);

  const quota = strategy?.difficultyMix
    ? quotaForMix(strategy.difficultyMix, questionCount)
    : quotaForMode(mode, questionCount);
  const selected: Question[] = [];

  selected.push(...easy.slice(0, quota.easy));
  selected.push(...medium.slice(0, quota.medium));
  selected.push(...hard.slice(0, quota.hard));

  if (selected.length < questionCount) {
    const leftovers = seededShuffle(
      [
        ...easy.slice(quota.easy),
        ...medium.slice(quota.medium),
        ...hard.slice(quota.hard),
      ],
      seed + 31,
    );
    selected.push(...leftovers.slice(0, questionCount - selected.length));
  }

  return seededShuffle(selected, seed + 47).slice(0, questionCount);
}

function filterQuestionsByTopics(questions: Question[], strategy?: AdaptiveStrategy): Question[] | null {
  const topicIds = new Set(
    strategy?.topics?.map((topic) => topic.topicId).filter((topicId): topicId is string => Boolean(topicId)) ?? [],
  );
  if (topicIds.size === 0) {
    return null;
  }
  return questions.filter((question) => question.topicId && topicIds.has(question.topicId));
}

export function assembleDeterministicTest(
  questions: Question[],
  mode: AssemblyMode,
  seed: number,
  questionCount: number,
  strategy?: AdaptiveStrategy,
): Question[] {
  const topicPool = filterQuestionsByTopics(questions, strategy);
  if (topicPool && topicPool.length > 0) {
    if (topicPool.length >= questionCount) {
      return assembleFromPool(topicPool, mode, seed, questionCount, strategy);
    }

    const topicSelected = assembleFromPool(topicPool, mode, seed, topicPool.length, strategy);
    const selectedIds = new Set(topicSelected.map((question) => question.id));
    const remainingPool = questions.filter((question) => !selectedIds.has(question.id));
    const remainingCount = questionCount - topicSelected.length;
    const remainderSelected = remainingCount > 0
      ? assembleFromPool(remainingPool, mode, seed + 59, remainingCount, strategy)
      : [];

    return seededShuffle([...topicSelected, ...remainderSelected], seed + 71).slice(0, questionCount);
  }

  return assembleFromPool(questions, mode, seed, questionCount, strategy);
}
