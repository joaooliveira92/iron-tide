import {
  applyUnrestDelta,
  chargeablePresenceRows,
  type CampaignSnapshot,
  type PresenceMeasurementRules,
  PrestigeRule,
  StationPresenceRow,
  unrestOf,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { applyPrestigeChange, type PrestigeApplicationContext } from "./prestigeApplication.js";
import { applyUnrestContributions } from "./unrestApplication.js";

const BASIS_POINTS = 10_000;

export function shortfallLossBp(
  rows: readonly StationPresenceRow[],
  rules: NonNullable<PresenceMeasurementRules["shortfallPrestige"]>,
): number {
  let total = 0;
  for (const row of rows) {
    if (row.requiredTons <= 0) continue;
    const shortfallBp = Math.floor((row.shortfallTons * BASIS_POINTS) / row.requiredTons);
    total += Math.floor((shortfallBp * rules.lossBpPerWholeShortfall) / BASIS_POINTS);
  }
  return Math.min(total, rules.maxLossBp);
}

export interface PresencePenaltyScope {
  readonly turnNumber: number;
  readonly slots: CampaignSnapshot["slots"];
  readonly sourceSnapshot: Pick<CampaignSnapshot, "nations">;
  readonly snapshot: Pick<CampaignSnapshot, "nations" | "world" | "designs">;
}

function activeAtMonthStart(
  source: Pick<CampaignSnapshot, "nations">,
  nationId: string,
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const fleet of source.nations.get(nationId)?.fleets ?? []) {
    for (const ship of fleet.ships) if (ship.readiness === "ACTIVE") ids.add(ship.id);
  }
  return ids;
}

function chargedRows(
  nationId: string,
  rows: readonly StationPresenceRow[],
  rules: PresenceMeasurementRules,
  shortfall: NonNullable<PresenceMeasurementRules["shortfallPrestige"]>,
  scope: PresencePenaltyScope,
): readonly StationPresenceRow[] {
  if (scope.turnNumber < (shortfall.openingGraceMonths ?? 0)) return [];
  if (shortfall.surplusShipsOnly !== true) return rows;
  if (!scope.slots.some((slot) => slot.nationId === nationId && slot.type === "playable")) {
    return [];
  }
  return chargeablePresenceRows(
    scope.snapshot,
    nationId,
    rows,
    rules,
    activeAtMonthStart(scope.sourceSnapshot, nationId),
  );
}

export function applyPresenceShortfallPrestige(
  ctx: PrestigeApplicationContext,
  demand: readonly StationPresenceRow[],
  rules: PresenceMeasurementRules,
  scope: PresencePenaltyScope,
): void {
  const shortfall = rules.shortfallPrestige;
  if (shortfall === undefined || rules.penaltyRequests !== true) return;
  const byNation = new Map<string, StationPresenceRow[]>();
  for (const row of demand) {
    const rows = byNation.get(row.nationId);
    if (rows === undefined) byNation.set(row.nationId, [row]);
    else rows.push(row);
  }
  for (const nationId of [...byNation.keys()].sort()) {
    const rows = chargedRows(nationId, byNation.get(nationId) ?? [], rules, shortfall, scope);
    if (rows.length === 0) continue;
    const lossBp = shortfallLossBp(rows, shortfall);
    if (lossBp > 0) {
      const rule: PrestigeRule = { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(lossBp) };
      applyPrestigeChange(ctx, nationId, "PRESENCE_SHORTFALL", rule);
    }
    if (rules.shortfallUnrest !== undefined) {
      applyShortfallUnrest(ctx, nationId, rules.shortfallUnrest.unrestPerShortMonth);
    }
  }
}

export function applyShortfallUnrest(
  ctx: PrestigeApplicationContext,
  nationId: string,
  unrestPerShortMonth: number,
): void {
  const nation = ctx.snapshot.read("nations").get(nationId);
  if (nation === undefined) return;
  const delta = applyUnrestDelta(nation.unrest, unrestPerShortMonth) - unrestOf(nation);
  if (delta === 0) return;
  applyUnrestContributions(ctx, nationId, [{ reasonCode: "PRESENCE_SHORTFALL", delta }]);
}
