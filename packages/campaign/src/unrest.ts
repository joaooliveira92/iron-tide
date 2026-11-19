import { APPROPRIATION_RATE_MIN_BP } from "./budgetConstants.js";
import { UNREST_MAX, UNREST_MIN } from "./eventEffects.js";
import { monthIndex } from "./eventDraw.js";
import type { BlockadeState, CompiledDesignVersion, NationState, WarDeclaration } from "./state.js";

export const UNREST_REASON_CODES = [
  "MILITARY_SPENDING",
  "SPENDING_CUT",
  "WAR_OUTBREAK",
  "WAR_DURATION",
  "BLOCKADE",
  "DEFEAT",
  "VICTORY",
  "CRAMPED_ACCOMMODATION",
  "PRESENCE_SHORTFALL",
  "EVENT",
  "SOCIAL_PROGRAMME",
  "REVOLUTION_AFTERMATH",
] as const;
export type UnrestReasonCode = (typeof UNREST_REASON_CODES)[number];

export const RESERVED_UNREST_REASON_CODES = ["SOCIAL_PROGRAMME"] as const;

export interface UnrestRules {
  readonly referenceRateBp: number;
  readonly spendingStepBp: number;
  readonly spendingMaxRise: number;
  readonly spendingMaxCut: number;
  readonly warOutbreakRelief: number;
  readonly warDurationMonths: number;
  readonly warDurationRise: number;
  readonly blockadeRise: number;
  readonly defeatRise: number;
  readonly victoryRelief: number;
  readonly crampedWarRise: number;
  readonly crampedBlockadeRise: number;
  readonly strikeThreshold: number;
  readonly strikeRateStepBp: number;
  readonly revolutionThreshold: number;
  readonly revolutionProbabilityBp: number;
  readonly liberalDemocracyDampingBp: number;
  readonly aftermathUnrest: number;
}

export interface UnrestContribution {
  readonly reasonCode: UnrestReasonCode;
  readonly delta: number;
}

export interface UnrestLastChange {
  readonly month: string;
  readonly before: number;
  readonly after: number;
  readonly contributions: readonly UnrestContribution[];
}

export function unrestOf(nation: Pick<NationState, "unrest">): number {
  return nation.unrest ?? UNREST_MIN;
}

export interface UnrestMonthInput {
  readonly rateBp: number;
  readonly warMonths: number | undefined;
  readonly blockaded: boolean;
  readonly crampedShareBp: number;
}

export function resolveUnrestDrivers(
  input: UnrestMonthInput,
  rules: UnrestRules,
): UnrestContribution[] {
  const out: UnrestContribution[] = [];
  const excess = input.rateBp - rules.referenceRateBp;
  if (excess > 0) {
    const rise = Math.min(rules.spendingMaxRise, Math.floor(excess / rules.spendingStepBp));
    if (rise > 0) out.push({ reasonCode: "MILITARY_SPENDING", delta: rise });
  } else if (excess < 0) {
    const cut = Math.min(rules.spendingMaxCut, Math.floor(-excess / rules.spendingStepBp));
    if (cut > 0) out.push({ reasonCode: "SPENDING_CUT", delta: -cut });
  }
  if (input.warMonths !== undefined) {
    if (input.warMonths === 0) {
      out.push({ reasonCode: "WAR_OUTBREAK", delta: -rules.warOutbreakRelief });
    } else if (input.warMonths >= rules.warDurationMonths) {
      out.push({ reasonCode: "WAR_DURATION", delta: rules.warDurationRise });
    }
  }
  if (input.blockaded) out.push({ reasonCode: "BLOCKADE", delta: rules.blockadeRise });
  if (input.warMonths !== undefined && input.crampedShareBp > 0) {
    const base = input.blockaded
      ? rules.crampedWarRise + rules.crampedBlockadeRise
      : rules.crampedWarRise;
    const scaled = Math.ceil((base * input.crampedShareBp) / 10_000);
    if (scaled > 0) out.push({ reasonCode: "CRAMPED_ACCOMMODATION", delta: scaled });
  }
  return out.filter((c) => c.delta !== 0);
}

