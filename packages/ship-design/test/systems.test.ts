import { describe, it, expect } from "vite-plus/test";
import {
  compileSystems,
  checkFindingShape,
  type SystemsBalance,
  type SystemsInput,
} from "../src/index.js";

const bal: SystemsBalance = {
  caseProfileBp: {
    DEFAULT: { HARBOUR: 1_000, CRUISING: 6_000, ACTION: 10_000 },
    MAIN_GUN: { HARBOUR: 0, CRUISING: 500, ACTION: 10_000 },
  },
  generatorConcentrationDerateBp: 2_500,
  coolingReliabilityPerPercentBp: 50,
  hullCrewPerTonneX1000: 40,
  litrePerHead: { SPARTAN: 2_000, STANDARD: 3_000, GENEROUS: 4_500 },
  baseAccuracyBp: 5_000,
  localControlPenaltyBp: 1_500,
  smokeInterferencePermille: 40,
  smokeInterferencePenaltyBp: 1_000,
};
const base: SystemsInput = {
  items: [
    { instanceId: "a", category: "MAIN_GUN", powerKw: 100, coolingKw: 0, crew: 20 },
    { instanceId: "b", category: "DIRECTOR", powerKw: 50, coolingKw: 10, crew: 6 },
  ],
  generators: [
    { instanceId: "g1", kw: 100, zoneId: "CENTRAL_MACHINERY" },
    { instanceId: "g2", kw: 100, zoneId: "AFT_SERVICE" },
  ],
  coolingSupplyKw: 20,
  displacementKg: 1_000_000,
  accommodationStandard: "STANDARD",
  accommodationVolumeLitre: 300_000,
  guns: [
    { instanceId: "g_a", fcClass: "heavy" },
    { instanceId: "g_b", fcClass: "heavy" },
  ],
  directors: [
    {
      instanceId: "d1",
      supportedClasses: ["heavy"],
      accuracyBonusBp: 2_000,
      capacity: 2,
      stationPermille: 400,
    },
  ],
  funnelStationsPermille: [550],
};

describe("electrical", () => {
  it("applies per-category case profiles", () => {
    const r = compileSystems(base, bal);
    expect(r.demandKw.ACTION).toBe(150);
    expect(r.demandKw.CRUISING).toBe(5 + 30);
    expect(r.demandKw.HARBOUR).toBe(0 + 5);
    expect(r.supplyKw).toBe(200);
    expect(r.findings.filter((f) => f.id === "POWER_SHORTFALL")).toEqual([]);
  });
  it("shortfall is CRITICAL with remedies; concentration derates supply", () => {
    const short = compileSystems(
      { ...base, generators: [{ instanceId: "g1", kw: 100, zoneId: "CENTRAL_MACHINERY" }] },
      bal,
    );
    const f = short.findings.find((x) => x.id === "POWER_SHORTFALL")!;
    expect(f.severity).toBe("CRITICAL");
    expect(checkFindingShape(f)).toEqual([]);
    const conc = compileSystems(
      {
        ...base,
        generators: [
          { instanceId: "g1", kw: 100, zoneId: "CENTRAL_MACHINERY" },
          { instanceId: "g2", kw: 100, zoneId: "CENTRAL_MACHINERY" },
        ],
      },
      bal,
    );
    expect(conc.supplyKw).toBe(150);
    expect(conc.findings.some((x) => x.id === "POWER_SHORTFALL")).toBe(false);
    const concShort = compileSystems(
      {
        ...base,
        items: [{ ...base.items[0]!, powerKw: 180 }],
        generators: [
          { instanceId: "g1", kw: 100, zoneId: "CENTRAL_MACHINERY" },
          { instanceId: "g2", kw: 100, zoneId: "CENTRAL_MACHINERY" },
        ],
      },
      bal,
    );
    expect(concShort.findings.find((x) => x.id === "POWER_SHORTFALL")!.why).toContain(
      "concentrated",
    );
  });
  it("no generators with demand is a shortfall", () => {
    expect(compileSystems({ ...base, generators: [] }, bal).findings.map((f) => f.id)).toContain(
      "POWER_SHORTFALL",
    );
  });
  it("requires a DEFAULT case profile", () => {
    expect(() => compileSystems(base, { ...bal, caseProfileBp: {} })).toThrow();
  });
});

describe("cooling, crew", () => {
  it("cooling shortfall warns and reduces reliability proportionally", () => {
    const r = compileSystems({ ...base, coolingSupplyKw: 5 }, bal);
    expect(r.coolingShortfallBp).toBe(5_000);
    expect(r.reliabilityPenaltyBp).toBe(2_500);
    expect(r.findings.find((f) => f.id === "COOLING_SHORTFALL")!.severity).toBe("WARNING");
    expect(compileSystems(base, bal).reliabilityPenaltyBp).toBe(0);
  });
  it("crew = hull crew + system crew; overcrowding is CRITICAL", () => {
    const ok = compileSystems(base, bal);
    expect(ok.crewRequired).toBe(40 + 26);
    expect(ok.crewCapacity).toBe(100);
    expect(ok.crowdingBp).toBe(6_600);
    const bad = compileSystems({ ...base, accommodationVolumeLitre: 60_000 }, bal);
    expect(bad.findings.find((f) => f.id === "ACCOMMODATION_SHORT")!.severity).toBe("CRITICAL");
    expect(
      compileSystems(
        { ...base, accommodationVolumeLitre: 60_000, accommodationStandard: "SPARTAN" },
        bal,
      ).findings.some((f) => f.id === "ACCOMMODATION_SHORT"),
    ).toBe(true);
    expect(compileSystems({ ...base, accommodationVolumeLitre: 0 }, bal).crowdingBp).toBe(100_000);
  });
});

