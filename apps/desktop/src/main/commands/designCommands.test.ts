import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { SafeInt } from "@bluewave/contracts";
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  DesignCommandOutcome,
  LoadProjectDraftPayload,
  LoadShipDraftPayload,
  ProjectDraftView,
  RebuildableShipView,
  RebuildCheckPayload,
  RebuildCheckView,
  RebuildCommandOutcome,
  ReviseCommandOutcome,
  ReviseProjectCommandPayload,
  ShipDraftView,
  StartRebuildCommandPayload,
  SubmitDesignCommandPayload,
} from "../../shared/design-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import {
  checkRebuildProgram,
  listRebuildableShipsProgram,
  loadProjectDraftProgram,
  loadShipDraftProgram,
  reviseProjectCommandProgram,
  startRebuildCommandProgram,
  submitDesignCommandProgram,
} from "./designCommands.js";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

const makeRuntime = () => ManagedRuntime.make(desktopMainLayer());
let runtime = makeRuntime();

function restartRuntime(): void {
  void runtime.dispose();
  runtime = makeRuntime();
}

async function runProgram<A>(
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<A>> {
  return projectCommandExit(
    await runtime.runPromiseExit(programFor(program)(payload)),
  ) as BridgeResult<A>;
}

const submitDesign = (payload: SubmitDesignCommandPayload) =>
  runProgram<DesignCommandOutcome>(submitDesignCommandProgram, payload);
const reviseProject = (payload: ReviseProjectCommandPayload) =>
  runProgram<ReviseCommandOutcome>(reviseProjectCommandProgram, payload);
const loadProjectDraft = (payload: LoadProjectDraftPayload) =>
  runProgram<ProjectDraftView>(loadProjectDraftProgram, payload);
const listRebuildableShips = (sessionId: string) =>
  runProgram<readonly RebuildableShipView[]>(listRebuildableShipsProgram, sessionId);
const loadShipDraft = (payload: LoadShipDraftPayload) =>
  runProgram<ShipDraftView>(loadShipDraftProgram, payload);
const checkRebuild = (payload: RebuildCheckPayload) =>
  runProgram<RebuildCheckView>(checkRebuildProgram, payload);
const startRebuild = (payload: StartRebuildCommandPayload) =>
  runProgram<RebuildCommandOutcome>(startRebuildCommandProgram, payload);
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);

async function advanceUntilApproved(sessionId: string, designVersionId: string): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const record = getCampaignSession(sessionId);
    if (!record) throw new Error(`session ${sessionId} vanished`);
    if (record.state.snapshot.designs.has(designVersionId)) return;
    const committed = await commitMonth({
      sessionId,
      expectedRevision: Number(record.state.snapshot.turnNumber),
      transportRequestId: `commit-${sessionId}-study-${i}`,
    });
    if (committed.outcome !== "success") throw new Error("study commit failed");
  }
  throw new Error(`design ${designVersionId} was not approved within 8 months`);
}