export interface UnrestWorldInput {
  readonly wars: readonly Pick<
    WarDeclaration,
    "attackerSideMembers" | "defenderSideMembers" | "startDate" | "status"
  >[];
  readonly blockadeState: readonly Pick<BlockadeState, "blockadedNationId" | "establishedMonth">[];
  readonly fleets: readonly { readonly ships: readonly { readonly designVersionId: string }[] }[];
  readonly designs: ReadonlyMap<string, Pick<CompiledDesignVersion, "crampedAccommodation">>;
}

export function longestWarMonths(
  wars: UnrestWorldInput["wars"],
  nationId: string,
  campaignMonth: string,
): number | undefined {
  const now = monthIndex(campaignMonth);
  let longest: number | undefined;
  for (const war of wars) {
    if (war.status !== "ACTIVE") continue;
    if (!war.attackerSideMembers.includes(nationId) && !war.defenderSideMembers.includes(nationId))
      continue;
    const elapsed = Math.max(0, now - monthIndex(war.startDate.slice(0, 7)));
    if (longest === undefined || elapsed > longest) longest = elapsed;
  }
  return longest;
}

export function resolveUnrestMonthInput(
  input: UnrestWorldInput,
  nationId: string,
  campaignMonth: string,
  rateBp: number,
): UnrestMonthInput {
  const now = monthIndex(campaignMonth);
  const blockaded = input.blockadeState.some(
    (b) => b.blockadedNationId === nationId && monthIndex(b.establishedMonth.slice(0, 7)) <= now,
  );
  const ships = input.fleets.flatMap((fleet) => fleet.ships);
  const cramped = ships.filter(
    (ship) => input.designs.get(ship.designVersionId)?.crampedAccommodation === true,
  ).length;
  return {
    rateBp,
    warMonths: longestWarMonths(input.wars, nationId, campaignMonth),
    blockaded,
    crampedShareBp: ships.length === 0 ? 0 : Math.floor((cramped * 10_000) / ships.length),
  };
}

export function clampUnrest(value: number): number {
  return Math.min(UNREST_MAX, Math.max(UNREST_MIN, value));
}

export function withUnrestChange(
  nation: NationState,
  month: string,
  contributions: readonly UnrestContribution[],
  settle?: number,
): NationState {
  if (contributions.length === 0 && settle === undefined) return nation;
  const before = unrestOf(nation);
  const sum = contributions.reduce((total, c) => clampUnrest(total + c.delta), before);
  const after = clampUnrest(settle ?? sum);
  const previous = nation.unrestLastChange;
  const carry = previous !== undefined && previous.month === month ? previous : undefined;
  return {
    ...nation,
    unrest: after,
    unrestLastChange: {
      month,
      before: carry?.before ?? before,
      after,
      contributions: [...(carry?.contributions ?? []), ...contributions],
    },
  };
}

export function strikeActive(unrest: number, rules: UnrestRules): boolean {
  return unrest >= rules.strikeThreshold;
}

export function rateAfterStrike(rateBp: number, rules: UnrestRules): number {
  return Math.max(APPROPRIATION_RATE_MIN_BP, rateBp - rules.strikeRateStepBp);
}

export function revolutionEligible(unrest: number, atWar: boolean, rules: UnrestRules): boolean {
  return atWar && unrest >= rules.revolutionThreshold;
}

export function revolutionProbabilityBp(
  rules: UnrestRules,
  governmentType: NationState["governmentType"],
): number {
  if (governmentType !== "liberal_democracy") return rules.revolutionProbabilityBp;
  return Math.floor((rules.revolutionProbabilityBp * rules.liberalDemocracyDampingBp) / 10_000);
}
