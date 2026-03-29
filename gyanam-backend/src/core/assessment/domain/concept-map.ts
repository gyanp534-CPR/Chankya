const TOPIC_CONCEPT_MAP: Array<{ match: RegExp; concepts: string[] }> = [
  { match: /time\s*&\s*work|time and work/i, concepts: ["Efficiency", "Work Rate", "Combined Work"] },
  { match: /ratio/i, concepts: ["Ratio Basics", "Proportion", "Partnership"] },
  { match: /profit|loss/i, concepts: ["Profit & Loss", "Discounts", "Marked Price"] },
  { match: /percent/i, concepts: ["Percent Basics", "Increase & Decrease"] },
  { match: /simple interest|compound interest/i, concepts: ["Simple Interest", "Compound Interest"] },
  { match: /average/i, concepts: ["Weighted Average", "Mean Concepts"] },
  { match: /mixture|alligation/i, concepts: ["Alligation", "Mixture Ratio"] },
  { match: /time|speed|distance/i, concepts: ["Relative Speed", "Trains & Platforms", "Boats & Streams"] },
];

export function getConceptsForTopicLabel(label: string): string[] {
  const trimmed = label.trim();
  if (!trimmed || trimmed.toLowerCase() === "general") {
    return [];
  }

  const concepts = TOPIC_CONCEPT_MAP.filter((entry) => entry.match.test(trimmed))
    .flatMap((entry) => entry.concepts);

  return [...new Set(concepts)];
}
