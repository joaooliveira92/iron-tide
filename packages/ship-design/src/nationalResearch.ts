/**
 * National research priorities (docs/ships-nation-orientation.md §3). Turns a nation's authored research preferences
 * into an actual field-priority allocation, adjusted by fleet deficiency, strategic obligations, budget pressure and
 * saturation — so a preference cannot dominate forever once the capability is sufficient. Deterministic and pure;
 * the campaign AI consumes it, and a player screen may surface it as a *recommendation* that never overrides an
 * explicit player choice.
 */
import { RandomEngine } from "@bluewave/random";
import type { NationNavalProfile } from "./nationProfile.js";

/** The 15 canonical research fields (kept in sync with content-schema's registry by a parity test). */
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

/** The canonical priority weights (content-schema mirrors these). */
export const PRIORITY = { LOW: 1, MEDIUM: 2, HIGH: 4 } as const;
export const MAX_HIGH_FIELDS = 5;

export interface ResearchContext {
  /** Fields whose capability is already sufficient: their priority is capped, so a preference does not dominate forever. */
  readonly saturatedFields?: ReadonlySet<string>;
  /** Fields a fleet deficiency or obligation recommends extra attention to (adds one priority step). */
  readonly boostedFields?: ReadonlySet<string>;
  /** Budget pressure 0..10000 (10000 = normal): heavy pressure flattens the spread toward MEDIUM. */
  readonly budgetPressureBp?: number;
}

export interface ResearchAllocation {
  readonly fieldPriorities: Readonly<Record<ResearchField, number>>;
  readonly reasons: readonly string[];
}

const clampPriority = (p: number): number => Math.max(1, Math.min(4, p));

/**
 * Compute the allocation for a profile. Base priorities come from the profile's authored `researchPreferences`
 * (missing fields default to MEDIUM); saturation caps a field, a boost raises it, and seeded variation of ±1 keeps
 * two campaigns distinct while a single campaign reproduces. The result never sets more than `MAX_HIGH_FIELDS` at
 * HIGH — extra HIGH fields are demoted, so doctrine cannot saturate the whole board.
 */
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
  const flatten = pressure < 6_000; // heavy budget pressure: fewer HIGH bets
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

  // Max-HIGH cap: demote the lowest-priority HIGH fields (ties broken by field id, deterministically).
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

/** The allocation as the string keys / numeric values the command envelope expects. */
export function researchPriorityRecord(allocation: ResearchAllocation): Record<string, number> {
  return { ...allocation.fieldPriorities };
}