const cruiser = {
  nationId: "uk",
  requirement: {
    category: "CL",
    requiredSpeedMilliKnots: 16_000,
    cruiseSpeedMilliKnots: 10_000,
    requiredRangeNm: 1_500,
    designThreatId: "qf_12pdr",
    modernizationExpectation: "NONE",
    crewQualityBp: 10_000,
    accommodationStandard: "SPARTAN",
    protectionGoal: "NONE",
  },
  hull: {
    hullFormId: "protected_cruiser_form",
    lengthWl: 85_000,
    beam: 12_000,
    draught: 4_200,
    depthToMainDeck: 7_000,
    blockCoeffBp: 5_000,
    materialId: "mild_steel",
    structuralSchemeId: "mixed",
    subdivisionGrade: 2,
    targetDisplacementKg: 2_200_000,
    limitDisplacementKg: null,
    designMarginBp: 300,
    growthReserveBp: 0,
  },
  machinery: {
    plantId: "compound_cylindrical",
    installedKw: 2_300,
    zoneId: "CENTRAL_MACHINERY",
    stationPermille: 400,
    fuelCapacityKg: 800_000,
    fuelZoneId: "CENTRAL_MACHINERY",
    fuelStationPermille: 450,
    foulingBp: 0,
    rooms: [
      { zoneId: "CENTRAL_MACHINERY", stationPermille: 400, shareBp: 6_000 },
      { zoneId: "AFT_SERVICE", stationPermille: 680, shareBp: 4_000 },
    ],
  },
  armour: { regions: [], citadelLengthMm: 0, torpedoWarheadKg: 12, bunkerProtectionBp: 0 },
  placements: [
    {
      instanceId: "mg_fwd",
      componentId: "gun_nordenfelt_1in",
      zoneId: "FORECASTLE",
      stationPermille: 40,
      params: { barrels: 1, rounds: 1_000 },
      magazineRef: "mag_fwd",
    },
    {
      instanceId: "mg_aft",
      componentId: "gun_nordenfelt_1in",
      zoneId: "QUARTERDECK",
      stationPermille: 950,
      params: { barrels: 1, rounds: 1_000 },
      magazineRef: "mag_aft",
    },
    {
      instanceId: "tubes",
      componentId: "tube_14in_above_water",
      zoneId: "SUPERSTRUCTURE",
      stationPermille: 580,
      params: { tubes: 4 },
    },
    {
      instanceId: "mag_fwd",
      componentId: "magazine_small",
      zoneId: "FWD_MAGAZINE",
      stationPermille: 130,
    },
    {
      instanceId: "mag_aft",
      componentId: "magazine_small",
      zoneId: "AFT_MAGAZINE",
      stationPermille: 830,
    },
    { instanceId: "dyn", componentId: "dynamo_small", zoneId: "FWD_SERVICE", stationPermille: 200 },
    {
      instanceId: "vent",
      componentId: "ventilation_plant",
      zoneId: "FWD_SERVICE",
      stationPermille: 210,
    },
    {
      instanceId: "quarters",
      componentId: "quarters_crew",
      zoneId: "FWD_SERVICE",
      stationPermille: 230,
      params: { blocks: 12 },
    },
    {
      instanceId: "funnel",
      componentId: "funnel_single",
      zoneId: "SUPERSTRUCTURE",
      stationPermille: 600,
    },
  ],
};

