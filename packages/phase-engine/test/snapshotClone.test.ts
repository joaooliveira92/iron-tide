import type { CampaignSnapshot } from "@bluewave/campaign";
import { describe, expect, it } from "vite-plus/test";
import * as snapshotClone from "../src/snapshotClone";

function minimalSnapshot(): CampaignSnapshot {
  return {
    version: 1,
    turnNumber: 0,
    campaignId: "c1",
    startYear: 1880,
    startMonth: 1,
    slots: [{ nationId: "n1", type: "human" }],
    world: {
      areas: [{ id: "a1", name: "Atlantic", type: "sea", controller: null } as any],
      routes: [],
      ports: [],
    },
    nations: new Map([
      [
        "n1",
        {
          id: "n1",
          name: "Test",
          tag: "TST",
          treasury: 100,
          income: 10,
          expenses: 5,
          baseResources: {} as any,
          navalAppropriationRateBp: 1000,
          maintenanceCost: 1,
          prestige: 20,
          prestigeLastChange: {
            reasonCode: "BATTLE_WON",
            before: 20,
            after: 21,
            delta: 1,
            month: "1880-02",
          },
          homeAreaId: "a1",
          fleets: [
            {
              id: "f1",
              nationId: "n1",
              name: "Fleet",
              ships: [
                {
                  id: "s1",
                  name: "Ship",
                  classId: "c1",
                  nationId: "n1",
                  locationAreaId: "a1",
                  designVersionId: "d1",
                  hitPoints: 10,
                  maxHitPoints: 10,
                  speed: 1,
                  firepower: 1,
                  armor: 1,
                  isUnderConstruction: false,
                  constructionProgress: 0,
                  constructionTotalWork: 0,
                  inBattleId: undefined,
                } as any,
              ],
              locationAreaId: "a1",
            } as any,
          ],
          divisions: [],
          officers: [],
          research: {
            nationId: "n1",
            technologies: [],
            currentProjectTechId: undefined,
            fieldPriorities: {} as any,
            researchBudget: 0,
            activeCandidates: [],
            discoveredTechs: [],
          } as any,
          constructionProjects: [],
          designStudies: [],
          procurementIntents: [],
          foreignContracts: [],
          foreignContractPayments: [],
          foreignInsightAwards: [],
          foreignContractImpoundments: [],
          aircraft: {} as any,
          carrierOperations: {} as any,
          specialTraining: [{ subject: "GUNNERY", fundedMonths: 1, maintenanceAdderBp: 3000 }],
          dock: {
            maximumNewConstructionMassKg: 1,
            maximumMajorRepairMassKg: 1,
            maximumRebuildMassKg: 1,
            maximumConversionMassKg: 1,
          },
          dockExpansion: {
            possessions: [
              {
                possessionId: "n1-home",
                eligible: true,
                utilization: [{ month: "1880-01", utilizationBp: 8_000 }],
              },
            ],
          },
          isPlayable: true,
          isAI: false,
        } as any,
      ],
    ]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: undefined as any,
    },
    politics: { relations: [], shells: {} as any },
    intelligence: { shells: {} as any },
    designs: new Map(),
    designFamilies: new Map(),
    strategicWeather: undefined as any,
    prestigeRules: { lowerBound: 0 } as any,
    rulesetVersion: "1",
    compatibilityVersion: "1",
  } as unknown as CampaignSnapshot;
}

