import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  CampaignSnapshot,
  CampaignState,
  DiplomaticRelation,
  WarDeclaration,
} from "@bluewave/campaign";
import type { CommandBody, CommandEnvelope } from "@bluewave/commands";
import { canonicalSerialize, createEnvelope, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { CANONICAL_RESEARCH_FIELD_IDS, type CommitMonthResponse } from "@bluewave/campaign-engine";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { pendingEnvelopesForExecution, clearPendingWorkspacesForTest } from "../pendingCommands.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { programFor, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import {
  inspectDiplomacyScreenProgram,
  submitDiplomacyCommandProgram,
} from "./diplomacyCommands.js";
import { setResearchPriorityCommandProgram } from "./researchCommands.js";
import type {
  DiplomacyCommandBody,
  DiplomacyCommandOutcome,
  DiplomacyScreenProjection,
  SubmitDiplomacyCommandPayload,
} from "../../shared/diplomacy-contract.js";
import type { ResearchPriorityOutcome } from "../../shared/research-contract.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
const GENERATED_ARTIFACT = resolve(REPO_ROOT, "content", "generated", "1880");

const runtime = ManagedRuntime.make(desktopMainLayer());

async function runProgram<A>(
  program: AnyCommandHandler,
  payload: unknown,
): Promise<BridgeResult<A>> {
  return projectCommandExit(
    await runtime.runPromiseExit(programFor(program)(payload)),
  ) as BridgeResult<A>;
}

const inspectDiplomacyScreen = (sessionId: string) =>
  runProgram<DiplomacyScreenProjection>(inspectDiplomacyScreenProgram, sessionId);
const submitDiplomacyCommand = (payload: SubmitDiplomacyCommandPayload) =>
  runProgram<DiplomacyCommandOutcome>(submitDiplomacyCommandProgram, payload);
const setResearchPriorityCommand = (payload: unknown) =>
  runProgram<ResearchPriorityOutcome>(setResearchPriorityCommandProgram, payload);
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);

const DIPLOMACY_TYPES = new Set<string>([
  "DeclareWar",
  "AcceptPeace",
  "FormAlliance",
  "BreakAlliance",
  "FormNonAggressionPact",
  "BreakNonAggressionPact",
  "DeclareBlockade",
]);

