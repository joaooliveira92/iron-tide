import type {
  PresenceMeasurementRules,
  PrestigeRule,
  StationPresenceRow,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { applyPrestigeChange, type PrestigeApplicationContext } from "./prestigeApplication.js";

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

export function applyPresenceShortfallPrestige(
  ctx: PrestigeApplicationContext,
  demand: readonly StationPresenceRow[],
  rules: PresenceMeasurementRules,
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
    const lossBp = shortfallLossBp(byNation.get(nationId) ?? [], shortfall);
    if (lossBp === 0) continue;
    const rule: PrestigeRule = { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(lossBp) };
    applyPrestigeChange(ctx, nationId, "PRESENCE_SHORTFALL", rule);
  }
}