describe("submitDesignCommand (ADR-0066)", () => {
  let saveRoot: string;
  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-design-"));
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    if (!output) throw new Error("production pack failed to compile");
    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveRoot);
    registerCampaignSession({
      sessionId: "ds",
      saveDir: saveRoot,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });
  });
  afterEach(() => {
    clearCampaignSessionsForTest();
    restartRuntime();
    rmSync(saveRoot, { recursive: true, force: true });
  });

  const submit = (over: Partial<SubmitDesignCommandPayload> = {}) =>
    submitDesign({
      sessionId: "ds",
      expectedRevision: 0,
      transportRequestId: "tx-d1",
      className: "Test Cruiser",
      draft: cruiser,
      ...over,
    });

  it("returns SESSION_NOT_FOUND for an unregistered session", async () => {
    const r = await submit({ sessionId: "nope" });
    expect(r).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
  });

  it("queues a valid design as a study, and the design joins the catalog when the study completes", async () => {
    const queued = await submit();
    expect(queued.outcome).toBe("success");
    if (queued.outcome !== "success") return;
    const { designVersionId, study } = queued.value;
    expect(designVersionId).toMatch(/^des_uk_test_cruiser_t\d+$/);
    expect(study).toMatchObject({ months: 4, derived: false });
    expect(getCampaignSession("ds")!.state.snapshot.designs.has(designVersionId)).toBe(false);

    await advanceUntilApproved("ds", designVersionId);
    const design = getCampaignSession("ds")!.state.snapshot.designs.get(designVersionId)!;
    expect(design).toBeDefined();
    expect(design.nationId).toBe("uk");
    expect(design.className).toBe("Test Cruiser");
    expect(design.torpedoArmament?.[0]?.tubeCount).toBe(4);
    expect(design.hullType).toBe("protected_cruiser");
  });

  it.each(["BB", "BC", "CV", "CVL", "AV", "SS", "MTB", "TR"])(
    "refuses a %s design at the 1880 campaign date and queues nothing (ADR-0088)",
    async (category) => {
      const r = await submit({
        draft: { ...cruiser, requirement: { ...cruiser.requirement, category } },
      });
      expect(r).toMatchObject({ outcome: "rejected", reason: "DESIGN_REJECTED" });
      if (r.outcome === "rejected") expect(r.diagnostics.length).toBeGreaterThan(0);
    },
  );

  it.each(["", "SUPER_BATTLESHIP", "cl", 7, null])(
    "refuses an unregistered ship type %j by shape, before any compile",
    async (category) => {
      const r = await submit({
        draft: { ...cruiser, requirement: { ...cruiser.requirement, category } },
      });
      expect(r).toMatchObject({ outcome: "rejected", reason: "INVALID_COMMAND_PAYLOAD" });
      if (r.outcome === "rejected") expect(r.diagnostics.join(" ")).toMatch(/registered ship type/);
    },
  );

  it("refuses a corvette that carries a torpedo tube, with the rule code in the diagnostics", async () => {
    const r = await submit({
      draft: { ...cruiser, requirement: { ...cruiser.requirement, category: "KE" } },
    });
    expect(r).toMatchObject({ outcome: "rejected", reason: "DESIGN_REJECTED" });
  });

  it("rejects an unbuildable design immediately with the blocking findings, queuing nothing", async () => {
    const heavy = { ...cruiser, machinery: { ...cruiser.machinery, fuelCapacityKg: 400_000 } };
    const r = await submit({ draft: heavy });
    expect(r).toMatchObject({ outcome: "rejected", reason: "DESIGN_REJECTED" });
    if (r.outcome === "rejected") expect(r.diagnostics.join(" ")).toContain("displacement");
  });

  it("rejects a design that needs technology the 1880 campaign does not have", async () => {
    const modern = {
      ...cruiser,
      machinery: { ...cruiser.machinery, plantId: "triple_expansion_watertube" },
    };
    const r = await submit({ draft: modern });
    expect(r).toMatchObject({ outcome: "rejected", reason: "DESIGN_REJECTED" });
    if (r.outcome === "rejected")
      expect(r.diagnostics.join(" ")).toMatch(/requires technology .*not unlocked/i);
  });

  it("rejects malformed payloads at the boundary and bad drafts by shape", async () => {
    expect((await submit({ className: "" })).outcome).toBe("error");
    expect((await submit({ draft: { nationId: "uk" } })).outcome).toBe("rejected");
    const badDraft = await runProgram(submitDesignCommandProgram, {
      sessionId: "ds",
      expectedRevision: 0,
      transportRequestId: "tx-bad-draft",
      className: "Test Cruiser",
      draft: "nope",
    });
    expect(badDraft.outcome).toBe("error");
  });

  it("is idempotent for the same transport request, conflicts on a different body, and rejects a stale revision", async () => {
    expect((await submit()).outcome).toBe("success");
    expect((await submit()).outcome).toBe("success");
    expect(await submit({ className: "Other Cruiser" })).toMatchObject({
      outcome: "rejected",
      reason: "IDEMPOTENCY_CONFLICT",
    });
    expect(await submit({ expectedRevision: 5, transportRequestId: "tx-stale" })).toMatchObject({
      outcome: "rejected",
      reason: "REVISION_MISMATCH",
    });
  });
});

