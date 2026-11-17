import { monthIndex } from "./eventDraw.js";
import type { BlockadeState, CompiledDesignVersion, NationState, WarDeclaration } from "./state.js";

export const FLEET_MORALE_MAX = 100;
export const FLEET_MORALE_MIN = 0;

export const FLEET_MORALE_REASON_CODES = ["UNPAID_FUNDS", "BLOCKADE_CRAMPED", "RECOVERY"] as const;
export type FleetMoraleReasonCode = (typeof FLEET_MORALE_REASON_CODES)[number];

export interface FleetMoraleRules {
  readonly unpaidFundsLoss: number;
  readonly blockadeCrampedLoss: number;
  readonly longWarMonths: number;
  readonly recoveryPerMonth: number;
}

export interface FleetMoraleContribution {
  readonly reasonCode: FleetMoraleReasonCode;
  readonly delta: number;
}

export interface FleetMoraleChange {
  readonly before: number;
  readonly after: number;
  readonly unclampedAfter: number;
  readonly contributions: readonly FleetMoraleContribution[];
}

export interface FleetMoraleLastChange extends FleetMoraleChange {
  readonly month: string;
}

export function fleetMoraleOf(nation: Pick<NationState, "fleetMorale">): number {
  return nation.fleetMorale ?? FLEET_MORALE_MAX;
}

export interface FleetMoraleMonthInput {
  readonly current: number | undefined;
  readonly rules: FleetMoraleRules;
  readonly unpaid: boolean;
  readonly blockadedCramped: boolean;
}

export function resolveFleetMoraleMonth(
  input: FleetMoraleMonthInput,
): FleetMoraleChange | undefined {
  const before = input.current ?? FLEET_MORALE_MAX;
  const contributions: FleetMoraleContribution[] = [];
  if (input.unpaid) {
    contributions.push({ reasonCode: "UNPAID_FUNDS", delta: -input.rules.unpaidFundsLoss });
  }
  if (input.blockadedCramped) {
    contributions.push({ reasonCode: "BLOCKADE_CRAMPED", delta: -input.rules.blockadeCrampedLoss });
  }
  if (contributions.length === 0) {
    const gain = Math.min(input.rules.recoveryPerMonth, FLEET_MORALE_MAX - before);
    if (gain <= 0) return undefined;
    contributions.push({ reasonCode: "RECOVERY", delta: gain });
  }
  const unclampedAfter = contributions.reduce((total, c) => total + c.delta, before);
  const after = Math.min(FLEET_MORALE_MAX, Math.max(FLEET_MORALE_MIN, unclampedAfter));
  return { before, after, unclampedAfter, contributions };
}

export interface LongBlockadeInput {
  readonly fleets: readonly { readonly ships: readonly { readonly designVersionId: string }[] }[];
  readonly designs: ReadonlyMap<string, Pick<CompiledDesignVersion, "crampedAccommodation">>;
  readonly wars: readonly Pick<
    WarDeclaration,
    "attackerSideMembers" | "defenderSideMembers" | "startDate" | "status"
  >[];
  readonly blockadeState: readonly Pick<BlockadeState, "blockadedNationId" | "establishedMonth">[];
}

export function isLongBlockadeCramped(
  input: LongBlockadeInput,
  nationId: string,
  campaignMonth: string,
  rules: Pick<FleetMoraleRules, "longWarMonths">,
): boolean {
  const now = monthIndex(campaignMonth);
  const longWar = input.wars.some(
    (war) =>
      war.status === "ACTIVE" &&
      (war.attackerSideMembers.includes(nationId) || war.defenderSideMembers.includes(nationId)) &&
      now - monthIndex(war.startDate.slice(0, 7)) >= rules.longWarMonths,
  );
  if (!longWar) return false;
  const blockaded = input.blockadeState.some(
    (b) => b.blockadedNationId === nationId && monthIndex(b.establishedMonth.slice(0, 7)) <= now,
  );
  if (!blockaded) return false;
  return input.fleets.some((fleet) =>
    fleet.ships.some(
      (ship) => input.designs.get(ship.designVersionId)?.crampedAccommodation === true,
    ),
  );
}
