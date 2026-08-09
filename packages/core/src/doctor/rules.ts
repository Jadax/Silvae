import type { Diagnosis, Symptoms } from "../dto/doctor.js";

interface Rule {
  id: string;
  weight: number;
  /** Every key must match; an array value matches any of its entries. */
  symptoms: Partial<Record<keyof Symptoms, boolean | string | (boolean | string)[]>>;
  /** At least one of these keys must be present/truthy to satisfy the rule. */
  atLeastOne?: (keyof Symptoms)[];
  likelyCause: string;
  treatment: string[];
}

const RULES: Rule[] = [
  {
    id: "overwater",
    weight: 4,
    symptoms: { leafColor: "yellow", soil: ["moist", "soaked"] },
    atLeastOne: ["droop", "lowerLeaves"],
    likelyCause: "Overwatering / root rot risk",
    treatment: ["Let soil dry out", "Inspect roots", "Repot with drainage"],
  },
  {
    id: "underwater",
    weight: 4,
    symptoms: { leafCrisp: "dry-brown", soil: "dry", droop: true },
    likelyCause: "Underwatering",
    treatment: ["Water thoroughly", "Check pot for drainage", "Monitor daily"],
  },
  {
    id: "low-light",
    weight: 3,
    symptoms: { leafColor: "pale", stretched: true, light: "low" },
    likelyCause: "Too little light",
    treatment: ["Move closer to a window", "Rotate weekly", "Consider grow light"],
  },
  {
    id: "sunburn",
    weight: 3,
    symptoms: { leafBurn: "brown-spots", directSun: true, spotsOnExposed: true },
    likelyCause: "Sunburn (too much direct light)",
    treatment: ["Move away from direct sun", "Acclimatise gradually"],
  },
  {
    id: "leaf-spot",
    weight: 2,
    symptoms: { leafBurn: "brown-spots" },
    likelyCause: "Fungal leaf spot (possible)",
    treatment: ["Remove affected leaves", "Water the soil, not the leaves", "Improve air flow"],
  },
  {
    id: "low-humidity",
    weight: 2,
    symptoms: { leafCrisp: "brown-tips", envHumidity: "low" },
    likelyCause: "Low humidity",
    treatment: ["Mist regularly", "Use a pebble tray", "Group plants"],
  },
  {
    id: "spider-mite",
    weight: 3,
    symptoms: { webbing: true, stippling: true },
    likelyCause: "Spider mites",
    treatment: ["Rinse leaves", "Apply neem oil", "Isolate plant"],
  },
  {
    id: "mealybug",
    weight: 3,
    symptoms: { whiteFluff: true, stickyResidue: true },
    likelyCause: "Mealybugs",
    treatment: ["Remove with alcohol swab", "Apply insecticidal soap"],
  },
  {
    id: "aphid",
    weight: 3,
    symptoms: { curledLeaves: true, stickyResidue: true, insects: true },
    likelyCause: "Aphids",
    treatment: ["Wash off", "Neem oil", "Encourage ladybugs"],
  },
];

export function matches(rule: Rule, answers: Symptoms): boolean {
  for (const [key, expected] of Object.entries(rule.symptoms)) {
    const got = answers[key as keyof Symptoms];
    if (Array.isArray(expected)) {
      if (got === undefined || !expected.includes(got)) return false;
    } else if (got !== expected) {
      return false;
    }
  }
  if (rule.atLeastOne && !rule.atLeastOne.some((k) => Boolean(answers[k]))) return false;
  return true;
}

function confidence(score: number, weight: number): Diagnosis["confidence"] {
  if (score >= weight) return "high";
  if (score >= weight - 1) return "medium";
  return "low";
}

export function diagnose(answers: Symptoms): Diagnosis[] {
  return RULES.map((r) => ({ rule: r, score: matches(r, answers) ? r.weight : 0 }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ rule, score }) => ({
      id: rule.id,
      score,
      likelyCause: rule.likelyCause,
      treatment: rule.treatment,
      confidence: confidence(score, rule.weight),
    }));
}
