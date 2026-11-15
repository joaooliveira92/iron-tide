import { describe, expect, it } from "vite-plus/test";
import type { CampaignSnapshot } from "@bluewave/campaign";
import { presenceFromRulesets } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { MonthExecutor, type MonthResult } from "@bluewave/phase-engine";
import { compileProductionCampaign } from "../src/production-pack.js";

const MONTHS = 12;

const PROVISIONAL_PENALTY = { lossBpPerWholeShortfall: 200, maxLossBp: 500 } as const;

interface Passive {
  readonly shortfallEvents: number;
  readonly presenceLosses: readonly string[];
  readonly firstMonthLosses: readonly string[];
}

function runPassive(shortfallPrestige?: typeof PROVISIONAL_PENALTY): Passive {
  const { state, bundle } = compileProductionCampaign();
  const section = presenceFromRulesets(bundle.rulesets);
  if (section === undefined) throw new Error("production 1880 pack has no presence section");
  const presence = {
    ...section,
    ...(shortfallPrestige === undefined ? {} : { shortfallPrestige }),
  };
  const executor = new MonthExecutor();
  let snapshot: CampaignSnapshot = state.snapshot;
  let shortfallEvents = 0;
  const presenceLosses: string[] = [];
  const firstMonthLosses: string[] = [];
  for (let month = 1; month <= MONTHS; month += 1) {
    const result: MonthResult = executor.execute(
      snapshot,
      [],
      `presence-1880-interim-${month}`,
      new DiagnosticCollector(),
      undefined,
      { presence },
    );
    if (!result.success) throw new Error(`month ${month} failed`);
    for (const event of result.eventLedger.all) {
      if (event.body.kind === "PresenceShortfall") shortfallEvents += 1;
      if (event.body.kind === "PrestigeChanged" && event.body.reasonCode === "PRESENCE_SHORTFALL") {
        const loss = `${event.body.nationId}:${month}`;
        presenceLosses.push(loss);
        if (month === 1) firstMonthLosses.push(loss);
      }
    }
    snapshot = result.finalSnapshot;
  }
  return { shortfallEvents, presenceLosses, firstMonthLosses };
}

describe("1880 presence prestige penalty is off as the interim (#833, decision request 0060 Option E)", () => {
  it("ships presence rules that keep penalty requests and carry no prestige loss", () => {
    const { bundle } = compileProductionCampaign();
    const section = presenceFromRulesets(bundle.rulesets);
    expect(section?.penaltyRequests).toBe(true);
    expect(section?.shortfallPrestige).toBeUndefined();
  });

  it("charges a passive nation no prestige for a presence shortfall over the first 12 months, and still emits the shortfall events", () => {
    const passive = runPassive();
    expect(passive.shortfallEvents).toBeGreaterThan(0);
    expect(passive.presenceLosses).toEqual([]);
  });

  it("would charge them in month 1 if the PROVISIONAL penalty were restored, so the passive run exercises the path", () => {
    const control = runPassive(PROVISIONAL_PENALTY);
    expect(control.firstMonthLosses.length).toBeGreaterThan(0);
  });
});