describe("diplomacy commands", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-diplomacy-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    clearPendingWorkspacesForTest();
  });

  function registerProductionSession(
    sessionId: string,
    saveDir: string,
    patch?: (snapshot: CampaignSnapshot) => void,
  ): CampaignState {
    const signal = new AbortController().signal;
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(GENERATED_ARTIFACT, signal, collector);
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");

    let snapshot = structuredClone(output.state.snapshot);
    if (patch) patch(snapshot);
    const state: CampaignState = {
      snapshot,
      envelope: createEnvelope("campaign-snapshot", snapshot.compatibilityVersion, snapshot),
      rawHash: "",
    };
    const saveable = toSaveableState(state);
    new SaveStore().save(saveable, saveDir);
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state: saveable,
    });
    return saveable;
  }

  function requireSessionState(sessionId: string): CampaignState {
    const record = getCampaignSession(sessionId);
    if (!record) throw new Error(`session ${sessionId} missing`);
    return record.state;
  }

  function patchRelation(
    snapshot: CampaignSnapshot,
    a: string,
    b: string,
    changes: Partial<DiplomaticRelation>,
  ): void {
    const key = [a, b].sort().join("\u0000");
    snapshot.politics = {
      ...snapshot.politics,
      relations: snapshot.politics.relations.map((r) =>
        [r.nationA, r.nationB].sort().join("\u0000") === key ? { ...r, ...changes } : r,
      ),
    };
  }

  function makeActiveWar(): WarDeclaration {
    return {
      id: "war_uk_france_1880-01",
      attackerSideId: "side_uk",
      defenderSideId: "side_france",
      attackerSideMembers: ["uk"],
      defenderSideMembers: ["france"],
      attackerWarScore: 3,
      defenderWarScore: 1,
      attackerId: "uk",
      defenderId: "france",
      startDate: "1880-01",
      status: "ACTIVE",
    };
  }

  function queuedDiplomacy(sessionId: string): CommandEnvelope<CommandBody>[] {
    const state = requireSessionState(sessionId);
    return pendingEnvelopesForExecution(sessionId, state.snapshot).filter((envelope) =>
      DIPLOMACY_TYPES.has(envelope.body.type as string),
    );
  }

  function payload(
    sessionId: string,
    command: DiplomacyCommandBody,
    overrides: { expectedRevision?: number; transportRequestId?: string } = {},
  ) {
    return {
      sessionId,
      expectedRevision: overrides.expectedRevision ?? 0,
      transportRequestId: overrides.transportRequestId ?? "req-1",
      command,
    };
  }

  function declareWar(targetNationId = "france"): DiplomacyCommandBody {
    return { type: "DeclareWar", targetNationId };
  }

  describe("inspectDiplomacyScreen (AC-1)", () => {
    it("projects the real compiled snapshot: known nations, relations, wars, blockades, areas", async () => {
      const saveDir = resolve(saveRoot, "inspect-1");
      const state = registerProductionSession("inspect-session", saveDir);

      const result = await inspectDiplomacyScreen("inspect-session");
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      const value = result.value;

      expect(value.revision).toBe(0);
      expect(value.month).toEqual({ month: 1, year: 1880 });
      expect(value.playerNationId).toBe("uk");

      expect(value.knownNations.length).toBe(state.snapshot.nations.size - 1);
      const ids = value.knownNations.map((n) => n.nationId);
      expect([...ids].sort()).toEqual(ids);
      expect(ids).not.toContain("uk");
      const france = value.knownNations.find((n) => n.nationId === "france");
      expect(france?.name).toBe(state.snapshot.nations.get("france")!.name);

      expect(value.relations.length).toBeGreaterThanOrEqual(state.snapshot.nations.size - 1);
      expect(value.relations.every((r) => r.partnerNationId !== "uk")).toBe(true);
      expect(value.relations.every((r) => r.nationAId === "uk" || r.nationBId === "uk")).toBe(true);

      expect(value.wars).toEqual([]);
      expect(value.blockades).toEqual([]);
      expect(value.areas.length).toBeGreaterThan(0);
      const areaIds = value.areas.map((a) => a.areaId);
      expect([...areaIds].sort()).toEqual(areaIds);
    });

    it("returns SESSION_NOT_FOUND for an unknown session", async () => {
      const result = await inspectDiplomacyScreen("no-such-session");
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") return;
      expect(result.reason).toBe("SESSION_NOT_FOUND");
    });
  });

  describe("submitDiplomacyCommand — boundary failures", () => {
    it("returns SESSION_NOT_FOUND for a well-formed submit against an unknown session", async () => {
      const result = await submitDiplomacyCommand(payload("no-such-session", declareWar("france")));
      expect(result).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
    });

    it("rejects a malformed wire payload at the schema boundary", async () => {
      const result = await runProgram(submitDiplomacyCommandProgram, {
        sessionId: "b",
        expectedRevision: 0,
        transportRequestId: "req-x",
        command: { type: "DeclareWar", targetNationId: "" },
      });
      expect(result).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
    });
  });

  describe("submitDiplomacyCommand — the 7 types (AC-2)", () => {
    it("DeclareWar: queues a real engine envelope pinned to the session hash", async () => {
      const saveDir = resolve(saveRoot, "type-declare");
      registerProductionSession("type-declare-session", saveDir);

      const result = await submitDiplomacyCommand(
        payload("type-declare-session", declareWar("france")),
      );
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      expect(result.value.bodyType).toBe("DeclareWar");
      expect(result.value.appliedOnNextTurn).toBe(true);
      expect(result.value.commandId).toMatch(/^player-[0-9a-f]{40}$/);

      const [queued] = queuedDiplomacy("type-declare-session");
      expect(queued).toBeDefined();
      if (!queued) return;
      expect(queued.version).toBe("0.1.0");
      expect(queued.body.type).toBe("DeclareWar");
      const body = queued.body as Extract<CommandBody, { type: "DeclareWar" }>;
      expect(body.nationId).toBe("uk");
      expect(body.targetNationId).toBe("france");
      expect(body.warGoalsId).toBeUndefined();
      expect(queued.issuerClass).toBe("PLAYER");
      expect(queued.issuerParticipantId).toBe("uk");
      expect(queued.expectedSnapshotHash).toBe(
        sha256Hex(canonicalSerialize(requireSessionState("type-declare-session").snapshot)),
      );
      expect(queued.idempotencyKey).toContain("/0/uk/DeclareWar");
      expect(queued.timestamp).toBe("1910-01-01T00:00:00.000Z");
    });

    it("DeclareWar with warGoalsId carries it on the envelope body", async () => {
      const saveDir = resolve(saveRoot, "type-declare-goals");
      registerProductionSession("type-goals-session", saveDir);

      const result = await submitDiplomacyCommand(
        payload("type-goals-session", {
          type: "DeclareWar",
          targetNationId: "germany",
          warGoalsId: "wg_conquest",
        }),
      );
      expect(result.outcome).toBe("success");
      const [queued] = queuedDiplomacy("type-goals-session");
      expect(queued).toBeDefined();
      if (!queued) return;
      expect((queued.body as { warGoalsId?: string }).warGoalsId).toBe("wg_conquest");
    });

    it("FormAlliance on a neutral pair queues a valid envelope", async () => {
      const saveDir = resolve(saveRoot, "type-alliance");
      registerProductionSession("type-alliance-session", saveDir);

      const result = await submitDiplomacyCommand(
        payload("type-alliance-session", { type: "FormAlliance", partnerNationId: "germany" }),
      );
      expect(result.outcome).toBe("success");
      const [queued] = queuedDiplomacy("type-alliance-session");
      expect(queued?.body).toEqual({
        type: "FormAlliance",
        nationId: "uk",
        partnerNationId: "germany",
      });
    });

    it("FormNonAggressionPact on a neutral pair queues a valid envelope", async () => {
      const saveDir = resolve(saveRoot, "type-nap");
      registerProductionSession("type-nap-session", saveDir);

      const result = await submitDiplomacyCommand(
        payload("type-nap-session", {
          type: "FormNonAggressionPact",
          partnerNationId: "germany",
        }),
      );
      expect(result.outcome).toBe("success");
      const [queued] = queuedDiplomacy("type-nap-session");
      expect(queued?.body).toEqual({
        type: "FormNonAggressionPact",
        nationId: "uk",
        partnerNationId: "germany",
      });
    });

    it("BreakNonAggressionPact on a NAP-active pair queues a valid envelope", async () => {
      const saveDir = resolve(saveRoot, "type-break-nap");
      registerProductionSession("type-break-nap-session", saveDir, (snapshot) => {
        patchRelation(snapshot, "uk", "germany", { nap: true });
      });

      const result = await submitDiplomacyCommand(
        payload("type-break-nap-session", {
          type: "BreakNonAggressionPact",
          partnerNationId: "germany",
        }),
      );
      expect(result.outcome).toBe("success");
      const [queued] = queuedDiplomacy("type-break-nap-session");
      expect(queued?.body).toEqual({
        type: "BreakNonAggressionPact",
        nationId: "uk",
        partnerNationId: "germany",
      });
    });

    it("BreakAlliance on an allied pair queues a valid envelope", async () => {
      const saveDir = resolve(saveRoot, "type-break-alliance");
      registerProductionSession("type-break-alliance-session", saveDir, (snapshot) => {
        patchRelation(snapshot, "uk", "france", { relation: "allied", tension: 2 });
      });

      const result = await submitDiplomacyCommand(
        payload("type-break-alliance-session", {
          type: "BreakAlliance",
          partnerNationId: "france",
        }),
      );
      expect(result.outcome).toBe("success");
      const [queued] = queuedDiplomacy("type-break-alliance-session");
      expect(queued?.body).toEqual({
        type: "BreakAlliance",
        nationId: "uk",
        partnerNationId: "france",
      });
    });

    it("AcceptPeace on an ACTIVE member war queues a valid envelope", async () => {
      const saveDir = resolve(saveRoot, "type-peace");
      registerProductionSession("type-peace-session", saveDir, (snapshot) => {
        snapshot.wars = { ...snapshot.wars, wars: [makeActiveWar()] };
      });

      const result = await submitDiplomacyCommand(
        payload("type-peace-session", { type: "AcceptPeace", warId: "war_uk_france_1880-01" }),
      );
      expect(result.outcome).toBe("success");
      const [queued] = queuedDiplomacy("type-peace-session");
      expect(queued?.body).toEqual({
        type: "AcceptPeace",
        nationId: "uk",
        warId: "war_uk_france_1880-01",
      });
    });

    it("DeclareBlockade against an at-war target queues a valid envelope", async () => {
      const saveDir = resolve(saveRoot, "type-blockade");
      registerProductionSession("type-blockade-session", saveDir, (snapshot) => {
        patchRelation(snapshot, "uk", "france", { relation: "at_war", tension: 9 });
      });

      const result = await submitDiplomacyCommand(
        payload("type-blockade-session", {
          type: "DeclareBlockade",
          targetNationId: "france",
          areaId: "med_gibraltar",
        }),
      );
      expect(result.outcome).toBe("success");
      const [queued] = queuedDiplomacy("type-blockade-session");
      expect(queued?.body).toEqual({
        type: "DeclareBlockade",
        nationId: "uk",
        targetNationId: "france",
        areaId: "med_gibraltar",
      });
    });
  });

  describe("engine-authoritative rejection at issue (AC-3)", () => {
    it("DeclareWar on a nonexistent nation returns the engine code and does not queue", async () => {
      const saveDir = resolve(saveRoot, "reject-target");
      registerProductionSession("reject-target-session", saveDir);

      const result = await submitDiplomacyCommand(
        payload("reject-target-session", declareWar("atlantis")),
      );
      expect(result.outcome).toBe("rejected");
      if (result.outcome !== "rejected") return;
      expect(result.reason).toBe("DECLARE_WAR_INVALID_TARGET");
      expect(result.diagnostics.join(" ")).toContain("atlantis");
      expect(queuedDiplomacy("reject-target-session")).toEqual([]);
    });

    it("FormAlliance with ourselves returns the engine code and does not queue", async () => {
      const saveDir = resolve(saveRoot, "reject-self-alliance");
      registerProductionSession("reject-self-session", saveDir);

      const result = await submitDiplomacyCommand(
        payload("reject-self-session", { type: "FormAlliance", partnerNationId: "uk" }),
      );
      expect(result.outcome).toBe("rejected");
      if (result.outcome !== "rejected") return;
      expect(result.reason).toBe("ALLIANCE_FORMATION_INELIGIBLE");
      expect(result.diagnostics.join(" ")).toContain("ally");
      expect(queuedDiplomacy("reject-self-session")).toEqual([]);
    });

    it("DeclareBlockade when not at war returns the engine code and does not queue", async () => {
      const saveDir = resolve(saveRoot, "reject-blockade");
      registerProductionSession("reject-blockade-session", saveDir);

      const result = await submitDiplomacyCommand(
        payload("reject-blockade-session", {
          type: "DeclareBlockade",
          targetNationId: "france",
          areaId: "med_gibraltar",
        }),
      );
      expect(result.outcome).toBe("rejected");
      if (result.outcome !== "rejected") return;
      expect(result.reason).toBe("BLOCKADE_NOT_AT_WAR");
      expect(queuedDiplomacy("reject-blockade-session")).toEqual([]);
    });
  });

  describe("idempotency + revision (AC-4)", () => {
    it("same transportRequestId + same payload replays; different payload conflicts", async () => {
      const saveDir = resolve(saveRoot, "idem-1");
      registerProductionSession("idem-session", saveDir);

      const first = await submitDiplomacyCommand(
        payload("idem-session", declareWar("france"), { transportRequestId: "req-1" }),
      );
      expect(first.outcome).toBe("success");
      if (first.outcome !== "success") return;
      expect(first.value.commandId).toMatch(/^player-/);

      const replayed = await submitDiplomacyCommand(
        payload("idem-session", declareWar("france"), { transportRequestId: "req-1" }),
      );
      expect(replayed.outcome).toBe("success");
      if (replayed.outcome !== "success") return;
      expect(replayed.value.commandId).toBe(first.value.commandId);

      expect(queuedDiplomacy("idem-session")).toHaveLength(1);

      const conflicting = await submitDiplomacyCommand(
        payload("idem-session", declareWar("germany"), { transportRequestId: "req-1" }),
      );
      expect(conflicting.outcome).toBe("rejected");
      if (conflicting.outcome !== "rejected") return;
      expect(conflicting.reason).toBe("IDEMPOTENCY_CONFLICT");
      expect(queuedDiplomacy("idem-session")).toHaveLength(1);
    });

    it("two same-type commands in one turn get distinct commandIds (discriminator in the idempotency key)", async () => {
      const saveDir = resolve(saveRoot, "distinct-1");
      registerProductionSession("distinct-session", saveDir);

      const vsFrance = await submitDiplomacyCommand(
        payload("distinct-session", declareWar("france"), { transportRequestId: "req-1" }),
      );
      const vsGermany = await submitDiplomacyCommand(
        payload("distinct-session", declareWar("germany"), { transportRequestId: "req-2" }),
      );
      expect(vsFrance.outcome).toBe("success");
      expect(vsGermany.outcome).toBe("success");
      if (vsFrance.outcome !== "success" || vsGermany.outcome !== "success") return;

      expect(vsFrance.value.commandId).not.toBe(vsGermany.value.commandId);
      expect(queuedDiplomacy("distinct-session")).toHaveLength(2);
    });

    it("stale expectedRevision returns REVISION_MISMATCH without touching the session or queue", async () => {
      const saveDir = resolve(saveRoot, "stale-1");
      registerProductionSession("stale-session", saveDir);

      const result = await submitDiplomacyCommand(
        payload("stale-session", declareWar("france"), { expectedRevision: 5 }),
      );
      expect(result.outcome).toBe("rejected");
      if (result.outcome !== "rejected") return;
      expect(result.reason).toBe("REVISION_MISMATCH");
      expect(result.currentRevision).toBe(0);
      expect(queuedDiplomacy("stale-session")).toEqual([]);
    });
  });

  describe("AC-2 integration: commitMonth drains diplomacy envelopes", () => {
    it("DeclareWar + commitMonth → projection shows the DECLARED_NOT_ACTIVE war and an at_war relation", async () => {
      const saveDir = resolve(saveRoot, "apply-war");
      registerProductionSession("apply-war-session", saveDir);

      const issued = await submitDiplomacyCommand(
        payload("apply-war-session", declareWar("france"), { transportRequestId: "war-1" }),
      );
      expect(issued.outcome).toBe("success");

      const committed = await commitMonth({
        sessionId: "apply-war-session",
        expectedRevision: 0,
        transportRequestId: "commit-1",
      });
      expect(committed.outcome).toBe("success");
      if (committed.outcome !== "success") return;
      expect(committed.value.closingSnapshot.revision).toBe(1);

      const inspect = await inspectDiplomacyScreen("apply-war-session");
      expect(inspect.outcome).toBe("success");
      if (inspect.outcome !== "success") return;
      expect(inspect.value.revision).toBe(1);

      const warRow = inspect.value.wars.find(
        (w) => w.warId === "war_uk_france_1880-01" || w.warId.startsWith("war_uk_france"),
      );
      expect(warRow).toBeDefined();
      if (!warRow) return;
      expect(warRow.playerSide).toBe("attacker");
      expect(warRow.status).toBe("DECLARED_NOT_ACTIVE");
      expect(warRow.attackerId).toBe("uk");
      expect(warRow.defenderId).toBe("france");
      expect(warRow.attackerWarScore).toBe(0);
      expect(warRow.defenderWarScore).toBe(0);

      const relationRow = inspect.value.relations.find((r) => r.partnerNationId === "france");
      expect(relationRow?.relation).toBe("at_war");
      expect(relationRow?.tension).toBeGreaterThan(5);

      expect(
        pendingEnvelopesForExecution(
          "apply-war-session",
          requireSessionState("apply-war-session").snapshot,
        ),
      ).toEqual([]);
    });

    it("FormAlliance + commitMonth → projection shows the allied relation", async () => {
      const saveDir = resolve(saveRoot, "apply-alliance");
      registerProductionSession("apply-alliance-session", saveDir);

      const issued = await submitDiplomacyCommand(
        payload("apply-alliance-session", { type: "FormAlliance", partnerNationId: "germany" }),
      );
      expect(issued.outcome).toBe("success");

      const committed = await commitMonth({
        sessionId: "apply-alliance-session",
        expectedRevision: 0,
        transportRequestId: "commit-1",
      });
      expect(committed.outcome).toBe("success");

      const inspect = await inspectDiplomacyScreen("apply-alliance-session");
      expect(inspect.outcome).toBe("success");
      if (inspect.outcome !== "success") return;
      const row = inspect.value.relations.find((r) => r.partnerNationId === "germany");
      expect(row?.relation).toBe("allied");
    });

    it("a queued research priority and a queued diplomacy command drain through the SAME commitMonth", async () => {
      const saveDir = resolve(saveRoot, "mixed-drain");
      registerProductionSession("mixed-session", saveDir);

      const priorities: Record<string, number> = {
        GUNNERY: 4,
        MACHINERY: 2,
        HULL_CONSTRUCTION: 2,
      };
      for (const field of CANONICAL_RESEARCH_FIELD_IDS) {
        if (priorities[field] === undefined) priorities[field] = 1;
      }
      const research = await setResearchPriorityCommand({
        sessionId: "mixed-session",
        expectedRevision: 0,
        transportRequestId: "req-research",
        fieldPriorities: priorities,
      });
      expect(research.outcome).toBe("success");

      const diplomacy = await submitDiplomacyCommand(
        payload("mixed-session", declareWar("france"), { transportRequestId: "req-war" }),
      );
      expect(diplomacy.outcome).toBe("success");

      expect(
        pendingEnvelopesForExecution("mixed-session", requireSessionState("mixed-session").snapshot)
          .map((e) => e.body.type)
          .sort(),
      ).toEqual(["DeclareWar", "SetResearchPriority"]);

      const committed = await commitMonth({
        sessionId: "mixed-session",
        expectedRevision: 0,
        transportRequestId: "commit-1",
      });
      expect(committed.outcome).toBe("success");
      if (committed.outcome !== "success") return;

      const after = requireSessionState("mixed-session");
      expect(after.snapshot.nations.get("uk")!.research.fieldPriorities.GUNNERY).toBe(4);
      expect(
        after.snapshot.wars.wars.some(
          (w) =>
            w.attackerId === "uk" &&
            w.defenderId === "france" &&
            w.status === "DECLARED_NOT_ACTIVE",
        ),
      ).toBe(true);
      expect(pendingEnvelopesForExecution("mixed-session", after.snapshot)).toEqual([]);
    });
  });

  describe("determinism (AC-5)", () => {
    it("two identical sessions with the same command produce identical final rawHash", async () => {
      const saveDirA = resolve(saveRoot, "det-a");
      const saveDirB = resolve(saveRoot, "det-b");
      registerProductionSession("det-a", saveDirA);
      registerProductionSession("det-b", saveDirB);

      const a = await submitDiplomacyCommand(payload("det-a", declareWar("france")));
      const b = await submitDiplomacyCommand(payload("det-b", declareWar("france")));
      expect(a.outcome).toBe("success");
      expect(b.outcome).toBe("success");
      if (a.outcome !== "success" || b.outcome !== "success") return;
      expect(a.value.commandId).toBe(b.value.commandId);

      const committedA = await commitMonth({
        sessionId: "det-a",
        expectedRevision: 0,
        transportRequestId: "c",
      });
      const committedB = await commitMonth({
        sessionId: "det-b",
        expectedRevision: 0,
        transportRequestId: "c",
      });
      expect(committedA.outcome).toBe("success");
      expect(committedB.outcome).toBe("success");

      expect(requireSessionState("det-a").rawHash).toBe(requireSessionState("det-b").rawHash);
      expect(requireSessionState("det-a").snapshot.wars.wars).toEqual(
        requireSessionState("det-b").snapshot.wars.wars,
      );
    });
  });
});
