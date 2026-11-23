import type { CampaignSnapshot } from "@bluewave/campaign";
import { MAX_ECONOMIC_BASE } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { decodeBaseGrowthRules } from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor, type MonthExecutorEngineOptions } from "../src/index.js";
import { tradeSnapshot } from "./fixtures/trade-protection.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "12-13" }],
  note: "PROVISIONAL test fixture",
};

const fixtureSection = {
  sectionVersion: 1,
  nations: { GBR: { annualGrowthBp: 400, provenance } },
};

function fixtureRules(): NonNullable<MonthExecutorEngineOptions["baseGrowth"]> {
  const decoded = decodeBaseGrowthRules(fixtureSection);
  if (!decoded.ok) throw new Error("fixture baseGrowth must decode");
  return decoded.value;
}

function start(base: number): CampaignSnapshot {
  return tradeSnapshot({
    gbrShips: [],
    atWar: false,
    month: 1,
    gbr: { baseResources: base as never },
    fra: { baseResources: 60_000 as never },
  });
}

function run(from: CampaignSnapshot, options: MonthExecutorEngineOptions) {
  const collector = new DiagnosticCollector();
  const result = new MonthExecutor().execute(from, [], "growth-seed", collector, undefined, {
    playerNationId: "GBR",
    ...options,
  });
  return Object.assign(result, { collector });
}

function atTurn(from: CampaignSnapshot, turn: number): CampaignSnapshot {
  return { ...from, turnNumber: SafeInt(turn) };
}

const digest = (value: unknown) => sha256Hex(canonicalSerialize(value));

function recurrence(base: number, bp: number, months: number): number {
  let b = base;
  for (let i = 0; i < months; i++) {
    const scaled = b * bp;
    const whole = Math.floor(scaled / 120_000);
    const remainder = scaled - whole * 120_000;
    const phase = (i + 1) % 12;
    const carried =
      Math.floor((remainder * (phase + 1)) / 120_000) - Math.floor((remainder * phase) / 120_000);
    b = Math.min(MAX_ECONOMIC_BASE, b + whole + carried);
  }
  return b;
}

describe("monthly base growth (S-3 D7)", () => {
  it("equals the integer recurrence after 120 months and leaves unlisted nations flat", () => {
    const rules = fixtureRules();
    let snapshot = start(60_000);
    for (let month = 0; month < 120; month++)
      snapshot = run(atTurn(snapshot, month + 1), { baseGrowth: rules }).finalSnapshot;
    expect(snapshot.nations.get("GBR")!.baseResources).toBe(recurrence(60_000, 400, 120));
    expect(snapshot.nations.get("FRA")!.baseResources).toBe(60_000);
  });

  it("grows a small base through the month pipeline instead of flooring it to zero", () => {
    const rules = fixtureRules();
    let snapshot = start(180);
    for (let month = 0; month < 12; month++)
      snapshot = run(atTurn(snapshot, month + 1), { baseGrowth: rules }).finalSnapshot;
    const grown = snapshot.nations.get("GBR")!.baseResources as number;
    expect(grown).toBe(recurrence(180, 400, 12));
    expect(grown).toBeGreaterThan(180);
  });

  it("grows the base before the month's revenue is computed", () => {
    const grown = recurrence(60_000, 400, 1);
    const withGrowth = run(start(60_000), { baseGrowth: fixtureRules() });
    const flat = run(start(grown), {});
    const gbr = (r: typeof withGrowth) => r.finalSnapshot.nations.get("GBR")!.treasury;
    expect(gbr(withGrowth)).toBe(gbr(flat));
  });

  it("is byte-identical to a run without the section when the section is absent", () => {
    const from = start(60_000);
    const dormant = run(from, {});
    const baseline = new MonthExecutor().execute(
      from,
      [],
      "growth-seed",
      new DiagnosticCollector(),
    );
    expect(digest(dormant.finalSnapshot)).toBe(digest(baseline.finalSnapshot));
    expect(digest(dormant.eventLedger.all)).toBe(digest(baseline.eventLedger.all));
    expect(digest(dormant.financialLedger.all)).toBe(digest(baseline.financialLedger.all));
  });

  it("changes no ledger or event sequence when the base is zero", () => {
    const from = start(0);
    const grown = run(from, { baseGrowth: fixtureRules() });
    const flat = run(from, {});
    expect(digest(grown.finalSnapshot)).toBe(digest(flat.finalSnapshot));
    expect(digest(grown.eventLedger.all)).toBe(digest(flat.eventLedger.all));
  });

  it("clamps at the economic ceiling and warns once, on the month it is reached", () => {
    const rules = fixtureRules();
    const first = run(start(MAX_ECONOMIC_BASE - 1), { baseGrowth: rules });
    expect(first.finalSnapshot.nations.get("GBR")!.baseResources).toBe(MAX_ECONOMIC_BASE);
    const warnings = (r: typeof first) =>
      r.collector.all.filter((d) => d.code === "ECONOMIC_BASE_CEILING_REACHED");
    expect(warnings(first)).toHaveLength(1);
    const second = run(first.finalSnapshot, { baseGrowth: rules });
    expect(second.finalSnapshot.nations.get("GBR")!.baseResources).toBe(MAX_ECONOMIC_BASE);
    expect(warnings(second)).toHaveLength(0);
  });
});