describe("cloneSnapshot hardening", () => {
  it("happy path: deep disjoint", () => {
    const a = minimalSnapshot();
    const b = snapshotClone.cloneSnapshot(a);
    expect(b).toEqual(a);
    expect(b).not.toBe(a);
    expect(b.nations).not.toBe(a.nations);
    expect(b.nations.get("n1")?.fleets[0].ships[0]).not.toBe(
      a.nations.get("n1")!.fleets[0].ships[0],
    );
    (b.nations.get("n1") as any).treasury = 999;
    expect(a.nations.get("n1")!.treasury).toBe(100);
    b.world.areas[0].name = "X";
    expect(a.world.areas[0].name).toBe("Atlantic");
  });

  it("consecutive clones are disjoint from each other", () => {
    const a = minimalSnapshot();
    const b = snapshotClone.cloneSnapshot(a);
    const c = snapshotClone.cloneSnapshot(a);
    expect(b.nations).not.toBe(c.nations);
    (b.nations.get("n1") as any).treasury = 1;
    (c.nations.get("n1") as any).treasury = 2;
    expect(a.nations.get("n1")!.treasury).toBe(100);
  });

  it("preserves undefined vs [] (no invention)", () => {
    const a = minimalSnapshot();
    a.wars.battleManifests = undefined as any;
    a.strategicWeather = undefined as any;
    const b = snapshotClone.cloneSnapshot(a);
    expect(b.wars.battleManifests).toBeUndefined();
    expect(b.strategicWeather).toBeUndefined();
    (a.wars as any).battleManifests = [];
    const c = snapshotClone.cloneSnapshot(a);
    expect(c.wars.battleManifests).toEqual([]);
  });

  it("handles Date correctly", () => {
    const a = minimalSnapshot();
    const d = new Date("1905-05-27T00:00:00Z");
    (a.wars.wars as any) = [
      {
        id: "w1",
        attackerSideId: "s1",
        defenderSideId: "s2",
        attackerSideMembers: [],
        defenderSideMembers: [],
        attackerWarScore: 0,
        defenderWarScore: 0,
        attackerId: "n1",
        defenderId: "n2",
        startDate: d,
        status: "active",
        endDate: undefined,
      },
    ];
    const b = snapshotClone.cloneSnapshot(a);
    expect(b.wars.wars[0].startDate).toEqual(d);
    expect(b.wars.wars[0].startDate).not.toBe(d);
    (b.wars.wars[0] as any).startDate.setFullYear(2000);
    expect((a.wars.wars[0] as any).startDate.getFullYear()).toBe(1905);
  });

  it("guards prototype pollution", () => {
    const a = minimalSnapshot() as any;
    a.politics.shells = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
    const b = snapshotClone.cloneSnapshot(a);
    expect(({} as any).polluted).toBeUndefined();
    expect(b.politics.shells.safe).toBe(1);
    expect(Object.prototype.hasOwnProperty.call(b.politics.shells, "__proto__")).toBe(false);
    expect(Object.getPrototypeOf(b.politics.shells)).toBe(Object.prototype);
  });

  it("handles Map/Set deep clone", () => {
    const a = minimalSnapshot() as any;
    a.designs = new Map([["d1", { id: "d1", designFamilyId: "df1", hitPoints: 10 }]]);
    const b = snapshotClone.cloneSnapshot(a);
    expect(b.designs.get("d1")).not.toBe(a.designs.get("d1"));
    (b.designs.get("d1") as any).hitPoints = 999;
    expect(a.designs.get("d1").hitPoints).toBe(10);
  });

  it("handles Set deep clone", () => {
    const a = minimalSnapshot() as any;
    a.intelligence.shells = { flagged: new Set(["x", "y"]) };
    const b = snapshotClone.cloneSnapshot(a);
    expect(b.intelligence.shells.flagged).not.toBe(a.intelligence.shells.flagged);
    (b.intelligence.shells as any).flagged.add("z");
    expect(a.intelligence.shells.flagged.has("z")).toBe(false);
  });

  it("boundary: empty collections", () => {
    const a = minimalSnapshot();
    a.nations.get("n1")!.fleets = [];
    a.world.areas = [];
    a.world.routes = [];
    a.world.ports = [];
    const b = snapshotClone.cloneSnapshot(a);
    expect(b.world.areas).toEqual([]);
    expect(b.nations.get("n1")!.fleets).toEqual([]);
  });

  it("invalid input throws deterministic error", () => {
    expect(() => snapshotClone.cloneSnapshot(null as any)).toThrow(
      "snapshot must be a non-null object",
    );
    expect(() => snapshotClone.cloneSnapshot(undefined as any)).toThrow(
      "snapshot must be a non-null object",
    );
    const bad = minimalSnapshot() as any;
    bad.nations = {};
    expect(() => snapshotClone.cloneSnapshot(bad)).toThrow("nations must be a Map");
  });

  it("CLONE_COVERAGE is frozen", () => {
    expect(Object.isFrozen(snapshotClone.CLONE_COVERAGE)).toBe(true);
    for (const v of Object.values(snapshotClone.CLONE_COVERAGE))
      expect(Object.isFrozen(v)).toBe(true);
  });

  it("determinism: key order follows F", () => {
    const a = minimalSnapshot();
    const b = snapshotClone.cloneSnapshot(a);
    expect(Object.keys(b.world)).toEqual(["areas", "routes", "ports"]);
    expect(Object.keys(b.nations.get("n1")!)).toEqual([
      ...snapshotClone.CLONE_COVERAGE["NationState"],
    ]);
  });

  it("does not share nested free-form objects", () => {
    const a = minimalSnapshot() as any;
    a.politics.shells = { nested: { x: 1 } };
    const b = snapshotClone.cloneSnapshot(a);
    (b.politics.shells as any).nested.x = 2;
    expect(a.politics.shells.nested.x).toBe(1);
  });

  it("deep-clones the persisted armament snapshot on a design version (ADR-0093 Step 4)", () => {
    expect(snapshotClone.CLONE_COVERAGE["CompiledDesignVersion"]).toContain("armament");
    const a = minimalSnapshot() as any;
    a.designs = new Map([
      [
        "d1",
        {
          designVersionId: "d1",
          armament: [
            {
              instanceId: "gun_1",
              gunFamilyId: "gb_bl_13_5in",
              gunModelId: "gb_bl_13_5in_30",
              mountId: "gb_bl_13_5in_barbette",
              ammunitionId: "gb_apc",
              mountType: "BARBETTE",
              gunCount: 4,
              accessStatus: "DOMESTIC",
              appliedModifiers: [],
            },
          ],
        },
      ],
    ]);
    const b = snapshotClone.cloneSnapshot(a);
    expect(b.designs.get("d1")!.armament).toEqual(a.designs.get("d1").armament);
    expect(b.designs.get("d1")!.armament).not.toBe(a.designs.get("d1").armament);
    (b.designs.get("d1")!.armament![0] as { gunModelId: string }).gunModelId = "mutated";
    expect(a.designs.get("d1").armament[0].gunModelId).toBe("gb_bl_13_5in_30");
  });
});
