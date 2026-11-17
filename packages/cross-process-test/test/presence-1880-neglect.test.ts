import { describe, expect, it } from "vite-plus/test";
import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { presenceFromRulesets } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor } from "@bluewave/phase-engine";
import { compileProductionCampaign } from "../src/production-pack.js";

const MONTHS = 24;
const GRACE_MONTHS = 12;

interface Run {
  readonly shortfallEvents: number;
  readonly lossMonthsByNation: ReadonlyMap<string, readonly number[]>;
  readonly unrestByNation: ReadonlyMap<string, number | undefined>;
}

function postUkDreadnought(snapshot: CampaignSnapshot): CampaignSnapshot {
  const uk = snapshot.nations.get("uk");
  if (uk === undefined) throw new Error("production 1880 pack has no uk");
  const posted: NationState = {
    ...uk,
    fleets: uk.fleets.map((fleet) => ({
      ...fleet,
      ships: fleet.ships.map((ship) =>
        ship.id === "gbr_dreadnought"
          ? { ...ship, stationAssignment: "FOREIGN_STATION" as const }
          : ship,
      ),
    })),
  };
  return { ...snapshot, nations: new Map(snapshot.nations).set("uk", posted) };
}

function runPassive(post: boolean): Run {
  const { state, bundle } = compileProductionCampaign();
  const presence = presenceFromRulesets(bundle.rulesets);
  if (presence === undefined) throw new Error("production 1880 pack has no presence section");
  const executor = new MonthExecutor();
  let snapshot: CampaignSnapshot = post ? postUkDreadnought(state.snapshot) : state.snapshot;
  let shortfallEvents = 0;
  const lossMonthsByNation = new Map<string, number[]>();
  for (let month = 1; month <= MONTHS; month += 1) {
    const result = executor.execute(
      snapshot,
      [],
      `presence-1880-neglect-${month}`,
      new DiagnosticCollector(),
      undefined,
      { presence },
    );
    if (!result.success) throw new Error(`month ${month} failed`);
    for (const event of result.eventLedger.all) {
      if (event.body.kind === "PresenceShortfall") shortfallEvents += 1;
      if (event.body.kind === "PrestigeChanged" && event.body.reasonCode === "PRESENCE_SHORTFALL") {
        lossMonthsByNation.set(event.body.nationId, [
          ...(lossMonthsByNation.get(event.body.nationId) ?? []),
          month,
        ]);
      }
    }
    snapshot = { ...result.finalSnapshot, turnNumber: SafeInt(Number(snapshot.turnNumber) + 1) };
  }
  const unrestByNation = new Map(
    [...snapshot.nations].map(([id, nation]) => [id, nation.unrest] as const),
  );
  return { shortfallEvents, lossMonthsByNation, unrestByNation };
}

describe("1880 presence prestige charge bites on neglect, not on the opening (#838, decision request 0060)", () => {
  it("ships the PROVISIONAL charge with a 12 month opening grace and the surplus-ship rule", () => {
    const { bundle } = compileProductionCampaign();
    expect(presenceFromRulesets(bundle.rulesets)?.shortfallPrestige).toEqual({
      lossBpPerWholeShortfall: 200,
      maxLossBp: 500,
      openingGraceMonths: GRACE_MONTHS,
      surplusShipsOnly: true,
    });
  });

  it("charges no nation during the opening although every nation starts short", () => {
    const passive = runPassive(false);
    expect(passive.shortfallEvents).toBeGreaterThan(0);
    const early = [...passive.lossMonthsByNation.values()]
      .flat()
      .filter((month) => month <= GRACE_MONTHS);
    expect(early).toEqual([]);
  });

  it("then charges only the nation that leaves a surplus ship idle, from the first month after the grace", () => {
    const passive = runPassive(false);
    expect([...passive.lossMonthsByNation.keys()]).toEqual(["uk"]);
    expect(passive.lossMonthsByNation.get("uk")).toEqual([
      13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
    ]);
  });

  it("charges the same nation nothing once its surplus ship is posted to a station", () => {
    const posted = runPassive(true);
    expect(posted.lossMonthsByNation.size).toBe(0);
    expect([...posted.unrestByNation.values()].filter((unrest) => unrest !== undefined)).toEqual(
      [],
    );
  });

  it("ships the PROVISIONAL unrest nudge of 1 a charged month (#826)", () => {
    const { bundle } = compileProductionCampaign();
    expect(presenceFromRulesets(bundle.rulesets)?.shortfallUnrest).toEqual({
      unrestPerShortMonth: 1,
    });
  });

  it("raises unrest only for the charged nation, until the meter's ceiling of 10", () => {
    const passive = runPassive(false);
    const raised = [...passive.unrestByNation].filter(([, unrest]) => unrest !== undefined);
    expect(passive.lossMonthsByNation.get("uk")).toHaveLength(12);
    expect(raised).toEqual([["uk", 10]]);
  });
});
