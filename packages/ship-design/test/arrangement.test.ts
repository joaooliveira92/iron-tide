import { describe, it, expect } from "vite-plus/test";
import {
  analyseArrangement,
  checkZoneSet,
  ZONE_IDS,
  checkFindingShape,
  type ArrangementBalance,
  type HullEnvelope,
  type ResolvedPlacement,
  type ZoneDef,
} from "../src/index.js";

const edges = [0, 80, 180, 280, 520, 640, 760, 900, 1000];
const zones: ZoneDef[] = ZONE_IDS.map((id, i) => ({
  id,
  startPermille: id === "MISSION" ? 520 : edges[i]!,
  endPermille: id === "MISSION" ? 1000 : edges[i + 1]!,
  volumeBp: [500, 1400, 1100, 2800, 1200, 1100, 1000, 700, 200][i]!,
  deckAreaBp: [1200, 900, 900, 1500, 1500, 900, 900, 1500, 700][i]!,
}));
const hull: HullEnvelope = {
  lengthMm: 100_000,
  beamMm: 12_000,
  depthMm: 8_000,
  volumeFullnessBp: 6_000,
  deckFullnessBp: 7_000,
};
const bal: ArrangementBalance = { concentrationAdvisoryBp: 6_000, concentrationWarningBp: 8_000 };

const mk = (
  o: Partial<ResolvedPlacement> &
    Pick<ResolvedPlacement, "instanceId" | "zoneId" | "stationPermille">,
): ResolvedPlacement => ({
  componentId: "c",
  category: "SPECIAL_EQUIPMENT",
  weightKg: 1_000,
  volumeLitre: 1_000,
  deckFootprintMm2: 1_000_000,
  heightMm: 2_000,
  zCgMm: 3_000,
  allowedZones: [...ZONE_IDS],
  forbidsCoLocation: [],
  critical: false,
  ...o,
});

describe("zone set", () => {
  it("accepts the fixture and rejects broken sets", () => {
    expect(checkZoneSet(zones)).toEqual([]);
    expect(checkZoneSet(zones.slice(1))).not.toEqual([]);
    expect(checkZoneSet(zones.map((z, i) => (i === 0 ? { ...z, volumeBp: 1 } : z)))).toContain(
      "volumeBp must sum to 10000",
    );
    expect(checkZoneSet(zones.map((z, i) => (i === 0 ? { ...z, endPermille: 0 } : z)))).not.toEqual(
      [],
    );
  });
  it("analyse throws on an invalid zone set rather than guessing", () => {
    expect(() => analyseArrangement([], zones.slice(1), hull, bal)).toThrow();
  });
});

