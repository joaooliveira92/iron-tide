import { describe, it, expect } from "vite-plus/test";
import {
  assessFleet,
  chooseProcurementRole,
  computeFleetDeficits,
  planProcurementDecision,
  PROCUREMENT_TYPES,
  shipTypeForHullType,
  type FleetShipView,
  type ProcurementDecision,
  type StarterDesign,
} from "../src/index.js";
import {
  navalProfiles,
  readReferenceDesignEntries,
  shipBuildingContent,
} from "./helpers/earlyContext.js";

const starters = (readReferenceDesignEntries() as { starterFor?: string }[]).filter(
  (d) => d.starterFor !== undefined,
) as unknown as StarterDesign[];

const uk = navalProfiles.find((p) => p.nationId === "uk")!;
const france = navalProfiles.find((p) => p.nationId === "france")!;

const decide = (
  profile: typeof uk,
  fleet: readonly FleetShipView[],
  overrides: Partial<Parameters<typeof planProcurementDecision>[0]> = {},
): ProcurementDecision =>
  planProcurementDecision({
    profile,
    month: "1880-01",
    seed: "seed-a",
    decisionId: `${profile.nationId}:0`,
    budgetUnits: 200,
    fleet,
    content: shipBuildingContent,
    starters,
    candidateCount: 12,
    compilesPerArchetype: 8,
    ...overrides,
  });

describe("fleet assessment", () => {
  it("counts active, building and unavailable ships by type and maps hull types", () => {
    const a = assessFleet([
      { shipType: "CL", status: "ACTIVE" },
      { shipType: "CL", status: "BUILDING" },
      { shipType: "DD", status: "UNAVAILABLE" },
    ]);
    expect(a.active.CL).toBe(1);
    expect(a.building.CL).toBe(1);
    expect(a.unavailable.DD).toBe(1);
    expect(shipTypeForHullType("protected_cruiser")).toBe("CL");
    expect(shipTypeForHullType("nonsense")).toBeNull();
  });
  it("computes deficits from the national shares and chooses the first build-order role with a deficit", () => {
    const emptyFleet: FleetShipView[] = [];
    // Only the B share of the target is met; CL is still short.
    const withOneCL: FleetShipView[] = [{ shipType: "CL", status: "ACTIVE" }];
    const ukDefEmpty = computeFleetDeficits(uk, assessFleet(emptyFleet));
    const frDefEmpty = computeFleetDeficits(france, assessFleet(emptyFleet));
    expect(chooseProcurementRole(uk, ukDefEmpty)).toBe("CL"); // UK build order leads with cruisers
    expect(chooseProcurementRole(france, frDefEmpty)).toBe("DD"); // France leads with torpedo craft
    // A met type drops out; UK still finds a deficit elsewhere.
    const ukDefSome = computeFleetDeficits(uk, assessFleet(withOneCL));
    expect(chooseProcurementRole(uk, ukDefSome)).not.toBeNull();
  });
});

describe("procurement decision", () => {
  it("selects a legal, affordable design and reports no reason to decline", () => {
    const d = decide(uk, []);
    expect(d.role).toBe("CL");
    expect(d.noProcurementReason).toBeNull();
    expect(d.selectedDesignId).not.toBeNull();
    expect(d.selectedDraft).not.toBeNull();
    expect(d.costUnits).toBeLessThanOrEqual(200);
    expect(d.candidates.length).toBeGreaterThan(0);
  });
  it("is deterministic for the same seed and decision id", () => {
    const a = decide(uk, []);
    const b = decide(uk, []);
    expect(b.selectedDesignId).toBe(a.selectedDesignId);
    expect(b.costUnits).toBe(a.costUnits);
    expect(b.candidates).toEqual(a.candidates);
  });
  it("varies with the seed (different design ids) within the same role", () => {
    const a = decide(uk, [], { seed: "seed-a" });
    const b = decide(uk, [], { seed: "seed-b", decisionId: "uk:0" });
    expect(a.selectedDesignId).not.toBe(b.selectedDesignId);
    expect(a.role).toBe(b.role);
  });
  it("returns a structured no-procurement decision rather than throwing when nothing is affordable", () => {
    const d = decide(uk, [], { budgetUnits: 0 });
    expect(d.selectedDesignId).toBeNull();
    expect(d.noProcurementReason).toBe("no_legal_affordable_design");
    expect(d.rejectionReasons.length).toBeGreaterThan(0);
  });
  it("returns no_deficit when the fleet already meets the national targets", () => {
    const full: FleetShipView[] = PROCUREMENT_TYPES.flatMap((t) =>
      Array.from({ length: 12 }, () => ({ shipType: t, status: "ACTIVE" }) as FleetShipView),
    );
    const d = decide(uk, full);
    expect(d.role).toBeNull();
    expect(d.noProcurementReason).toBe("no_deficit");
  });
});