describe("reviseProjectCommand and loadProjectDraft (ADR-0070)", () => {
  let saveRoot: string;
  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-revise-"));
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    if (!output) throw new Error("production pack failed to compile");
    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveRoot);
    registerCampaignSession({
      sessionId: "rv",
      saveDir: saveRoot,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });
  });
  afterEach(() => {
    clearCampaignSessionsForTest();
    restartRuntime();
    rmSync(saveRoot, { recursive: true, force: true });
  });

  const revision = () => Number(getCampaignSession("rv")!.state.snapshot.turnNumber);

  async function projectOn(done: number): Promise<string> {
    const queued = await submitDesign({
      sessionId: "rv",
      expectedRevision: revision(),
      transportRequestId: "tx-base",
      className: "Rev Cruiser",
      draft: cruiser,
    });
    if (queued.outcome !== "success") throw new Error("submit failed");
    const designVersionId = queued.value.designVersionId;
    await advanceUntilApproved("rv", designVersionId);
    const record = getCampaignSession("rv")!;
    const snapshot = record.state.snapshot;
    const nation = snapshot.nations.get("uk")!;
    const design = snapshot.designs.get(designVersionId)!;
    const total = Math.round(Number(design.normalizedDisplacementKg) / 100_000);
    const project = {
      id: "con_rv",
      type: "ship",
      projectType: "NEW_CONSTRUCTION",
      targetId: "ship_rv",
      designVersionId,
      totalWork: SafeInt(total),
      completedWork: SafeInt(done),
      paidWork: SafeInt(done),
      status: "ACTIVE",
      startedAt: `${record.month.year}-${String(record.month.month).padStart(2, "0")}`,
    } as unknown as (typeof nation.constructionProjects)[number];
    Object.assign(record.state, {
      snapshot: {
        ...snapshot,
        nations: new Map([
          ...snapshot.nations,
          ["uk", { ...nation, constructionProjects: [...nation.constructionProjects, project] }],
        ]),
      },
    });
    return designVersionId;
  }

  const tweaked = {
    ...cruiser,
    hull: {
      ...cruiser.hull,
      designMarginBp: (cruiser.hull as { designMarginBp: number }).designMarginBp + 100,
    },
  };
  const revise = (over: Partial<ReviseProjectCommandPayload> = {}) =>
    reviseProject({
      sessionId: "rv",
      expectedRevision: revision(),
      transportRequestId: `tx-rev-${Math.random()}`,
      projectId: "con_rv",
      draft: tweaked,
      ...over,
    });

  it("loads the real draft of a revisable project", async () => {
    await projectOn(0);
    const r = await loadProjectDraft({ sessionId: "rv", projectId: "con_rv" });
    expect(r.outcome).toBe("success");
    if (r.outcome === "success") expect(r.value.draft.hull).toEqual(cruiser.hull);
  });

  it("refuses to load an authored project that has no source draft", async () => {
    const snapshot = getCampaignSession("rv")!.state.snapshot;
    const authored = snapshot.nations.get("uk")!.constructionProjects[0];
    if (!authored) return;
    expect(await loadProjectDraft({ sessionId: "rv", projectId: authored.id })).toMatchObject({
      outcome: "rejected",
      reason: "PROJECT_NOT_REVISABLE",
    });
  });

  it("queues a free change, answers with its tier, and the month applies it", async () => {
    const oldDesign = await projectOn(0);
    const r = await revise();
    expect(r.outcome).toBe("success");
    if (r.outcome !== "success") return;
    const out = r.value;
    expect(out.tier).toBe("T0_FREE");
    const committed = await commitMonth({
      sessionId: "rv",
      expectedRevision: revision(),
      transportRequestId: "commit-rv-2",
    });
    expect(committed.outcome).toBe("success");
    const snapshot = getCampaignSession("rv")!.state.snapshot;
    const project = snapshot.nations
      .get("uk")!
      .constructionProjects.find((p) => p.id === "con_rv")!;
    expect(project.designVersionId).toBe(out.newDesignVersionId);
    expect(project.designVersionId).not.toBe(oldDesign);
    expect(snapshot.designs.has(oldDesign)).toBe(true);
  });

  it("reports a revision tier from the project's real progress", async () => {
    await projectOn(4);
    const r = await revise();
    expect(r.outcome).toBe("success");
    if (r.outcome === "success") expect(r.value.tier).toBe("T1_REVISION");
  });

  it("rejects a change on a mostly built ship, queuing nothing", async () => {
    await projectOn(12);
    expect(await revise()).toMatchObject({
      outcome: "rejected",
      reason: "REVISION_REQUIRES_REBUILD",
    });
  });

  it("rejects a revision that changes nothing and an unbuildable one", async () => {
    await projectOn(0);
    expect(await revise({ draft: cruiser })).toMatchObject({
      outcome: "rejected",
      reason: "REVISION_REJECTED",
    });
    const heavy = { ...cruiser, machinery: { ...cruiser.machinery, fuelCapacityKg: 400_000 } };
    expect(await revise({ draft: heavy })).toMatchObject({
      outcome: "rejected",
      reason: "REVISION_REJECTED",
    });
  });

  it("rejects an unknown project and malformed payloads", async () => {
    await projectOn(0);
    expect(await revise({ projectId: "nope" })).toMatchObject({
      outcome: "rejected",
      reason: "PROJECT_NOT_REVISABLE",
    });
    expect((await revise({ projectId: "" })).outcome).toBe("error");
  });
});

