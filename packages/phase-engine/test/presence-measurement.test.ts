import {
  isPresenceExempt,
  measurePresence,
  type CampaignSnapshot,
  type CompiledDesignVersion,
  type NationState,
  type Ship,
} from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { productionShipBuildingContent } from "./helpers/contentFiles.js";

const FIXTURE_PRESENCE = {
  colonialServiceDisplacementBp: 137,
  requiredTonsPerPossessionWeight: 100,
  noPortValueWeight: 2,
  crampedOrShortRangeCountBp: 5_000,
};

function ship(id: string, over: Partial<Ship> = {}): Ship {
  return {
    id,
    name: id,
    classId: "cruiser",
    nationId: "GBR",
    locationAreaId: "india",
    designVersionId: "d-plain",
    hitPoints: SafeInt(100),
    maxHitPoints: SafeInt(100),
    speed: SafeInt(10),
    firepower: SafeInt(10),
    armor: SafeInt(10),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
    ...over,
  };
}

function nation(id: string, ships: Ship[]): NationState {
  return {
    prestige: SafeInt(20),
    id,
    name: id,
    tag: id,
    treasury: SafeInt(10000),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [{ id: `fleet-${id}`, nationId: id, name: id, locationAreaId: "india", ships }],
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

function design(id: string, kg: number): CompiledDesignVersion {
  return { designVersionId: id, normalizedDisplacementKg: SafeInt(kg) } as CompiledDesignVersion;
}

function snapshot(gbrShips: Ship[]): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "presence",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: {
      areas: [],
      routes: [],
      ports: [],
      possessions: [
        { id: "p-gbr-2", nationId: "GBR", areaId: "india" },
        { id: "p-gbr-1", nationId: "GBR", areaId: "india" },
        { id: "p-gbr-3", nationId: "GBR", areaId: "cape" },
        { id: "p-fra-1", nationId: "FRA", areaId: "india" },
      ],
    },
    nations: new Map([
      ["GBR", nation("GBR", gbrShips)],
      ["FRA", nation("FRA", [])],
    ]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map([
      ["d-plain", design("d-plain", 1_000_000)],
      ["d-small", design("d-small", 200_000)],
    ]),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "3.0.0",
  };
}

function withWarAndBlockade(
  from: CampaignSnapshot,
  over: { war?: "ACTIVE" | "ENDED" | null; blockade?: boolean; blockadedNation?: string } = {},
): CampaignSnapshot {
  const { war = "ACTIVE", blockade = true, blockadedNation = "GBR" } = over;
  return {
    ...from,
    wars: {
      ...from.wars,
      wars:
        war === null
          ? []
          : [
              {
                id: "w1",
                attackerSideId: "a",
                defenderSideId: "d",
                attackerSideMembers: ["FRA"],
                defenderSideMembers: ["GBR"],
                attackerWarScore: 0,
                defenderWarScore: 0,
                attackerId: "FRA",
                defenderId: "GBR",
                startDate: "1880-01",
                status: war,
              },
            ],
      blockadeState: blockade
        ? [
            {
              blockaderId: "FRA",
              blockadedNationId: blockadedNation,
              areaId: "india",
              establishedMonth: "1880-01",
            },
          ]
        : [],
    },
  };
}

function run(from: CampaignSnapshot, withSection: boolean, extra: object = {}) {
  return new MonthExecutor().execute(
    from,
    [],
    "presence-seed",
    new DiagnosticCollector(),
    undefined,
    {
      shipBuilding: productionShipBuildingContent(),
      ...(withSection ? { presence: { ...FIXTURE_PRESENCE, ...extra } } : {}),
    },
  );
}

const shortfalls = (r: ReturnType<typeof run>) =>
  r.eventLedger.all.filter((e) => e.body.kind === "PresenceShortfall").map((e) => e.body);

describe("S-5 05: month-end presence step", () => {
  it("emits one typed shortfall event per under-covered nation-area, ordered by nation then area", () => {
    const result = run(snapshot([]), true);
    expect(result.success).toBe(true);
    expect(shortfalls(result)).toEqual([
      {
        kind: "PresenceShortfall",
        nationId: "FRA",
        areaId: "india",
        requiredTons: 200,
        presentTons: 0,
        shortfallTons: 200,
      },
      {
        kind: "PresenceShortfall",
        nationId: "GBR",
        areaId: "cape",
        requiredTons: 200,
        presentTons: 0,
        shortfallTons: 200,
      },
      {
        kind: "PresenceShortfall",
        nationId: "GBR",
        areaId: "india",
        requiredTons: 400,
        presentTons: 0,
        shortfallTons: 400,
      },
    ]);
  });

  it("an active ship reduces the shortfall; a covered area emits nothing; laid-up ships do not count", () => {
    const covered = run(snapshot([ship("a"), ship("b", { readiness: "RESERVE" })]), true);
    expect(
      shortfalls(covered).filter((e) => e.kind === "PresenceShortfall" && e.nationId === "GBR"),
    ).toEqual([
      {
        kind: "PresenceShortfall",
        nationId: "GBR",
        areaId: "cape",
        requiredTons: 200,
        presentTons: 0,
        shortfallTons: 200,
      },
    ]);
  });

  it("an FS colonial-service ship counts 1.5x its tonnage and one not on FS counts 1x", () => {
    const gbrIndia = (ships: Ship[]) =>
      shortfalls(run(snapshot(ships), true)).find(
        (e) => e.kind === "PresenceShortfall" && e.nationId === "GBR" && e.areaId === "india",
      );
    const colonial = { designVersionId: "d-small", colonialServiceFitted: true as const };
    expect(gbrIndia([ship("a", { designVersionId: "d-small" })])).toMatchObject({
      presentTons: 200,
      shortfallTons: 200,
    });
    expect(gbrIndia([ship("a", colonial)])).toMatchObject({ presentTons: 200, shortfallTons: 200 });
    expect(
      gbrIndia([ship("a", { ...colonial, stationAssignment: "FOREIGN_STATION" })]),
    ).toMatchObject({
      presentTons: 300,
      shortfallTons: 100,
    });
  });

  it("is dormant without the section: no events and a final hash identical to the pre-S-5 run", () => {
    const from = snapshot([ship("a")]);
    const dormant = run(from, false);
    expect(shortfalls(dormant)).toEqual([]);
    const baseline = new MonthExecutor().execute(
      from,
      [],
      "presence-seed",
      new DiagnosticCollector(),
    );
    const hash = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.finalSnapshot));
    expect(hash(dormant)).toBe(hash(baseline));
  });

  it("does not change authoritative state when the section is present (events only) and is deterministic", () => {
    const from = snapshot([ship("a")]);
    const hash = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.finalSnapshot));
    expect(hash(run(from, true))).toBe(hash(run(from, false)));
    const events = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.eventLedger.all));
    expect(events(run(from, true))).toBe(events(run(from, true)));
  });

  describe("S-5 06: blockade exemption and penalty requests", () => {
    const kinds = (r: ReturnType<typeof run>, nationId: string) =>
      r.eventLedger.all
        .filter(
          (e) =>
            (e.body.kind === "PresenceShortfall" ||
              e.body.kind === "PrestigeLossRequested" ||
              e.body.kind === "RevoltPressureRequested") &&
            e.body.nationId === nationId,
        )
        .map((e) => `${e.body.kind}:${"areaId" in e.body ? e.body.areaId : ""}`);

    it("suspends the requirement in every area while at war and blockaded, and only for the blockaded nation", () => {
      const blockaded = run(withWarAndBlockade(snapshot([])), true, { penaltyRequests: true });
      expect(kinds(blockaded, "GBR")).toEqual([]);
      expect(kinds(blockaded, "FRA")).toEqual([
        "PresenceShortfall:india",
        "PrestigeLossRequested:india",
        "RevoltPressureRequested:india",
      ]);
    });

    it("applies the requirement when at war but not blockaded, blockaded outside war, or after the war ends", () => {
      for (const from of [
        withWarAndBlockade(snapshot([]), { blockade: false }),
        withWarAndBlockade(snapshot([]), { war: null }),
        withWarAndBlockade(snapshot([]), { war: "ENDED" }),
        withWarAndBlockade(snapshot([]), { blockadedNation: "FRA" }),
      ]) {
        expect(
          shortfalls(run(from, true)).filter(
            (e) => e.kind === "PresenceShortfall" && e.nationId === "GBR",
          ),
        ).toHaveLength(2);
      }
    });

    it("shows shortfall in peace, none while blockaded at war, and shortfall again after the blockade lifts", () => {
      const gbr = (from: CampaignSnapshot) =>
        shortfalls(run(from, true)).filter((e) => "nationId" in e && e.nationId === "GBR").length;
      expect([
        gbr(snapshot([])),
        gbr(withWarAndBlockade(snapshot([]))),
        gbr(withWarAndBlockade(snapshot([]), { blockade: false })),
      ]).toEqual([2, 0, 2]);
    });

    it("emits one shortfall, one prestige request and one revolt request per nation-area, in canonical order, only with penalty parameters", () => {
      const withPenalty = run(snapshot([]), true, { penaltyRequests: true });
      expect(kinds(withPenalty, "GBR")).toEqual([
        "PresenceShortfall:cape",
        "PrestigeLossRequested:cape",
        "RevoltPressureRequested:cape",
        "PresenceShortfall:india",
        "PrestigeLossRequested:india",
        "RevoltPressureRequested:india",
      ]);
      const request = withPenalty.eventLedger.all.find(
        (e) => e.body.kind === "PrestigeLossRequested",
      );
      expect(request?.body).toEqual({
        kind: "PrestigeLossRequested",
        nationId: "FRA",
        areaId: "india",
        shortfallTons: 200,
      });
      const dormantPenalty = run(snapshot([]), true);
      expect(
        dormantPenalty.eventLedger.all.filter(
          (e) =>
            e.body.kind === "PrestigeLossRequested" || e.body.kind === "RevoltPressureRequested",
        ),
      ).toEqual([]);
    });

    it("leaves prestige, unrest and treasury untouched: the final hash equals a run without S-5 events", () => {
      const from = withWarAndBlockade(snapshot([]), { blockade: false });
      const hash = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.finalSnapshot));
      expect(hash(run(from, true, { penaltyRequests: true }))).toBe(hash(run(from, false)));
      const prestigeAndTreasury = (r: ReturnType<typeof run>) =>
        [...r.finalSnapshot.nations.values()].map((n) => [n.id, n.prestige, n.treasury]);
      expect(prestigeAndTreasury(run(from, true, { penaltyRequests: true }))).toEqual(
        prestigeAndTreasury(run(from, false)),
      );
    });

    it("keeps the exemption out of base-limit checks: the exemption predicate is the requirement's alone (contract note)", () => {
      const from = withWarAndBlockade(snapshot([ship("a")]));
      expect(isPresenceExempt(from, "GBR", "1880-01")).toBe(true);
      expect(measurePresence(from, FIXTURE_PRESENCE).some((r) => r.nationId === "GBR")).toBe(true);
    });
  });

  describe("#576: presence shortfall costs prestige", () => {
    const PENALTY = {
      penaltyRequests: true as const,
      shortfallPrestige: { lossBpPerWholeShortfall: 200, maxLossBp: 500 },
    };

    function rich(from: CampaignSnapshot, extra: NationState[] = []): CampaignSnapshot {
      const nations = new Map(
        [...from.nations.values(), ...extra].map((n) => [n.id, { ...n, prestige: SafeInt(100) }]),
      );
      return { ...from, nations };
    }

    const prestigeOf = (r: ReturnType<typeof run>, id: string) =>
      Number(r.finalSnapshot.nations.get(id)?.prestige);

    const changes = (r: ReturnType<typeof run>) =>
      r.eventLedger.all
        .filter((e) => e.body.kind === "PrestigeChanged")
        .map((e) => e.body)
        .map((b) => (b.kind === "PrestigeChanged" ? [b.nationId, b.reasonCode, b.delta] : []));

    it("charges each short nation one proportional loss per month, ordered by nation, summed over areas", () => {
      const result = run(rich(snapshot([])), true, PENALTY);
      expect(changes(result)).toEqual([
        ["FRA", "PRESENCE_SHORTFALL", -2],
        ["GBR", "PRESENCE_SHORTFALL", -4],
      ]);
      expect(prestigeOf(result, "GBR")).toBe(96);
      expect(prestigeOf(result, "FRA")).toBe(98);
      expect(result.finalSnapshot.nations.get("GBR")?.prestigeLastChange).toMatchObject({
        reasonCode: "PRESENCE_SHORTFALL",
        appliedRule: { kind: "PROPORTIONAL_LOSS", basisPoints: 400 },
      });
    });

    it("caps the monthly loss at the ruleset maximum", () => {
      const capped = {
        ...PENALTY,
        shortfallPrestige: { lossBpPerWholeShortfall: 200, maxLossBp: 300 },
      };
      expect(prestigeOf(run(rich(snapshot([])), true, capped), "GBR")).toBe(97);
    });

    it("scales the loss with the shortfall fraction", () => {
      const half = run(rich(snapshot([ship("a", { designVersionId: "d-small" })])), true, PENALTY);
      expect(prestigeOf(half, "GBR")).toBe(97);
    });

    it("leaves a nation whose requirement is met unchanged", () => {
      const covered = snapshot([ship("a"), ship("b", { locationAreaId: "cape" })]);
      const result = run(rich(covered), true, PENALTY);
      expect(prestigeOf(result, "GBR")).toBe(100);
      expect(prestigeOf(result, "FRA")).toBe(98);
    });

    it("leaves a blockade-exempt nation unchanged", () => {
      const result = run(rich(withWarAndBlockade(snapshot([]))), true, PENALTY);
      expect(prestigeOf(result, "GBR")).toBe(100);
      expect(prestigeOf(result, "FRA")).toBe(98);
    });

    it("covers AI nations", () => {
      const base = snapshot([]);
      const ai = { ...nation("DEU", []), isPlayable: false, isAI: true };
      const from = rich(
        {
          ...base,
          world: {
            ...base.world,
            possessions: [
              ...(base.world.possessions ?? []),
              { id: "p-deu-1", nationId: "DEU", areaId: "samoa" },
            ],
          },
        },
        [ai],
      );
      expect(prestigeOf(run(from, true, PENALTY), "DEU")).toBe(98);
    });

    it("does nothing unless the shortfall rule is authored and penalties are requested", () => {
      const from = rich(snapshot([]));
      const hash = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.finalSnapshot));
      expect(hash(run(from, true, { penaltyRequests: true }))).toBe(hash(run(from, false)));
      expect(hash(run(from, true, { shortfallPrestige: PENALTY.shortfallPrestige }))).toBe(
        hash(run(from, false)),
      );
    });

    it("is deterministic", () => {
      const from = rich(snapshot([]));
      const hash = (r: ReturnType<typeof run>) => sha256Hex(canonicalSerialize(r.eventLedger.all));
      expect(hash(run(from, true, PENALTY))).toBe(hash(run(from, true, PENALTY)));
    });
  });
});
