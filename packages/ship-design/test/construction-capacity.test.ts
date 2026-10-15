// SB3-R18/R19 (DESIGN-16 sections 7-9, 17): the concurrency cap, the AMC/small-corvette exemption split, and the
// deterministic reservation ordering are pure, integer-only derivations.
import { describe, expect, it } from "vite-plus/test";
import {
  allocateConstructionReservations,
  capacityExemptionApplies,
  compareCapacityReservations,
  effectiveExemptCapacityBp,
  externalPoolConsumption,
  maxConcurrentConstructionMassKg,
  normalPoolConsumption,
  reservedNewConstructionMassKg,
  shippedConstructionCapacityExemptions,
  type CapacityReservation,
  type ConstructionCapacityExemptionDefinition,
} from "../src/index.js";
import { constructionBalance } from "./helpers/earlyContext.js";

const exemption = (
  over: Partial<ConstructionCapacityExemptionDefinition> = {},
): ConstructionCapacityExemptionDefinition => ({
  definitionId: "test_exemption_v1",
  eligibleShipType: "AMC",
  eligibilityPredicateId: "ship_type_and_max_displacement_v1",
  maximumQualifyingDisplacementKg: 10_000_000,
  exemptCapacityBp: 5_000,
  monthlyAggregateExemptionCapKg: 100_000_000,
  externalCapacitySourceId: "test_source",
  stackingRule: "MAX_EXEMPTION",
  version: 1,
  ...over,
});

describe("maxConcurrentConstructionMassKg (SB3-R18)", () => {
  it("is floor(dockMaxMassKg * multipleBp / 10_000)", () => {
    expect(maxConcurrentConstructionMassKg(13_000_000, 30_000)).toBe(39_000_000);
    // floor of an inexact product, never rounded up.
    expect(maxConcurrentConstructionMassKg(100, 3_333)).toBe(33); // floor(333_300 / 10_000)
    expect(maxConcurrentConstructionMassKg(100, 10_000)).toBe(100);
  });

  it("fails closed to zero for a missing or invalid dock size or multiple", () => {
    expect(maxConcurrentConstructionMassKg(0, 30_000)).toBe(0);
    expect(maxConcurrentConstructionMassKg(-1, 30_000)).toBe(0);
    expect(maxConcurrentConstructionMassKg(13_000_000, 0)).toBe(0);
    expect(maxConcurrentConstructionMassKg(Number.NaN, 30_000)).toBe(0);
  });
});

describe("the DESIGN-16 section 9 exemption split", () => {
  it("normalPoolConsumption ceilings the non-exempt share and externalPoolConsumption is the remainder", () => {
    expect(normalPoolConsumption(1_000, 8_000)).toBe(200); // ceil(1000 * 2000 / 10000)
    expect(externalPoolConsumption(1_000, 8_000)).toBe(800);
    // A ceiling that actually rounds up matters at the boundary.
    expect(normalPoolConsumption(3, 6_667)).toBe(1); // ceil(3 * 3333 / 10000) = ceil(0.9999) = 1
    expect(externalPoolConsumption(3, 6_667)).toBe(2);
  });

  it("conserves work: normal + external equals appliedWork for every valid exempt share", () => {
    for (const bp of [0, 1, 2_500, 5_000, 9_999, 10_000]) {
      const work = 1_234_567;
      expect(normalPoolConsumption(work, bp) + externalPoolConsumption(work, bp)).toBe(work);
    }
  });

  it("handles the extremes: no exemption takes all work, full exemption takes none", () => {
    expect(normalPoolConsumption(1_000, 0)).toBe(1_000);
    expect(externalPoolConsumption(1_000, 0)).toBe(0);
    expect(normalPoolConsumption(1_000, 10_000)).toBe(0);
    expect(externalPoolConsumption(1_000, 10_000)).toBe(1_000);
  });

  it("treats missing or out-of-range exemption data as exactly zero exempt basis points", () => {
    expect(normalPoolConsumption(1_000, Number.NaN)).toBe(1_000);
    expect(normalPoolConsumption(1_000, -500)).toBe(1_000);
    expect(normalPoolConsumption(1_000, 20_000)).toBe(0);
  });
});

describe("the eligibility predicate (DESIGN-16 section 9)", () => {
  const def = exemption({ maximumQualifyingDisplacementKg: 1_000_000 });

  it("matches the eligible ship type at or below the qualifying displacement", () => {
    expect(
      capacityExemptionApplies(def, {
        hullType: "armed_merchant_cruiser",
        displacementKg: 999_999,
      }),
    ).toBe(true);
    expect(
      capacityExemptionApplies(def, {
        hullType: "armed_merchant_cruiser",
        displacementKg: 1_000_000,
      }),
    ).toBe(true);
  });

  it("rejects a different type, an oversized hull, or a non-positive displacement", () => {
    expect(capacityExemptionApplies(def, { hullType: "corvette", displacementKg: 500_000 })).toBe(
      false,
    );
    expect(
      capacityExemptionApplies(def, {
        hullType: "armed_merchant_cruiser",
        displacementKg: 1_000_001,
      }),
    ).toBe(false);
    expect(
      capacityExemptionApplies(def, { hullType: "armed_merchant_cruiser", displacementKg: 0 }),
    ).toBe(false);
  });
});

