import type { CampaignSnapshot, ConstructionProject, NationState, Ship } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import { rebuildProjectProblems } from "../src/rebuildProjects.js";
import { runClosingValidationPhase } from "../src/validationPhases.js";

const ship = (id: string, over: Partial<Ship> = {}): Ship => ({
  id,
  name: id,
  classId: "c",
  nationId: "GBR",
  locationAreaId: "a-1",
  designVersionId: "d1",
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
});
const project = (over: Partial<ConstructionProject> = {}): ConstructionProject => ({
  id: "proj-r",
  type: "ship",
  projectType: "REBUILD",
  targetShipId: "s1",
  targetId: "s1",
  designVersionId: "d1",
  totalWork: SafeInt(10),
  completedWork: SafeInt(0),
  paidWork: SafeInt(0),
  status: "ACTIVE",
  startedAt: "1880-01",
  ...over,
});
const nationWith = (ships: Ship[], projects: ConstructionProject[]): NationState =>
  ({
    id: "GBR",
    name: "GBR",
    tag: "GBR",
    // Empty: these tests exercise the rebuild's own state; a funded treasury would also pay for the unfinished project.
    treasury: SafeInt(0),
    income: SafeInt(0),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(0),
    maintenanceCost: SafeInt(0),
    fleets: [{ id: "f", nationId: "GBR", name: "f", ships, locationAreaId: "a-1" }],
    divisions: [],
    officers: [],
    research: {
      nationId: "GBR",
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: projects,
    isPlayable: true,
    isAI: false,
  }) as unknown as NationState;
const unavailable = (id = "s1", by = "proj-r"): Ship =>
  ship(id, { availability: "UNAVAILABLE", availabilityProjectId: by });

describe("rebuildProjectProblems", () => {
  it("has nothing to say about new construction, or a consistent rebuild", () => {
    expect(
      rebuildProjectProblems(
        nationWith([], [project({ projectType: "NEW_CONSTRUCTION", targetShipId: undefined })]),
      ),
    ).toEqual([]);
    expect(rebuildProjectProblems(nationWith([unavailable()], [project()]))).toEqual([]);
    expect(rebuildProjectProblems(nationWith([], []))).toEqual([]);
  });
  it("requires a target ship, and one that exists", () => {
    const text = (n: NationState) => rebuildProjectProblems(n).join("\n");
    expect(text(nationWith([], [project({ targetShipId: undefined })]))).toMatch(
      /names no target ship/,
    );
    expect(text(nationWith([ship("other")], [project()]))).toMatch(/targets unknown ship s1/);
  });
  it("requires the ship to be unavailable because of this very project", () => {
    expect(rebuildProjectProblems(nationWith([ship("s1")], [project()])).join()).toMatch(
      /must be unavailable because of rebuild project proj-r/,
    );
    expect(
      rebuildProjectProblems(nationWith([unavailable("s1", "someone-else")], [project()])).join(),
    ).toMatch(/must be unavailable/);
    expect(
      rebuildProjectProblems(
        nationWith(
          [ship("s1", { availability: "DEGRADED", availabilityProjectId: "proj-r" })],
          [project()],
        ),
      ).join(),
    ).toMatch(/must be unavailable/);
  });
  it("refuses two unfinished rebuilds of the same ship", () => {
    const n = nationWith([unavailable()], [project(), project({ id: "proj-r2" })]);
    expect(rebuildProjectProblems(n).join("\n")).toMatch(
      /target of two rebuilds \(proj-r and proj-r2\)/,
    );
  });
  it("lets a finished rebuild release its ship, and a new-construction project name no target", () => {
    expect(
      rebuildProjectProblems(nationWith([ship("s1")], [project({ status: "COMPLETED" })])),
    ).toEqual([]);
    expect(
      rebuildProjectProblems(nationWith([], [project({ projectType: "NEW_CONSTRUCTION" })])).join(),
    ).toMatch(/is new construction but names target ship s1/);
  });
  it("treats a CANCELLED rebuild as terminal: it holds no ship either way", () => {
    // Cancellation releases the ship (DESIGN-23 section 23), so the released ship is consistent...
    expect(
      rebuildProjectProblems(nationWith([ship("s1")], [project({ status: "CANCELLED" })])),
    ).toEqual([]);
    // ...and a cancelled rebuild is not judged even while its ship is still unavailable.
    expect(
      rebuildProjectProblems(nationWith([unavailable()], [project({ status: "CANCELLED" })])),
    ).toEqual([]);
  });
});

describe("closing validation of rebuild projects", () => {
  const snapshotOf = (n: NationState) =>
    ({ nations: new Map([["GBR", n]]) }) as unknown as CampaignSnapshot;
  it("passes a consistent rebuild and reports an inconsistent one with a stable code", () => {
    const ok = new DiagnosticCollector();
    expect(
      runClosingValidationPhase(snapshotOf(nationWith([unavailable()], [project()])), ok),
    ).toBe(true);
    const bad = new DiagnosticCollector();
    expect(runClosingValidationPhase(snapshotOf(nationWith([ship("s1")], [project()])), bad)).toBe(
      false,
    );
    expect(bad.errors.map((e) => e.code)).toEqual(["REBUILD_PROJECT_INCONSISTENT"]);
  });
});

const designVersion = (id: string, over: Record<string, unknown> = {}) =>
  ({
    designVersionId: id,
    designFamilyId: "fam",
    className: "Rebuilt class",
    nationId: "GBR",
    hullType: "DD",
    normalizedDisplacementKg: SafeInt(1_000_000),
    normalizedSpeedUms: SafeInt(10 * 514_444),
    normalizedArmorUm: SafeInt(50_000),
    hitPoints: SafeInt(250),
    mainGunsCaliber: SafeInt(152_000),
    mainGunsCount: SafeInt(4),
    machineryType: "steam",
    crewComplement: SafeInt(10),
    contentVersion: "t",
    compiledHash: "h",
    ...over,
  }) as unknown as CampaignSnapshot["designs"] extends Map<string, infer D> ? D : never;

const snapshotOfRebuild = (n: NationState, designs: [string, ReturnType<typeof designVersion>][]) =>
  ({
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "rebuild-done",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" as const }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map([["GBR", n]]),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: [], shells: {} },
    intelligence: { shells: {} },
    designs: new Map(designs),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "0.1.0",
  }) as unknown as CampaignSnapshot;

describe("a finished REBUILD completes into the new design (ADR-0078, DESIGN-23 section 22)", () => {
  const finished = () =>
    nationWith(
      [unavailable()],
      [
        project({
          designVersionId: "d_new",
          completedWork: SafeInt(10),
          totalWork: SafeInt(10),
          status: "ACTIVE",
        }),
      ],
    );
  const run = (snapshot: CampaignSnapshot) => {
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(snapshot, [], "seed", collector);
    return { result, collector, nation: result.finalSnapshot.nations.get("GBR")! };
  };

  it("makes the ship the new design with the new stats and full hit points, and releases it", () => {
    const { nation, collector } = run(
      snapshotOfRebuild(finished(), [
        ["d_new", designVersion("d_new")],
        ["d1", designVersion("d1")],
      ]),
    );
    expect(collector.errors).toEqual([]);
    const ships = nation.fleets.flatMap((f) => f.ships);
    expect(ships.map((s) => s.id)).toEqual(["s1"]); // no second ship
    const s = ships[0]!;
    expect(s).toMatchObject({
      designVersionId: "d_new",
      classId: "Rebuilt class",
      hitPoints: 250,
      maxHitPoints: 250,
      speed: 10,
    });
    expect("availability" in s).toBe(false);
    expect("availabilityProjectId" in s).toBe(false);
    expect(nation.constructionProjects[0]!.status).toBe("COMPLETED");
  });

  it("keeps the old design version in the snapshot and records one ShipRebuilt transition", () => {
    const { result } = run(
      snapshotOfRebuild(finished(), [
        ["d_new", designVersion("d_new")],
        ["d1", designVersion("d1")],
      ]),
    );
    expect(result.finalSnapshot.designs.has("d1")).toBe(true);
    const events = result.eventLedger.all.filter((e) => e.eventType === "ShipRebuilt");
    expect(events).toHaveLength(1);
    expect(events[0]!.body).toEqual({
      kind: "ShipRebuilt",
      projectId: "proj-r",
      nationId: "GBR",
      shipId: "s1",
      fromDesignVersionId: "d1",
      toDesignVersionId: "d_new",
    });
  });

  it("the released ship can sail again", () => {
    const { nation } = run(
      snapshotOfRebuild(finished(), [
        ["d_new", designVersion("d_new")],
        ["d1", designVersion("d1")],
      ]),
    );
    expect(nation.fleets[0]!.ships[0]!.availability).toBeUndefined();
  });

  it("releases a rebuilt ship without losing its readiness or crew (S-1 D2)", () => {
    // Seed the reserve crew at its ceiling so the month's readiness ramp is a
    // no-op and this test isolates the rebuild-release path (S-1 ticket 03).
    const target = ship("s1", {
      availability: "UNAVAILABLE",
      availabilityProjectId: "proj-r",
      readiness: "RESERVE",
      crewQuality: SafeInt(70),
    });
    const { nation } = run(
      snapshotOfRebuild(
        nationWith(
          [target],
          [
            project({
              designVersionId: "d_new",
              completedWork: SafeInt(10),
              totalWork: SafeInt(10),
            }),
          ],
        ),
        [
          ["d_new", designVersion("d_new")],
          ["d1", designVersion("d1")],
        ],
      ),
    );
    const s = nation.fleets[0]!.ships[0]!;
    expect(s.availability).toBeUndefined();
    expect(s.readiness).toBe("RESERVE");
    expect(s.crewQuality).toBe(70);
  });

  it("does nothing until the work is done: the ship stays unavailable and on its old design", () => {
    const unfinished = nationWith(
      [unavailable()],
      [project({ designVersionId: "d_new", completedWork: SafeInt(4), totalWork: SafeInt(10) })],
    );
    const { nation } = run(snapshotOfRebuild(unfinished, [["d_new", designVersion("d_new")]]));
    const s = nation.fleets[0]!.ships[0]!;
    expect(s.availability).toBe("UNAVAILABLE");
    expect(s.designVersionId).toBe("d1");
    expect(nation.constructionProjects[0]!.status).toBe("ACTIVE");
  });

  it("reports a missing design, but never leaves the ship stuck unavailable, and spawns no ship", () => {
    const { nation, collector, result } = run(snapshotOfRebuild(finished(), []));
    expect(collector.errors.map((e) => e.code)).toContain("REBUILD_TARGET_MISSING");
    const ships = nation.fleets.flatMap((f) => f.ships);
    expect(ships.map((s) => s.id)).toEqual(["s1"]);
    expect(ships[0]!.availability).toBeUndefined();
    expect(ships[0]!.designVersionId).toBe("d1"); // unchanged
    expect(result.eventLedger.all.some((e) => e.eventType === "ShipRebuilt")).toBe(false);
  });

  it("is deterministic", () => {
    const a = run(snapshotOfRebuild(finished(), [["d_new", designVersion("d_new")]])).result
      .finalSnapshot;
    const b = run(snapshotOfRebuild(finished(), [["d_new", designVersion("d_new")]])).result
      .finalSnapshot;
    expect(JSON.stringify([...a.nations])).toBe(JSON.stringify([...b.nations]));
  });
});