describe("fire control", () => {
  it("assigns guns to a compatible director within capacity and adds its bonus", () => {
    const r = compileSystems(base, bal);
    expect(r.gunControl.map((g) => g.accuracyBp)).toEqual([7_000, 7_000]);
    expect(r.findings.filter((f) => f.id === "FC_INCOMPATIBLE")).toEqual([]);
  });
  it("capacity overflow and class mismatch fall back to local control with a warning", () => {
    const r = compileSystems({ ...base, directors: [{ ...base.directors[0]!, capacity: 1 }] }, bal);
    expect(r.gunControl.map((g) => g.directorId)).toEqual(["d1", null]);
    expect(r.gunControl[1]!.accuracyBp).toBe(3_500);
    const f = r.findings.find((x) => x.id === "FC_INCOMPATIBLE")!;
    expect(checkFindingShape(f)).toEqual([]);
    expect(
      compileSystems({ ...base, guns: [{ instanceId: "x", fcClass: "light" }] }, bal).gunControl[0]!
        .directorId,
    ).toBeNull();
  });
  it("better director is preferred; funnel smoke interferes", () => {
    const two = {
      ...base,
      directors: [
        base.directors[0]!,
        {
          instanceId: "d2",
          supportedClasses: ["heavy"],
          accuracyBonusBp: 3_000,
          capacity: 1,
          stationPermille: 300,
        },
      ],
    };
    expect(compileSystems(two, bal).gunControl[0]!.directorId).toBe("d2");
    const smoky = compileSystems({ ...base, funnelStationsPermille: [420] }, bal);
    expect(smoky.findings.map((f) => f.id)).toContain("DIRECTOR_INTERFERENCE");
    expect(smoky.gunControl[0]!.accuracyBp).toBe(6_000);
  });
  it("no guns means no fire-control findings; deterministic", () => {
    const r = compileSystems({ ...base, guns: [] }, bal);
    expect(r.gunControl).toEqual([]);
    expect(JSON.stringify(compileSystems(base, bal))).toBe(
      JSON.stringify(compileSystems({ ...base, items: [...base.items].reverse() }, bal)),
    );
  });
});

describe("fire-control positions (#168 step 3)", () => {
  const withBal = { ...bal, fireControlPositionRedundancyBp: 2_500 };
  const ids = (r: ReturnType<typeof compileSystems>) => r.findings.map((f) => f.id);

  it("warns when directors and guns are fitted but there are no positions", () => {
    const r = compileSystems({ ...base, fireControlPositions: 0 }, withBal);
    expect(ids(r)).toContain("FIRE_CONTROL_NO_POSITIONS");
    expect(r.findings.find((f) => f.id === "FIRE_CONTROL_NO_POSITIONS")!.severity).toBe("WARNING");
    expect(ids(compileSystems(base, withBal))).toContain("FIRE_CONTROL_NO_POSITIONS");
  });
  it("does not warn with a position, with no directors, or with no guns", () => {
    expect(ids(compileSystems({ ...base, fireControlPositions: 1 }, withBal))).not.toContain(
      "FIRE_CONTROL_NO_POSITIONS",
    );
    expect(ids(compileSystems({ ...base, directors: [] }, withBal))).not.toContain(
      "FIRE_CONTROL_NO_POSITIONS",
    );
    expect(ids(compileSystems({ ...base, guns: [] }, withBal))).not.toContain(
      "FIRE_CONTROL_NO_POSITIONS",
    );
  });
  it("redundancy rises with the position count, capped at 10_000, and is 0 without authored balance", () => {
    const at = (n: number) =>
      compileSystems({ ...base, fireControlPositions: n }, withBal).fireControlRedundancyBp;
    expect([at(0), at(1), at(2), at(4), at(9)]).toEqual([0, 2_500, 5_000, 10_000, 10_000]);
    expect(compileSystems({ ...base, fireControlPositions: 3 }, bal).fireControlRedundancyBp).toBe(
      0,
    );
  });
  it("leaves per-gun accuracy untouched (positions are redundancy, not accuracy)", () => {
    expect(compileSystems({ ...base, fireControlPositions: 3 }, withBal).gunControl).toEqual(
      compileSystems(base, withBal).gunControl,
    );
  });
  it("rejects a negative or non-integer count", () => {
    for (const bad of [-1, 1.5])
      expect(() => compileSystems({ ...base, fireControlPositions: bad }, withBal)).toThrow(
        /fireControlPositions/,
      );
  });
});