describe("reservedNewConstructionMassKg", () => {
  it("reserves the whole displacement without an exemption and the non-exempt share with one", () => {
    expect(
      reservedNewConstructionMassKg({ hullType: "battleship", displacementKg: 10_000_000 }, []),
    ).toBe(10_000_000);
    expect(
      reservedNewConstructionMassKg(
        { hullType: "armed_merchant_cruiser", displacementKg: 1_000_000 },
        [exemption({ exemptCapacityBp: 8_000 })],
      ),
    ).toBe(200_000);
  });

  it("stacks matching exemptions by max (never above 10_000 bp)", () => {
    const defs = [exemption({ exemptCapacityBp: 4_000 }), exemption({ exemptCapacityBp: 6_000 })];
    expect(
      effectiveExemptCapacityBp(defs, { hullType: "armed_merchant_cruiser", displacementKg: 1 }),
    ).toBe(6_000);
    const sum = [
      exemption({ exemptCapacityBp: 4_000, stackingRule: "SUM_EXEMPTION" }),
      exemption({ exemptCapacityBp: 9_000, stackingRule: "SUM_EXEMPTION" }),
    ];
    expect(
      effectiveExemptCapacityBp(sum, { hullType: "armed_merchant_cruiser", displacementKg: 1 }),
    ).toBe(10_000);
  });
});

describe("shippedConstructionCapacityExemptions", () => {
  const balance = constructionBalance;
  const defs = shippedConstructionCapacityExemptions(balance, 13_000_000);

  it("defines an AMC exemption and a small-corvette exemption, each with its own external source", () => {
    const amc = defs.find((d) => d.eligibleShipType === "AMC")!;
    const corvette = defs.find((d) => d.eligibleShipType === "KE")!;
    expect(amc.externalCapacitySourceId).not.toBe(corvette.externalCapacitySourceId);
    expect(amc.exemptCapacityBp).toBe(balance.amcCapacityExemptionBp);
    expect(amc.exemptCapacityBp).toBeGreaterThan(0);
    expect(amc.exemptCapacityBp).toBeLessThanOrEqual(10_000);
  });

  it("bounds the small corvette at the versioned threshold and its monthly cap at the nation's cap", () => {
    const corvette = defs.find((d) => d.eligibleShipType === "KE")!;
    expect(corvette.maximumQualifyingDisplacementKg).toBe(balance.smallCorvetteMaxDisplacementKg);
    expect(corvette.monthlyAggregateExemptionCapKg).toBe(
      maxConcurrentConstructionMassKg(13_000_000, balance.shipyardCapacityMultipleBp),
    );
  });

  it("a corvette over the small threshold is not exempt; one at or under it is", () => {
    const threshold = balance.smallCorvetteMaxDisplacementKg;
    expect(
      reservedNewConstructionMassKg({ hullType: "corvette", displacementKg: threshold + 1 }, defs),
    ).toBe(threshold + 1);
    expect(
      reservedNewConstructionMassKg({ hullType: "corvette", displacementKg: threshold }, defs),
    ).toBeLessThan(threshold);
  });
});

describe("deterministic capacity allocation (DESIGN-16 section 17)", () => {
  const reservation = (
    projectId: string,
    pool: CapacityReservation["pool"],
    massKg: number,
  ): CapacityReservation => ({ projectId, pool, massKg });

  it("orders by pool priority, then ascending project id", () => {
    const a = reservation("con_b", "NEW_CONSTRUCTION", 1);
    const b = reservation("con_a", "NEW_CONSTRUCTION", 1);
    const c = reservation("con_c", "REPAIR", 1);
    expect([a, b, c].sort(compareCapacityReservations).map((r) => r.projectId)).toEqual([
      "con_a",
      "con_b",
      "con_c",
    ]);
  });

  it("allocates in that order and rejects the reservation that would exceed the cap", () => {
    const reservations = [
      reservation("con_c", "NEW_CONSTRUCTION", 30),
      reservation("con_a", "NEW_CONSTRUCTION", 40),
      reservation("con_b", "NEW_CONSTRUCTION", 40),
    ];
    const out = allocateConstructionReservations(reservations, 70);
    // con_a (40) then con_b (40) would reach 80 > 70, so con_b is rejected and con_c (30) still fits: 70.
    expect(out.accepted).toEqual(["con_a", "con_c"]);
    expect(out.rejected).toEqual(["con_b"]);
    expect(out.allocatedMassKg).toBe(70);
  });

  it("is independent of database/insertion order", () => {
    const reservations = [
      reservation("con_b", "NEW_CONSTRUCTION", 40),
      reservation("con_a", "NEW_CONSTRUCTION", 40),
      reservation("con_c", "NEW_CONSTRUCTION", 30),
    ];
    const forward = allocateConstructionReservations(reservations, 70);
    const reversed = allocateConstructionReservations([...reservations].reverse(), 70);
    expect(reversed).toEqual(forward);
  });
});
