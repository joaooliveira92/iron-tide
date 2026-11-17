import {
  surplusShips,
  type CampaignSnapshot,
  type NationState,
  type PresenceMeasurementRules,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { presenceFromRulesets } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { Data } from "effect";

import { compileProductionCampaign } from "./production-pack.js";

class PresenceSeverityRunFailed extends Data.TaggedError("PresenceSeverityRunFailed")<{
  readonly detail: string;
}> {}

export type PresencePosture = "orders_ignored" | "posts_idle_ship";

export interface PresenceSeverityRow {
  readonly nationId: string;
  readonly posture: PresencePosture;
  readonly firstChargeMonth: number | undefined;
  readonly chargeMonths: number;
  readonly eligibleMonth: number | undefined;
  readonly sackedMonth: number | undefined;
  readonly prestigeByMonth: readonly number[];
}

export interface PresenceSeverityOptions {
  readonly months: number;
  readonly sackingThreshold: number;
  readonly nationIds?: readonly string[];
  readonly postures?: readonly PresencePosture[];
  readonly presenceOverride?: (rules: PresenceMeasurementRules) => PresenceMeasurementRules;
}

function activeShipIds(nation: NationState): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const fleet of nation.fleets) {
    for (const ship of fleet.ships) if (ship.readiness === "ACTIVE") ids.add(ship.id);
  }
  return ids;
}

function postIdleShips(
  snapshot: CampaignSnapshot,
  rules: PresenceMeasurementRules,
): CampaignSnapshot {
  const nations = new Map(snapshot.nations);
  for (const [nationId, nation] of snapshot.nations) {
    const idle = new Set(
      surplusShips(snapshot, nationId, rules, activeShipIds(nation)).map((ship) => ship.id),
    );
    if (idle.size === 0) continue;
    nations.set(nationId, {
      ...nation,
      fleets: nation.fleets.map((fleet) => ({
        ...fleet,
        ships: fleet.ships.map((ship) =>
          idle.has(ship.id) ? { ...ship, stationAssignment: "FOREIGN_STATION" as const } : ship,
        ),
      })),
    });
  }
  return { ...snapshot, nations };
}

interface Trajectory {
  readonly chargeMonthsByNation: ReadonlyMap<string, readonly number[]>;
  readonly prestigeByNation: ReadonlyMap<string, readonly number[]>;
  readonly sackedMonth: number | undefined;
}

function runCampaign(
  start: CampaignSnapshot,
  rules: PresenceMeasurementRules,
  months: number,
  playerNationId: string,
  repost: boolean,
): Trajectory {
  const executor = new MonthExecutor();
  let snapshot = start;
  const chargeMonthsByNation = new Map<string, number[]>();
  const prestigeByNation = new Map<string, number[]>();
  let sackedMonth: number | undefined;
  for (let month = 1; month <= months && sackedMonth === undefined; month += 1) {
    const result = executor.execute(
      repost ? postIdleShips(snapshot, rules) : snapshot,
      [],
      `presence-severity-${month}`,
      new DiagnosticCollector(),
      undefined,
      { presence: rules, playerNationId },
    );
    if (!result.success) throw new PresenceSeverityRunFailed({ detail: `month ${month} failed` });
    for (const event of result.eventLedger.all) {
      if (event.body.kind === "PrestigeChanged" && event.body.reasonCode === "PRESENCE_SHORTFALL") {
        const list = chargeMonthsByNation.get(event.body.nationId) ?? [];
        list.push(month);
        chargeMonthsByNation.set(event.body.nationId, list);
      }
    }
    for (const [nationId, nation] of result.finalSnapshot.nations) {
      const list = prestigeByNation.get(nationId) ?? [];
      list.push(Number(nation.prestige));
      prestigeByNation.set(nationId, list);
    }
    if (result.finalSnapshot.careerResult !== undefined) sackedMonth = month;
    snapshot = { ...result.finalSnapshot, turnNumber: SafeInt(Number(snapshot.turnNumber) + 1) };
  }
  return { chargeMonthsByNation, prestigeByNation, sackedMonth };
}

export function measurePresenceSeverity(
  options: PresenceSeverityOptions,
): readonly PresenceSeverityRow[] {
  const { state, bundle } = compileProductionCampaign();
  const base = presenceFromRulesets(bundle.rulesets);
  if (base === undefined) {
    throw new PresenceSeverityRunFailed({ detail: "production 1880 pack has no presence section" });
  }
  const rules = options.presenceOverride?.(base) ?? base;
  const playable = state.snapshot.slots
    .filter((slot) => slot.type === "playable")
    .map((slot) => slot.nationId)
    .filter((nationId) => options.nationIds?.includes(nationId) ?? true)
    .sort();
  const rows: PresenceSeverityRow[] = [];
  for (const posture of options.postures ?? (["orders_ignored", "posts_idle_ship"] as const)) {
    for (const nationId of playable) {
      const run = runCampaign(
        state.snapshot,
        rules,
        options.months,
        nationId,
        posture === "posts_idle_ship",
      );
      const prestigeByMonth = run.prestigeByNation.get(nationId) ?? [];
      const chargeMonths = run.chargeMonthsByNation.get(nationId) ?? [];
      const eligibleIndex = prestigeByMonth.findIndex((value) => value <= options.sackingThreshold);
      rows.push({
        nationId,
        posture,
        firstChargeMonth: chargeMonths[0],
        chargeMonths: chargeMonths.length,
        eligibleMonth: eligibleIndex < 0 ? undefined : eligibleIndex + 1,
        sackedMonth: run.sackedMonth,
        prestigeByMonth,
      });
    }
  }
  return rows;
}

export function formatPresenceSeverity(rows: readonly PresenceSeverityRow[]): string {
  const cell = (value: number | undefined): string => (value === undefined ? "-" : String(value));
  const lines = [
    "nation | posture | first charge | charges | sack-eligible | sacked (one seeded draw) | prestige end",
  ];
  for (const row of rows) {
    const last = row.prestigeByMonth[row.prestigeByMonth.length - 1];
    lines.push(
      [
        row.nationId,
        row.posture,
        cell(row.firstChargeMonth),
        row.chargeMonths,
        cell(row.eligibleMonth),
        cell(row.sackedMonth),
        cell(last),
      ].join(" | "),
    );
  }
  return lines.join("\n");
}
