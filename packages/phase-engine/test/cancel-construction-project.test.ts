// Cancellation with settlement (DESIGN-23 section 23; DESIGN-11 settlement contract). Drives the real
// `CancelConstructionProject` command through `MonthExecutor.execute` so the dispatch, the availability release and the
// `ConstructionProjectCancelled` record are all exercised end to end, plus unit checks of the pure applier/refusal paths.
import type { CampaignSnapshot, ConstructionProject, NationState, Ship } from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import { MonthExecutor } from "../src/index.js";
import {
  applyCancelConstructionProject,
  CANCELLATION_WORK_CONSUMED,
  cancellationSettlement,
} from "../src/cancelConstructionProject.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

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
  designVersionId: "d_new",
  totalWork: SafeInt(10),
  completedWork: SafeInt(4),
  paidWork: SafeInt(4),
  status: "ACTIVE",
  startedAt: "1880-01",
  ...over,
});
const nationWith = (ships: Ship[], projects: ConstructionProject[]): NationState => ({
  prestige: SafeInt(20),
  id: "GBR",
  name: "GBR",
  tag: "GBR",
  treasury: SafeInt(1000),
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
});

const snapshotOf = (n: NationState): CampaignSnapshot => ({
  prestigeRules: FIXTURE_PRESTIGE_RULES,
  version: "0.1.0",
  turnNumber: SafeInt(1),
  campaignId: "cancel",
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
  designs: new Map(),
  designFamilies: new Map(),
  rulesetVersion: "0.1.0",
  compatibilityVersion: "0.1.0",
});

const envelope = (body: CommandBody, from: CampaignSnapshot): CommandEnvelope<CommandBody> => ({
  commandId: `cmd-${body.type}`,
  version: "0.1.0",
  expectedSnapshotHash: sha256Hex(canonicalSerialize(from)),
  idempotencyKey: `ik-${body.type}-${JSON.stringify(body)}`,
  timestamp: "test",
  body,
});

const unavailable = (over: Partial<Ship> = {}) =>
  ship("s1", { availability: "UNAVAILABLE", availabilityProjectId: "proj-r", ...over });

describe("cancellationSettlement (DESIGN-23 section 23; DESIGN-11 section 15)", () => {
  it("consumes the paid work, refunds nothing and reports no fabricated salvage", () => {
    expect(cancellationSettlement(project({ paidWork: SafeInt(7) }))).toEqual({
      consumedWork: 7,
      refundedAmount: 0,
      lostAmount: 7,
      salvageableAmount: 0,
      reason: CANCELLATION_WORK_CONSUMED,
    });
  });
  it("is a clean zero settlement for a project no work was done on", () => {
    expect(
      cancellationSettlement(project({ paidWork: SafeInt(0), completedWork: SafeInt(0) })),
    ).toEqual({
      consumedWork: 0,
      refundedAmount: 0,
      lostAmount: 0,
      salvageableAmount: 0,
      reason: CANCELLATION_WORK_CONSUMED,
    });
  });
});

describe("applyCancelConstructionProject refusals change nothing", () => {
  const run = (n: NationState, body: CommandBody) => {
    const collector = new DiagnosticCollector();
    const outcome = applyCancelConstructionProject(
      snapshotOf(n),
      body as Extract<CommandBody, { type: "CancelConstructionProject" }>,
      collector,
    );
    return { outcome, collector };
  };

  it("refuses a missing project with INVALID_DOCKYARD_PROJECT", () => {
    const { outcome, collector } = run(nationWith([], []), {
      type: "CancelConstructionProject",
      nationId: "GBR",
      projectId: "nope",
    });
    expect(outcome.cancelled).toBeNull();
    expect(collector.errors.map((e) => e.code)).toEqual(["INVALID_DOCKYARD_PROJECT"]);
  });

  it("refuses a terminal project and does not re-settle it", () => {
    const n = nationWith([unavailable()], [project({ status: "COMPLETED" })]);
    const { outcome, collector } = run(n, {
      type: "CancelConstructionProject",
      nationId: "GBR",
      projectId: "proj-r",
    });
    expect(outcome.cancelled).toBeNull();
    expect(collector.errors.map((e) => e.code)).toEqual(["INVALID_DOCKYARD_PROJECT_TRANSITION"]);
    expect(outcome.snapshot.nations.get("GBR")!.constructionProjects[0]!.status).toBe("COMPLETED");
  });

  it("refuses a foreign-contract project (its cancellation is a contract outcome)", () => {
    const n = nationWith(
      [unavailable()],
      [project({ foreignContractId: "fc-1", foreignBuilderNationId: "FRA" })],
    );
    const { outcome, collector } = run(n, {
      type: "CancelConstructionProject",
      nationId: "GBR",
      projectId: "proj-r",
    });
    expect(outcome.cancelled).toBeNull();
    expect(collector.errors.map((e) => e.code)).toEqual(["FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE"]);
  });
});

