export type SkillBand = "Emerging" | "Developing" | "Proficient" | "Advanced";

export function resolveSkillBand(mastery: number): SkillBand {
  if (mastery < 40) {
    return "Emerging";
  }
  if (mastery < 60) {
    return "Developing";
  }
  if (mastery < 80) {
    return "Proficient";
  }
  return "Advanced";
}