describe("analyseArrangement", () => {
  it("computes capacities, LCG and vertical moment for a legal arrangement", () => {
    const r = analyseArrangement(
      [
        mk({
          instanceId: "a",
          zoneId: "CENTRAL_MACHINERY",
          stationPermille: 400,
          weightKg: 3_000,
          zCgMm: 2_000,
        }),
        mk({
          instanceId: "b",
          zoneId: "QUARTERDECK",
          stationPermille: 950,
          weightKg: 1_000,
          zCgMm: 6_000,
        }),
      ],
      zones,
      hull,
      bal,
    );
    expect(r.findings).toEqual([]);
    expect(r.totalWeightKg).toBe(4_000);
    expect(r.lcgPermille).toBe(537);
    expect(r.verticalMomentKgMm).toBe(12_000_000);
    expect(r.zones.find((z) => z.zoneId === "CENTRAL_MACHINERY")!.volumeCapacityLitre).toBe(
      Math.floor(((100_000 * 12_000 * 8_000 * 6_000) / 10_000 / 1_000_000) * 0.28),
    );
  });
  it("empty arrangement has null LCG", () => {
    expect(analyseArrangement([], zones, hull, bal).lcgPermille).toBeNull();
  });
  it("ARR-OVERLAP when volume or deck area is exceeded", () => {
    const v = analyseArrangement(
      [mk({ instanceId: "a", zoneId: "FORECASTLE", stationPermille: 40, volumeLitre: 10_000_000 })],
      zones,
      hull,
      bal,
    );
    expect(v.findings.map((f) => f.id)).toContain("ARR-OVERLAP");
    const d = analyseArrangement(
      [
        mk({
          instanceId: "a",
          zoneId: "FORECASTLE",
          stationPermille: 40,
          deckFootprintMm2: 10_000_000_000,
        }),
      ],
      zones,
      hull,
      bal,
    );
    expect(
      d.findings.some(
        (f) =>
          f.id === "ARR-OVERLAP" && f.severity === "BLOCKING" && checkFindingShape(f).length === 0,
      ),
    ).toBe(true);
  });
  it("blocks a barbette sharing a zone with machinery, but not in another zone", () => {
    const gun = mk({
      instanceId: "g",
      zoneId: "CENTRAL_MACHINERY",
      stationPermille: 400,
      category: "MAIN_GUN",
      forbidsCoLocation: ["ENGINE"],
    });
    const eng = mk({
      instanceId: "e",
      zoneId: "CENTRAL_MACHINERY",
      stationPermille: 420,
      category: "ENGINE",
    });
    expect(analyseArrangement([gun, eng], zones, hull, bal).findings.map((f) => f.id)).toContain(
      "ARR-TURRET-ON-MACHINERY",
    );
    expect(
      analyseArrangement(
        [{ ...gun, zoneId: "FORECASTLE", stationPermille: 40 }, eng],
        zones,
        hull,
        bal,
      ).findings,
    ).toEqual([]);
  });
  it("blocks wrong zone, station outside zone and duplicate ids", () => {
    const ids = (ps: ResolvedPlacement[]) =>
      analyseArrangement(ps, zones, hull, bal).findings.map((f) => f.id);
    expect(
      ids([
        mk({
          instanceId: "a",
          zoneId: "FORECASTLE",
          stationPermille: 40,
          allowedZones: ["QUARTERDECK"],
        }),
      ]),
    ).toContain("ARR-ZONE-NOT-ALLOWED");
    expect(ids([mk({ instanceId: "a", zoneId: "FORECASTLE", stationPermille: 500 })])).toContain(
      "ARR-STATION-OUT-OF-ZONE",
    );
    expect(
      ids([
        mk({ instanceId: "a", zoneId: "FORECASTLE", stationPermille: 40 }),
        mk({ instanceId: "a", zoneId: "FORECASTLE", stationPermille: 41 }),
      ]),
    ).toContain("ARR-DUPLICATE-INSTANCE");
  });
  it("magazine rules: missing, too small, too far", () => {
    const mag = mk({
      instanceId: "m",
      zoneId: "FWD_MAGAZINE",
      stationPermille: 120,
      category: "MAGAZINE",
      magazineLitre: 5_000,
    });
    const gun = mk({
      instanceId: "g",
      zoneId: "FORECASTLE",
      stationPermille: 40,
      category: "MAIN_GUN",
      ammoVolumeLitre: 4_000,
      magazineRef: "m",
      maxFeedPermille: 150,
    });
    const run = (ps: ResolvedPlacement[]) => analyseArrangement(ps, zones, hull, bal).findings;
    expect(run([mag, gun])).toEqual([]);
    expect(run([gun]).map((f) => f.id)).toContain("ARR-MAG-VOLUME");
    expect(
      run([mag, { ...gun, ammoVolumeLitre: 6_000 }]).some(
        (f) => f.id === "ARR-MAG-VOLUME" && f.severity === "BLOCKING",
      ),
    ).toBe(true);
    const far = run([mag, { ...gun, maxFeedPermille: 50 }]).find((f) => f.id === "ARR-MAG-DIST")!;
    expect(far.severity).toBe("CRITICAL");
    expect(checkFindingShape(far)).toEqual([]);
    const gun2 = { ...gun, instanceId: "g2" };
    expect(run([mag, gun, gun2]).some((f) => f.id === "ARR-MAG-VOLUME")).toBe(true);
  });
  it("critical-system concentration (by count) is advisory, then warning, and absent when spread", () => {
    const c = (id: string, zoneId: ResolvedPlacement["zoneId"], st: number) =>
      mk({ instanceId: id, zoneId, stationPermille: st, critical: true });
    const run = (ps: ResolvedPlacement[]) =>
      analyseArrangement(ps, zones, hull, bal).findings.find((f) => f.id === "ARR-CRITICAL-CONC");
    expect(
      run([
        c("a", "FWD_SERVICE", 200),
        c("b", "CENTRAL_MACHINERY", 400),
        c("d", "AFT_SERVICE", 700),
      ]),
    ).toBeUndefined();
    expect(run([c("a", "CENTRAL_MACHINERY", 400)])).toBeUndefined();
    expect(
      run([
        c("a", "CENTRAL_MACHINERY", 400),
        c("b", "CENTRAL_MACHINERY", 410),
        c("e", "CENTRAL_MACHINERY", 420),
        c("d", "AFT_SERVICE", 700),
      ])!.severity,
    ).toBe("ADVISORY");
    const warn = run([c("a", "CENTRAL_MACHINERY", 400), c("b", "CENTRAL_MACHINERY", 410)])!;
    expect(warn.severity).toBe("WARNING");
    expect(checkFindingShape(warn)).toEqual([]);
  });
  it("is independent of placement order", () => {
    const ps = [
      mk({ instanceId: "a", zoneId: "FORECASTLE", stationPermille: 40 }),
      mk({ instanceId: "b", zoneId: "QUARTERDECK", stationPermille: 950 }),
    ];
    expect(JSON.stringify(analyseArrangement(ps, zones, hull, bal))).toBe(
      JSON.stringify(analyseArrangement([...ps].reverse(), zones, hull, bal)),
    );
  });
});
