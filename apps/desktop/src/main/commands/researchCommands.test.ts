import type { SetResearchPriorityCommand } from "@bluewave/commands";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CampaignState } from "@bluewave/campaign";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
  type CommitMonthResponse,
} from "@bluewave/campaign-engine";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  ResearchPriorityOutcome,
  ResearchScreenProjection,
  SetResearchPriorityCommandPayload,
} from "../../shared/research-contract.js";
import type {
  ConstructionCommandQueuedOutcome,
  SubmitConstructionCommandPayload,
} from "../../shared/construction-contract.js";
import {
  clearCampaignSessionsForTest,
  getCampaignSession,
  registerCampaignSession,
} from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { programFor, queuedEnvelopes, type AnyCommandHandler } from "../commandProgramFixtures.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import {
  inspectResearchScreenProgram,
  setResearchPriorityCommandProgram,
} from "./researchCommands.js";
import { submitConstructionCommandProgram } from "./constructionCommands.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../../..");
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

const inspectResearchScreen = (sessionId: string) =>
  runProgram<ResearchScreenProjection>(inspectResearchScreenProgram, sessionId);
const setResearchPriorityCommand = (payload: SetResearchPriorityCommandPayload) =>
  runProgram<ResearchPriorityOutcome>(setResearchPriorityCommandProgram, payload);
const submitConstructionCommand = (payload: SubmitConstructionCommandPayload) =>
  runProgram<ConstructionCommandQueuedOutcome>(submitConstructionCommandProgram, payload);
const commitMonth = (payload: {
  sessionId: string;
  expectedRevision: number;
  transportRequestId: string;
}) => runProgram<CommitMonthResponse>(commitMonthProgram, payload);

