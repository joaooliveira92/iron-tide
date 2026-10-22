import { RandomEngine } from "@bluewave/random";
import type { NationNavalProfile } from "./nationProfile.js";

export const RESEARCH_FIELDS = [
  "HULL_CONSTRUCTION",
  "MACHINERY",
  "SHIP_DESIGN",
  "GUNNERY",
  "TORPEDOES",
  "MINES_AND_ASW",
  "SUBMARINES",
  "INFRASTRUCTURE",
  "DAMAGE_CONTROL",
  "FIRE_CONTROL",
  "AVIATION",
  "RADAR_AND_ELECTRONICS",
  "MISSILES",
  "AMPHIBIOUS_OPERATIONS",
  "NAVAL_AIR",
] as const;
export type ResearchField = (typeof RESEARCH_FIELDS)[number];

export const PRIORITY = { LOW: 1, MEDIUM: 2, HIGH: 4 } as const;
export const MAX_HIGH_FIELDS = 5;

export interface ResearchContext {
  readonly saturatedFields?: ReadonlySet<string>;
  readonly boostedFields?: ReadonlySet<string>;
  readonly budgetPressureBp?: number;
}

export interface ResearchAllocation {
  readonly fieldPriorities: Readonly<Record<ResearchField, number>>;
  readonly reasons: readonly string[];
}

const clampPriority = (p: number): number => Math.max(1, Math.min(4, p));

export function researchPriorityAllocation(
  profile: NationNavalProfile,
  context: ResearchContext = {},
  seed?: string,
): ResearchAllocation {
  const reasons: string[] = [];
  const base = new Map<string, number>();
  for (const f of RESEARCH_FIELDS) base.set(f, PRIORITY.MEDIUM);
  for (const r of profile.researchPreferences) base.set(r.field, clampPriority(r.priority));

  const pressure = context.budgetPressureBp ?? 10_000;
  const flatten = pressure < 6_000;
  if (flatten) reasons.push("budget pressure flattens priorities toward MEDIUM");

  const stream =
    seed === undefined
      ? null
      : new RandomEngine(seed).stream(`national-research:${profile.nationId}`);
  const varied = new Map<string, number>();
  for (const f of RESEARCH_FIELDS) {
    let p = base.get(f)!;
    if (stream !== null) {
      const f01 = stream.next();
      p = clampPriority(p + (f01 < 0.33 ? -1 : f01 > 0.67 ? 1 : 0));
    }
    if (context.saturatedFields?.has(f)) {
      p = Math.min(p, PRIORITY.MEDIUM);
      reasons.push(`${f} saturated: capped at MEDIUM`);
    }
    if (context.boostedFields?.has(f)) p = clampPriority(p + 1);
    varied.set(f, p);
  }

  const cap = flatten ? Math.max(1, MAX_HIGH_FIELDS - 2) : MAX_HIGH_FIELDS;
  const highFields = RESEARCH_FIELDS.filter((f) => varied.get(f) === PRIORITY.HIGH);
  if (highFields.length > cap) {
    const demote = [...highFields]
      .sort((a, b) => (a < b ? -1 : 1))
      .slice(0, highFields.length - cap);
    for (const f of demote) varied.set(f, PRIORITY.MEDIUM);
    reasons.push(`at most ${String(cap)} HIGH fields: demoted ${demote.join(", ")}`);
  }

  const fieldPriorities = Object.fromEntries(
    RESEARCH_FIELDS.map((f) => [f, varied.get(f)!]),
  ) as Record<ResearchField, number>;
  return { fieldPriorities, reasons };
}

export function researchPriorityRecord(allocation: ResearchAllocation): Record<string, number> {
  return { ...allocation.fieldPriorities };
}