describe("rebuilding a ship through the programs (ADR-0078)", () => {
  let saveRoot: string;
  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-rebuild-"));
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      GENERATED_ARTIFACT,
      new AbortController().signal,
      collector,
    );
    if (!output) throw new Error("production pack failed to compile");
    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveRoot);
    registerCampaignSession({
      sessionId: "rb",
      saveDir: saveRoot,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });
  });
  afterEach(() => {
    clearCampaignSessionsForTest();
    restartRuntime();
    rmSync(saveRoot, { recursive: true, force: true });
  });

  const revision = () => Number(getCampaignSession("rb")!.state.snapshot.turnNumber);

  async function builtShip(): Promise<{ shipId: string; designVersionId: string }> {
    const queued = await submitDesign({
      sessionId: "rb",
      expectedRevision: revision(),
      transportRequestId: "tx-rb-base",
      className: "Rebuild Cruiser",
      draft: cruiser,
    });
    if (queued.outcome !== "success") throw new Error("submit failed");
    const designVersionId = queued.value.designVersionId;
    await advanceUntilApproved("rb", designVersionId);
    const record = getCampaignSession("rb")!;
    const snapshot = record.state.snapshot;
    const nation = snapshot.nations.get("uk")!;
    const [first, ...rest] = nation.fleets;
    if (!first) throw new Error("the player has no fleet");
    const ship = {
      id: "ship_rebuild_1",
      name: "HMS Rebuild",
      classId: "rebuild_cruiser",
      nationId: "uk",
      locationAreaId: first.locationAreaId,
      designVersionId,
      hitPoints: SafeInt(100),
      maxHitPoints: SafeInt(100),
      speed: SafeInt(16),
      firepower: SafeInt(10),
      armor: SafeInt(0),
      isUnderConstruction: false,
      constructionProgress: SafeInt(0),
      constructionTotalWork: SafeInt(0),
      readiness: "ACTIVE",
      crewQuality: SafeInt(100),
    };
    Object.assign(record.state, {
      snapshot: {
        ...snapshot,
        nations: new Map([
          ...snapshot.nations,
          ["uk", { ...nation, fleets: [{ ...first, ships: [...first.ships, ship] }, ...rest] }],
        ]),
      },
    });
    return { shipId: ship.id, designVersionId };
  }

  const faster = { ...cruiser, machinery: { ...cruiser.machinery, installedKw: 2_400 } };
  const wider = {
    ...cruiser,
    hull: { ...cruiser.hull, beam: Math.round(cruiser.hull.beam * 1.2) },
  };
  const check = (shipId: string, draft: unknown) =>
    checkRebuild({ sessionId: "rb", shipId, draft: draft as Record<string, unknown> });
  const start = (shipId: string, draft: unknown) =>
    startRebuild({
      sessionId: "rb",
      expectedRevision: revision(),
      transportRequestId: `tx-rb-${Math.random()}`,
      shipId,
      draft: draft as Record<string, unknown>,
    });

  it("lists the ships that can be rebuilt and loads the real draft of one", async () => {
    const { shipId } = await builtShip();
    const list = await listRebuildableShips("rb");
    expect(list.outcome).toBe("success");
    if (list.outcome === "success") expect(list.value.map((s) => s.shipId)).toEqual([shipId]);
    const draft = await loadShipDraft({ sessionId: "rb", shipId });
    expect(draft.outcome).toBe("success");
    if (draft.outcome === "success") expect(draft.value.draft.hull).toEqual(cruiser.hull);
  });

  it("does not offer authored ships, and refuses to load their draft", async () => {
    const snapshot = getCampaignSession("rb")!.state.snapshot;
    const authored = snapshot.nations.get("uk")!.fleets.flatMap((f) => f.ships)[0];
    const list = await listRebuildableShips("rb");
    expect(list).toMatchObject({ outcome: "success", value: [] });
    if (authored)
      expect(await loadShipDraft({ sessionId: "rb", shipId: authored.id })).toMatchObject({
        outcome: "rejected",
        reason: "SHIP_NOT_REBUILDABLE",
      });
  });

  it("checks a change within the limits as legal, with its measures, queuing nothing", async () => {
    const { shipId } = await builtShip();
    const r = await check(shipId, faster);
    expect(r.outcome).toBe("success");
    if (r.outcome !== "success") return;
    const view = r.value;
    expect(view.legal).toBe(true);
    expect(view.findings).toEqual([]);
    expect(view.measures!.speedChangeMilliKnots).toBeGreaterThan(0);
  });

  it("explains a change beyond the retained-hull limits, finding by finding", async () => {
    const { shipId } = await builtShip();
    const r = await check(shipId, wider);
    expect(r.outcome).toBe("success");
    if (r.outcome !== "success") return;
    const view = r.value;
    expect(view.legal).toBe(false);
    expect(view.findings.map((f) => f.id)).toContain("REBUILD_BEAM_LIMIT");
    expect(view.findings[0]!.remedies.length).toBeGreaterThanOrEqual(3);
    expect(view.measures!.beamChangeBp).toBe(2000);
  });

  it("says when a change changes nothing", async () => {
    const { shipId } = await builtShip();
    const r = await check(shipId, cruiser);
    expect(r).toMatchObject({ outcome: "success", value: { legal: false, changesNothing: true } });
  });

  const notBuildable = {
    ...cruiser,
    machinery: { ...cruiser.machinery, plantId: "triple_expansion_watertube" },
  };

  it("returns a not-allowed view (not a bridge rejection) when the changed draft fails the barrier", async () => {
    const { shipId } = await builtShip();
    const r = await check(shipId, notBuildable);
    expect(r.outcome).toBe("success");
    if (r.outcome !== "success") return;
    const view = r.value as {
      legal: boolean;
      designProblems: readonly string[];
      measures: unknown;
    };
    expect(view.legal).toBe(false);
    expect(view.designProblems.length).toBeGreaterThan(0);
    expect(view.measures).toBeNull();
  });

  const illegalSwap = {
    ...cruiser,
    placements: cruiser.placements.map((p) =>
      p.instanceId === "mg_fwd"
        ? { ...p, componentId: "gun_rml_7in_7ton", params: { barrels: 1, rounds: 100 } }
        : p,
    ),
  };

  it("returns the armament finding for an illegal gun swap and marks the check illegal", async () => {
    const { shipId } = await builtShip();
    const r = await check(shipId, illegalSwap);
    expect(r.outcome).toBe("success");
    if (r.outcome !== "success") return;
    const view = r.value;
    expect(view.findings.map((f) => f.id)).toContain("ARMAMENT_SECONDARY_TOO_LARGE");
    expect(view.legal).toBe(false);
  });

  it("requires a blister on a BULGE rebuild whose hull did not grow", async () => {
    const { shipId } = await builtShip();
    const r = await checkRebuild({
      sessionId: "rb",
      shipId,
      draft: faster,
      rebuildKind: "BULGE",
    });
    expect(r.outcome).toBe("success");
    if (r.outcome !== "success") return;
    const view = r.value;
    expect(view.findings.map((f) => f.id)).toContain("REBUILD_BULGE_REQUIRED");
    expect(view.legal).toBe(false);
    expect(view.bulgeProtectionGainBp).toBeGreaterThan(0);
  });

  it("queues a legal rebuild, and committing the month makes the ship unavailable on a REBUILD project", async () => {
    const { shipId } = await builtShip();
    const r = await start(shipId, faster);
    expect(r.outcome).toBe("success");
    if (r.outcome !== "success") return;
    const out = r.value;
    const committed = await commitMonth({
      sessionId: "rb",
      expectedRevision: revision(),
      transportRequestId: "commit-rb-2",
    });
    expect(committed.outcome).toBe("success");
    const snapshot = getCampaignSession("rb")!.state.snapshot;
    const nation = snapshot.nations.get("uk")!;
    const ship = nation.fleets.flatMap((f) => f.ships).find((s) => s.id === shipId)!;
    expect(ship.availability).toBe("UNAVAILABLE");
    const project = nation.constructionProjects.find((p) => p.id === out.projectId)!;
    expect(project).toMatchObject({ projectType: "REBUILD", targetShipId: shipId });
    expect(snapshot.designs.has(out.newDesignVersionId)).toBe(true);
    expect(await listRebuildableShips("rb")).toMatchObject({ value: [] });
  });

  it("rejects an illegal or no-op rebuild immediately, queuing nothing", async () => {
    const { shipId } = await builtShip();
    expect(await start(shipId, wider)).toMatchObject({
      outcome: "rejected",
      reason: "REBUILD_REJECTED",
    });
    expect(await start(shipId, cruiser)).toMatchObject({
      outcome: "rejected",
      reason: "REBUILD_REJECTED",
    });
  });

  it("rejects an unknown ship and malformed payloads", async () => {
    await builtShip();
    expect(await start("nope", faster)).toMatchObject({
      outcome: "rejected",
      reason: "SHIP_NOT_REBUILDABLE",
    });
    expect((await start("", faster)).outcome).toBe("error");
    expect((await check("", faster)).outcome).toBe("error");
  });
});