describe("research commands", () => {
  let saveRoot: string;

  beforeEach(() => {
    saveRoot = mkdtempSync(resolve(tmpdir(), "bw-desktop-research-"));
  });

  afterEach(() => {
    rmSync(saveRoot, { recursive: true, force: true });
    clearCampaignSessionsForTest();
    restartRuntime();
  });

  function ukFieldPriorities(state: CampaignState): Record<string, number> {
    return Object.fromEntries(
      Object.entries(state.snapshot.nations.get("uk")!.research.fieldPriorities).map(
        ([field, weight]) => [field, Number(weight)],
      ),
    );
  }

  function registerProductionSession(sessionId: string, saveDir: string): CampaignState {
    const signal = new AbortController().signal;
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(GENERATED_ARTIFACT, signal, collector);
    expect(collector.hasErrors).toBe(false);
    if (!output) throw new Error("production pack failed to compile");

    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveDir);
    registerCampaignSession({
      sessionId,
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });
    return state;
  }

  function requireSessionState(sessionId: string): CampaignState {
    const record = getCampaignSession(sessionId);
    if (!record) throw new Error(`session ${sessionId} missing`);
    return record.state;
  }

  function fullPriorities(): Record<string, number> {
    const all: Record<string, number> = {};
    for (const field of CANONICAL_RESEARCH_FIELD_IDS) {
      all[field] = RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
    }
    all.GUNNERY = RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH;
    all.MACHINERY = RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM;
    all.HULL_CONSTRUCTION = RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM;
    return all;
  }

  function priorityPayload(
    sessionId: string,
    fieldPriorities: Record<string, number>,
    overrides: {
      expectedRevision?: number;
      transportRequestId?: string;
      exactTechId?: string;
    } = {},
  ) {
    return {
      sessionId,
      expectedRevision: overrides.expectedRevision ?? 0,
      transportRequestId: overrides.transportRequestId ?? "req-1",
      fieldPriorities,
      ...(overrides.exactTechId !== undefined ? { exactTechId: overrides.exactTechId } : {}),
    };
  }

  describe("inspectResearchScreen (AC-1)", () => {
    it("projects the real compiled research state — budget, priorities, progress, project", async () => {
      const saveDir = resolve(saveRoot, "inspect-1");
      const state = registerProductionSession("inspect-session", saveDir);
      const ukResearch = state.snapshot.nations.get("uk")!.research;

      const result = await inspectResearchScreen("inspect-session");
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      expect(result.value.revision).toBe(0);
      expect(result.value.month).toEqual({ month: 1, year: 1880 });
      expect(result.value.nationId).toBe("uk");
      expect(result.value.researchBudget).toBe(Number(ukResearch.researchBudget));
      expect(result.value.fieldPriorities).toEqual(ukFieldPriorities(state));
      expect(result.value.discoveredTechIds).toEqual(
        [...ukResearch.discoveredTechs].sort((a, b) => a.localeCompare(b)),
      );
      expect(result.value.inProgressTechnologies).toEqual(
        ukResearch.technologies.map((t) => ({
          techId: t.techId,
          investedPoints: Number(t.investedPoints),
          completed: t.completed,
        })),
      );
      expect(result.value.currentProjectTechId).toBe(ukResearch.currentProjectTechId ?? null);
    });

    it("carries the full technology chart with authored names from the content artifact", async () => {
      registerProductionSession("chart-session", resolve(saveRoot, "chart-1"));

      const result = await inspectResearchScreen("chart-session");
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;

      const wrought = result.value.technologies.find((t) => t.techId === "hc_wrought_iron_hull");
      expect(wrought?.name).toBe("Wrought Iron Hull Construction");
      expect(result.value.technologies.length).toBeGreaterThan(50);
      expect(result.value.fields.map((f) => f.fieldId)).toContain("HULL_CONSTRUCTION");
    });

    it("returns SESSION_NOT_FOUND for an unknown session", async () => {
      const result = await inspectResearchScreen("no-such-session");
      expect(result.outcome).toBe("error");
      if (result.outcome !== "error") return;
      expect(result.reason).toBe("SESSION_NOT_FOUND");
    });
  });

  describe("setResearchPriorityCommand (AC-2..AC-4)", () => {
    it("returns SESSION_NOT_FOUND for a well-formed submit against an unknown session", async () => {
      const result = await setResearchPriorityCommand(
        priorityPayload("no-such-session", fullPriorities()),
      );
      expect(result).toMatchObject({ outcome: "error", reason: "SESSION_NOT_FOUND" });
    });

    it("rejects a malformed wire payload at the schema boundary", async () => {
      const result = await runProgram(setResearchPriorityCommandProgram, {
        sessionId: "issue-session",
        expectedRevision: 0,
        transportRequestId: "req-x",
        fieldPriorities: { GUNNERY: 1.5 },
      });
      expect(result).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });
    });

    it("queues a real engine envelope pinned to the session snapshot hash", async () => {
      const saveDir = resolve(saveRoot, "issue-1");
      registerProductionSession("issue-session", saveDir);
      const priorities = fullPriorities();

      const result = await setResearchPriorityCommand(priorityPayload("issue-session", priorities));
      expect(result.outcome).toBe("success");
      if (result.outcome !== "success") return;
      expect(result.value.appliedOnNextTurn).toBe(true);
      expect(result.value.priorities).toEqual(priorities);
      expect(result.value.commandId).toMatch(/^player-[0-9a-f]{40}$/);

      const session = requireSessionState("issue-session");
      const [queued] = queuedEnvelopes<SetResearchPriorityCommand>(
        runtime,
        "issue-session",
        session.snapshot,
      );
      expect(queued).toBeDefined();
      if (!queued) return;
      expect(queued.version).toBe("0.1.0");
      expect(queued.body.type).toBe("SetResearchPriority");
      expect(queued.body.nationId).toBe("uk");
      expect(queued.body.exactTechId).toBeUndefined();
      expect(queued.issuerClass).toBe("PLAYER");
      expect(queued.issuerParticipantId).toBe("uk");
      expect(queued.expectedSnapshotHash).toBe(sha256Hex(canonicalSerialize(session.snapshot)));
      expect(queued.idempotencyKey).toContain("/0/uk/SetResearchPriority");
      expect(queued.timestamp).toBe("1910-01-01T00:00:00.000Z");
    });

    it("AC-2: the next commitMonth applies the queued priorities — visible in the projection and snapshot", async () => {
      const saveDir = resolve(saveRoot, "apply-1");
      registerProductionSession("apply-session", saveDir);
      const priorities = fullPriorities();

      const issued = await setResearchPriorityCommand(priorityPayload("apply-session", priorities));
      expect(issued.outcome).toBe("success");

      const committed = await commitMonth({
        sessionId: "apply-session",
        expectedRevision: 0,
        transportRequestId: "commit-1",
      });
      expect(committed.outcome).toBe("success");
      if (committed.outcome !== "success") return;

      const after = requireSessionState("apply-session");
      expect(ukFieldPriorities(after)).toEqual(priorities);

      const inspected = await inspectResearchScreen("apply-session");
      expect(inspected.outcome).toBe("success");
      if (inspected.outcome !== "success") return;
      expect(inspected.value.fieldPriorities).toEqual(priorities);
      expect(queuedEnvelopes(runtime, "apply-session", after.snapshot)).toEqual([]);
    });

    it("AC-3: rejects invalid priority records without touching the session or queue", async () => {
      const saveDir = resolve(saveRoot, "invalid-1");
      registerProductionSession("invalid-session", saveDir);
      const pristine = ukFieldPriorities(requireSessionState("invalid-session"));

      const overCap = await setResearchPriorityCommand(
        priorityPayload("invalid-session", { ...fullPriorities(), NUCLEAR_FUSION: 2 }),
      );
      expect(overCap).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });

      const nonInteger = await setResearchPriorityCommand(
        priorityPayload("invalid-session", { ...fullPriorities(), GUNNERY: 1.5 }),
      );
      expect(nonInteger).toMatchObject({ outcome: "error", reason: "INVALID_PAYLOAD" });

      const partial = await setResearchPriorityCommand(
        priorityPayload("invalid-session", { GUNNERY: 4, MACHINERY: 2 }),
      );
      expect(partial).toMatchObject({
        outcome: "rejected",
        reason: "RESEARCH_PRIORITY_CONSTRAINT_VIOLATED",
      });

      const sameSizeUnknown = fullPriorities();
      delete sameSizeUnknown[CANONICAL_RESEARCH_FIELD_IDS[0]!];
      sameSizeUnknown.NUCLEAR_FUSION = 2;
      const unknown = await setResearchPriorityCommand(
        priorityPayload("invalid-session", sameSizeUnknown),
      );
      expect(unknown.outcome).toBe("rejected");
      if (unknown.outcome !== "rejected") return;
      expect(unknown.reason).toBe("RESEARCH_PRIORITY_CONSTRAINT_VIOLATED");
      expect(unknown.diagnostics.join(" ")).toContain("NUCLEAR_FUSION");

      const session = requireSessionState("invalid-session");
      expect(queuedEnvelopes(runtime, "invalid-session", session.snapshot)).toEqual([]);
      expect(ukFieldPriorities(session)).toEqual(pristine);
    });

    it("AC-3: exact-technology selection is refused at issue with the engine code, session untouched", async () => {
      const saveDir = resolve(saveRoot, "exact-tech-1");
      registerProductionSession("exact-tech-session", saveDir);
      const pristine = ukFieldPriorities(requireSessionState("exact-tech-session"));

      const result = await setResearchPriorityCommand(
        priorityPayload("exact-tech-session", fullPriorities(), { exactTechId: "gunnery_rifled" }),
      );
      expect(result.outcome).toBe("rejected");
      if (result.outcome !== "rejected") return;
      expect(result.reason).toBe("EXACT_TECHNOLOGY_SELECTION_PROHIBITED");

      const session = requireSessionState("exact-tech-session");
      expect(queuedEnvelopes(runtime, "exact-tech-session", session.snapshot)).toEqual([]);
      expect(ukFieldPriorities(session)).toEqual(pristine);
    });

    it("AC-4: same transportRequestId replays the prior outcome; different payload under it conflicts", async () => {
      const saveDir = resolve(saveRoot, "idempotent-1");
      registerProductionSession("idempotent-session", saveDir);
      const priorities = fullPriorities();

      const first = await setResearchPriorityCommand(
        priorityPayload("idempotent-session", priorities, { transportRequestId: "req-1" }),
      );
      expect(first.outcome).toBe("success");

      const replayed = await setResearchPriorityCommand(
        priorityPayload("idempotent-session", priorities, { transportRequestId: "req-1" }),
      );
      expect(replayed.outcome).toBe("success");
      if (replayed.outcome !== "success") return;
      expect(replayed.value.commandId).toBe(
        first.outcome === "success" ? first.value.commandId : "",
      );

      const session = requireSessionState("idempotent-session");
      expect(queuedEnvelopes(runtime, "idempotent-session", session.snapshot)).toHaveLength(1);

      const conflicting = await setResearchPriorityCommand(
        priorityPayload(
          "idempotent-session",
          {
            ...fullPriorities(),
            GUNNERY: RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW,
            MACHINERY: RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH,
          },
          { transportRequestId: "req-1" },
        ),
      );
      expect(conflicting.outcome).toBe("rejected");
      if (conflicting.outcome !== "rejected") return;
      expect(conflicting.reason).toBe("IDEMPOTENCY_CONFLICT");
      expect(queuedEnvelopes(runtime, "idempotent-session", session.snapshot)).toHaveLength(1);
    });

    it("AC-4: stale expectedRevision returns REVISION_MISMATCH without touching the session or queue", async () => {
      const saveDir = resolve(saveRoot, "stale-1");
      registerProductionSession("stale-session", saveDir);

      const result = await setResearchPriorityCommand(
        priorityPayload("stale-session", fullPriorities(), { expectedRevision: 5 }),
      );
      expect(result.outcome).toBe("rejected");
      if (result.outcome !== "rejected") return;
      expect(result.reason).toBe("REVISION_MISMATCH");
      expect(result.currentRevision).toBe(0);

      const session = requireSessionState("stale-session");
      expect(Number(session.snapshot.turnNumber)).toBe(0);
      expect(queuedEnvelopes(runtime, "stale-session", session.snapshot)).toEqual([]);
    });

    it("a stale commitMonth leaves the queue intact; the retried commit delivers it", async () => {
      const saveDir = resolve(saveRoot, "stale-commit-1");
      registerProductionSession("stale-commit-session", saveDir);
      await setResearchPriorityCommand(priorityPayload("stale-commit-session", fullPriorities()));

      const stale = await commitMonth({
        sessionId: "stale-commit-session",
        expectedRevision: 9,
        transportRequestId: "commit-1",
      });
      expect(stale.outcome).toBe("rejected");
      if (stale.outcome !== "rejected") return;
      expect(stale.reason).toBe("REVISION_MISMATCH");

      const session = requireSessionState("stale-commit-session");
      expect(queuedEnvelopes(runtime, "stale-commit-session", session.snapshot)).toHaveLength(1);

      const good = await commitMonth({
        sessionId: "stale-commit-session",
        expectedRevision: 0,
        transportRequestId: "commit-2",
      });
      expect(good.outcome).toBe("success");
    });
  });

  describe("determinism (AC-5)", () => {
    it("two identical sessions produce identical envelopes and identical final snapshot hashes", async () => {
      const saveDirA = resolve(saveRoot, "det-a");
      const saveDirB = resolve(saveRoot, "det-b");
      registerProductionSession("det-a", saveDirA);
      registerProductionSession("det-b", saveDirB);
      const priorities = fullPriorities();

      const issuedA = await setResearchPriorityCommand(priorityPayload("det-a", priorities));
      const issuedB = await setResearchPriorityCommand(priorityPayload("det-b", priorities));
      expect(issuedA.outcome).toBe("success");
      expect(issuedB.outcome).toBe("success");
      if (issuedA.outcome !== "success" || issuedB.outcome !== "success") return;

      expect(issuedA.value.commandId).toBe(issuedB.value.commandId);
      expect(issuedA.value.priorities).toEqual(issuedB.value.priorities);

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
      expect(ukFieldPriorities(requireSessionState("det-a"))).toEqual(
        ukFieldPriorities(requireSessionState("det-b")),
      );
    });

    it("two OS child processes produce byte-identical output (issue + commitMonth)", () => {
      const childPath = resolve(
        __dirname,
        "../../../dist",
        "main",
        "commands",
        "researchDeterminismChild.js",
      );
      expect(existsSync(childPath)).toBe(true);
      const run = () =>
        execFileSync(process.execPath, [childPath], { encoding: "utf8", timeout: 60000 });
      const first = run();
      const second = run();
      expect(first.trim()).toBe(second.trim());
      expect(first.trim().split("\n")).toHaveLength(2);
    });
  });

  describe("issue-to-commit interplay", () => {
    it("refreshes the queued envelope hash when a construction command persists an intervening snapshot", async () => {
      const saveDir = resolve(saveRoot, "interleave-1");
      registerProductionSession("interleave-session", saveDir);
      await setResearchPriorityCommand(priorityPayload("interleave-session", fullPriorities()));

      const built = getCampaignSession("interleave-session");
      if (!built) throw new Error("session missing");
      const designId = [...built.state.snapshot.designs.values()]
        .filter((d) => d.nationId === "uk")
        .map((d) => d.designVersionId)
        .sort()[0]!;

      const construction = await submitConstructionCommand({
        sessionId: "interleave-session",
        expectedRevision: 0,
        transportRequestId: "build-1",
        designId,
      });
      expect(construction.outcome).toBe("success");

      const after = requireSessionState("interleave-session");
      const [envelope] = queuedEnvelopes(runtime, "interleave-session", after.snapshot);
      expect(envelope).toBeDefined();
      if (!envelope) return;
      expect(envelope.expectedSnapshotHash).toBe(sha256Hex(canonicalSerialize(after.snapshot)));

      const committed = await commitMonth({
        sessionId: "interleave-session",
        expectedRevision: 0,
        transportRequestId: "commit-1",
      });
      expect(committed.outcome).toBe("success");
      expect(ukFieldPriorities(requireSessionState("interleave-session"))).toEqual(
        fullPriorities(),
      );
    });
  });
});