describe("a rebuild cancelled mid-work settles, releases the ship and records the cancellation", () => {
  const run = (n: NationState) => {
    const from = snapshotOf(n);
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(
      from,
      [envelope({ type: "CancelConstructionProject", nationId: "GBR", projectId: "proj-r" }, from)],
      "cancel-seed",
      collector,
    );
    return { result, collector, nation: result.finalSnapshot.nations.get("GBR")! };
  };

  it("moves the project to CANCELLED and releases the unavailable ship on its old design", () => {
    const { nation, collector } = run(nationWith([unavailable()], [project()]));
    expect(collector.errors).toEqual([]);
    expect(nation.constructionProjects[0]!.status).toBe("CANCELLED");
    const s = nation.fleets.flatMap((f) => f.ships)[0]!;
    expect("availability" in s).toBe(false);
    expect("availabilityProjectId" in s).toBe(false);
    expect(s.designVersionId).toBe("d1"); // cancellation never applies a new design
    expect(nation.fleets.flatMap((f) => f.ships)).toHaveLength(1); // no ship spawned
  });

  it("records one ConstructionProjectCancelled event with the explicit settlement", () => {
    const { result } = run(nationWith([unavailable()], [project({ paidWork: SafeInt(4) })]));
    const events = result.eventLedger.all.filter(
      (e) => e.eventType === "ConstructionProjectCancelled",
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.body).toEqual({
      kind: "ConstructionProjectCancelled",
      projectId: "proj-r",
      nationId: "GBR",
      projectType: "REBUILD",
      consumedWork: 4,
      refundedAmount: 0,
      lostAmount: 4,
      salvageableAmount: 0,
      reason: CANCELLATION_WORK_CONSUMED,
    });
    expect(result.eventLedger.all.some((e) => e.eventType === "ShipRebuilt")).toBe(false);
  });

  it("cancels new construction with no ship to release and no error", () => {
    const n = nationWith(
      [],
      [project({ projectType: "NEW_CONSTRUCTION", targetShipId: undefined, paidWork: SafeInt(2) })],
    );
    const { nation, collector, result } = run(n);
    expect(collector.errors).toEqual([]);
    expect(nation.constructionProjects[0]!.status).toBe("CANCELLED");
    expect(
      result.eventLedger.all.filter((e) => e.eventType === "ConstructionProjectCancelled"),
    ).toHaveLength(1);
  });

  it("does not release a ship that is unavailable for a different project", () => {
    const n = nationWith([unavailable({ availabilityProjectId: "other-project" })], [project()]);
    const { nation } = run(n);
    const s = nation.fleets.flatMap((f) => f.ships)[0]!;
    expect(s.availability).toBe("UNAVAILABLE");
    expect(s.availabilityProjectId).toBe("other-project");
  });

  it("is deterministic", () => {
    const a = run(nationWith([unavailable()], [project()])).result.finalSnapshot;
    const b = run(nationWith([unavailable()], [project()])).result.finalSnapshot;
    expect(JSON.stringify([...a.nations])).toBe(JSON.stringify([...b.nations]));
  });
});