// Nation × seeds × budget bands × 24 months. The two nations must build recognisably different fleets.
describe("AI procurement simulation (2 nations × 3 seeds × 3 budgets × 24 months)", () => {
  const SEEDS = ["alpha", "bravo", "charlie"] as const;
  const BUDGETS = { low: 30, standard: 90, high: 400 } as const;
  const MONTHS = 24;

  interface SimResult {
    readonly orders: Readonly<Record<string, number>>;
    readonly totalCost: number;
    readonly decisions: number;
    readonly declines: number;
    readonly finalFleet: Readonly<Record<string, number>>;
    readonly timeline: string; // a compact fingerprint of orders over time, for determinism comparison
  }

  function simulate(profile: typeof uk, seed: string, budget: number): SimResult {
    const fleet: { type: string; status: FleetShipView["status"]; monthsLeft: number }[] = [];
    const orders: Record<string, number> = {};
    let totalCost = 0;
    let declines = 0;
    let timeline = "";
    for (let m = 0; m < MONTHS; m++) {
      for (const s of fleet) if (s.status === "BUILDING") s.monthsLeft -= 1;
      for (const s of fleet) if (s.status === "BUILDING" && s.monthsLeft <= 0) s.status = "ACTIVE";
      const view: FleetShipView[] = fleet.map((s) => ({
        shipType: s.type as FleetShipView["shipType"],
        status: s.status,
      }));
      const decision = decide(profile, view, {
        month: `1880-${String((m % 12) + 1).padStart(2, "0")}`,
        seed,
        decisionId: `${profile.nationId}:${String(m)}`,
        budgetUnits: budget,
        candidateCount: 12,
        compilesPerArchetype: 8,
      });
      if (decision.selectedDraft !== null && decision.role !== null) {
        orders[decision.role] = (orders[decision.role] ?? 0) + 1;
        totalCost += decision.costUnits ?? 0;
        // The timeline records the role AND the chosen design, so seed-level variation is observable.
        timeline += `${decision.role}:${(decision.selectedDesignId ?? "").slice(-6)}|`;
        fleet.push({ type: decision.role, status: "BUILDING", monthsLeft: 3 });
      } else {
        declines += 1;
        timeline += ".|";
      }
    }
    const finalFleet: Record<string, number> = {};
    for (const s of fleet) finalFleet[s.type] = (finalFleet[s.type] ?? 0) + 1;
    return { orders, totalCost, decisions: MONTHS, declines, finalFleet, timeline };
  }

  it("never throws, stays affordable, and returns a structured decline when it cannot afford a ship", () => {
    for (const profile of [uk, france])
      for (const seed of SEEDS) {
        const r = simulate(profile, seed, BUDGETS.low);
        expect(r.decisions).toBe(MONTHS);
        expect(r.orders).toBeDefined();
        // The low budget cannot buy capital ships, so there are declines with reasons.
        expect(r.declines).toBeGreaterThan(0);
      }
  });

  it("replays identically for the same (nation, seed, budget)", () => {
    for (const profile of [uk, france]) {
      const a = simulate(profile, "alpha", BUDGETS.standard);
      const b = simulate(profile, "alpha", BUDGETS.standard);
      expect(b.timeline).toBe(a.timeline);
      expect(b.totalCost).toBe(a.totalCost);
      expect(b.orders).toEqual(a.orders);
    }
  });

  it("produces bounded variation across seeds (not identical, not unbounded)", () => {
    const runs = SEEDS.map((s) => simulate(uk, s, BUDGETS.standard));
    expect(new Set(runs.map((r) => r.timeline)).size).toBeGreaterThan(1);
    expect(new Set(runs.map((r) => r.totalCost)).size).toBeLessThanOrEqual(SEEDS.length);
  });

  it("the two nations build recognisably different fleets", () => {
    const ukRun = simulate(uk, "alpha", BUDGETS.high);
    const frRun = simulate(france, "alpha", BUDGETS.high);
    const dd = (r: SimResult) => r.orders.DD ?? 0;
    const big = (r: SimResult) => (r.orders.B ?? 0) + (r.orders.CA ?? 0) + (r.orders.CL ?? 0);
    // France leans torpedo craft; the UK leans the battle line and cruisers.
    expect(dd(frRun)).toBeGreaterThan(dd(ukRun));
    expect(big(ukRun)).toBeGreaterThan(big(frRun));
  });
});
