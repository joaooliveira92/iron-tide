import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  FleetState,
  NationState,
  PossessionData,
  Ship,
} from "../src/index.js";
import type { PortData } from "../src/state.js";
import {
  measurePresence,
  requiredTonsInArea,
  shipCountedKg,
  type PresenceMeasurementRules,
} from "../src/presenceMeasurement.js";

const FIXTURE_RULES: PresenceMeasurementRules = {
  requiredTonsPerPossessionWeight: 100,
  noPortValueWeight: 2,
  crampedOrShortRangeCountBp: 5_000,
};

function ship(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "c",
    nationId: "uk",
    locationAreaId: "india",
    designVersionId: "d-plain",
    hitPoints: SafeInt(10),
    maxHitPoints: SafeInt(10),
    speed: SafeInt(1),
    firepower: SafeInt(1),
    armor: SafeInt(1),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

function design(id: string, kg: number, over: Partial<CompiledDesignVersion> = {}) {
  return {
    designVersionId: id,
    normalizedDisplacementKg: SafeInt(kg),
    ...over,
  } as CompiledDesignVersion;
}

function nation(id: string, fleets: FleetState[]): NationState {
  return {
    id,
    name: id,
    tag: id,
    treasury: SafeInt(0),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    prestige: SafeInt(20),
    fleets,
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
  };
}

function snapshot(
  ships: Ship[],
  opts: { possessions?: PossessionData[]; ports?: PortData[] } = {},
): Pick<CampaignSnapshot, "nations" | "world" | "designs"> {
  const fleet: FleetState = { id: "f", nationId: "uk", name: "f", ships, locationAreaId: "india" };
  const uk = nation("uk", [fleet]);
  const fra = nation("fra", []);
  return {
    nations: new Map([
      ["uk", uk],
      ["fra", fra],
    ]),
    world: {
      areas: [],
      routes: [],
      ports: opts.ports ?? [],
      possessions: opts.possessions ?? [
        { id: "p1", nationId: "uk", areaId: "india" },
        { id: "p2", nationId: "uk", areaId: "india" },
      ],
    },
    designs: new Map([
      ["d-plain", design("d-plain", 2_000_000)],
      ["d-colonial", design("d-colonial", 1_000_000)],
      ["d-cramped", design("d-cramped", 2_000_000, { crampedAccommodation: true })],
      ["d-short", design("d-short", 2_000_000, { shortRange: true })],
      ["d-both", design("d-both", 2_000_000, { crampedAccommodation: true, shortRange: true })],
    ]),
  };
}

const row = (s: ReturnType<typeof snapshot>) => measurePresence(s, FIXTURE_RULES)[0]!;

describe("shipCountedKg (pure arithmetic and rounding)", () => {
  const plain = { colonialOnForeignStation: false, reduced: false };
  it("counts a plain ship at 1x and a colonial-service ship on FS at exactly 3/2", () => {
    expect(shipCountedKg(SafeInt(1_000_000), plain, 5_000)).toBe(1_000_000);
    expect(
      shipCountedKg(SafeInt(1_000_000), { ...plain, colonialOnForeignStation: true }, 5_000),
    ).toBe(1_500_000);
  });
  it("rounds down once, after the exact product", () => {
    expect(shipCountedKg(SafeInt(3), { ...plain, colonialOnForeignStation: true }, 5_000)).toBe(4);
    expect(shipCountedKg(SafeInt(3), { ...plain, reduced: true }, 3_333)).toBe(0);
    expect(
      shipCountedKg(SafeInt(7), { colonialOnForeignStation: true, reduced: true }, 3_333),
    ).toBe(3);
    expect(shipCountedKg(SafeInt(10_001), { ...plain, reduced: true }, 9_999)).toBe(9_999);
  });
});

describe("measurePresence", () => {
  it("counts ACTIVE and FS ships only; reserve, mothballed, working-up and repair contribute zero", () => {
    const ships = [
      ship("a-active"),
      ship("b-reserve", { readiness: "RESERVE" }),
      ship("c-moth", { readiness: "MOTHBALLED" }),
      ship("d-workup", { readiness: "WORKING_UP" }),
      ship("e-repair", { readiness: "REPAIR" }),
      ship("f-fs", { stationAssignment: "FOREIGN_STATION" }),
      ship("g-building", { isUnderConstruction: true }),
      ship("h-rebuild", { availability: "UNAVAILABLE" }),
    ];
    expect(row(snapshot(ships)).presentTons).toBe(4_000);
  });

  it("counts a colonial-service ship on FS at 3/2 and one not on FS at 1x", () => {
    const colonial = { designVersionId: "d-colonial", colonialServiceFitted: true as const };
    expect(
      row(snapshot([ship("s", { ...colonial, stationAssignment: "FOREIGN_STATION" })])).presentTons,
    ).toBe(1_500);
    expect(row(snapshot([ship("s", colonial)])).presentTons).toBe(1_000);
    expect(
      row(
        snapshot([
          ship("s", { designVersionId: "d-colonial", stationAssignment: "FOREIGN_STATION" }),
        ]),
      ).presentTons,
    ).toBe(1_000);
  });

  it("counts cramped or short-range ships at the ruleset fraction, once even when both apply", () => {
    for (const id of ["d-cramped", "d-short", "d-both"]) {
      expect(row(snapshot([ship("s", { designVersionId: id })])).presentTons).toBe(1_000);
    }
  });

  it("counts only ships located in the area, and a ship with no compiled design counts nothing", () => {
    const ships = [
      ship("a", { locationAreaId: "elsewhere" }),
      ship("b", { designVersionId: "ghost" }),
    ];
    expect(row(snapshot(ships)).presentTons).toBe(0);
  });

  it("derives the requirement from possessions and the best port level, with the flat weight without a port", () => {
    const ports: PortData[] = [
      { id: "x", name: "x", areaId: "india", nationId: "uk", level: SafeInt(3) },
      { id: "y", name: "y", areaId: "india", nationId: "uk", level: SafeInt(5) },
      { id: "z", name: "z", areaId: "india", nationId: "fra", level: SafeInt(9) },
    ];
    expect(row(snapshot([], { ports })).requiredTons).toBe(1_000);
    expect(row(snapshot([])).requiredTons).toBe(400);
    expect(requiredTonsInArea(snapshot([]), "uk", "nowhere", FIXTURE_RULES)).toBe(0);
  });

  it("never reports a negative shortfall, and a covered colony shows zero", () => {
    const covered = row(snapshot([ship("a"), ship("b"), ship("c")]));
    expect(covered.shortfallTons).toBe(0);
    const short = row(snapshot([]));
    expect(short).toEqual({
      nationId: "uk",
      areaId: "india",
      requiredTons: 400,
      presentTons: 0,
      shortfallTons: 400,
    });
  });

  it("adding an FS colonial-service ship reduces the shortfall by 1.5x its tonnage", () => {
    const big = snapshot([], {
      possessions: Array.from({ length: 15 }, (_, i) => ({
        id: `p${i}`,
        nationId: "uk",
        areaId: "india",
      })),
    });
    const bigRow = measurePresence(big, FIXTURE_RULES)[0]!;
    expect(bigRow.requiredTons).toBe(3_000);
    const bigWith = snapshot(
      [
        ship("c", {
          designVersionId: "d-colonial",
          colonialServiceFitted: true,
          stationAssignment: "FOREIGN_STATION",
        }),
      ],
      {
        possessions: Array.from({ length: 15 }, (_, i) => ({
          id: `p${i}`,
          nationId: "uk",
          areaId: "india",
        })),
      },
    );
    expect(bigRow.shortfallTons - measurePresence(bigWith, FIXTURE_RULES)[0]!.shortfallTons).toBe(
      1_500,
    );
  });

  it("orders rows by nation then area and is independent of ship and possession insertion order", () => {
    const possessions: PossessionData[] = [
      { id: "p3", nationId: "uk", areaId: "zulu" },
      { id: "p1", nationId: "fra", areaId: "mid" },
      { id: "p2", nationId: "uk", areaId: "alpha" },
    ];
    const forward = measurePresence(
      snapshot([ship("a"), ship("b")], { possessions }),
      FIXTURE_RULES,
    );
    const reverse = measurePresence(
      snapshot([ship("b"), ship("a")], { possessions: [...possessions].reverse() }),
      FIXTURE_RULES,
    );
    expect(forward.map((r) => `${r.nationId}/${r.areaId}`)).toEqual([
      "fra/mid",
      "uk/alpha",
      "uk/zulu",
    ]);
    expect(reverse).toEqual(forward);
  });

  it("returns no rows for a nation without possessions", () => {
    expect(measurePresence(snapshot([ship("a")], { possessions: [] }), FIXTURE_RULES)).toEqual([]);
  });
});
