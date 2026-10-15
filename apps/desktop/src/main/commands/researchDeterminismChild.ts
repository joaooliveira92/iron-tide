import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/campaign-engine";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { SaveStore } from "@bluewave/persistence";
import { ManagedRuntime } from "effect";
import { registerCampaignSession } from "../campaignSessions.js";
import { compileProductionCampaignFromArtifact } from "../compiler.js";
import { resolveGeneratedContentDir } from "../contentPack.js";
import { clearResearchWorkspacesForTest } from "../researchWorkspace.js";
import { projectCommandExit } from "../runtime/bridgeResult.js";
import { desktopMainLayer } from "../runtime/desktopMainLayer.js";
import { toSaveableState } from "../saveHelpers.js";
import { commitMonthProgram } from "./commitMonth.js";
import { setResearchPriorityCommandProgram } from "./researchCommands.js";

/**
 * Determinism child for the research-command path (desktop-engine-feature-gate
 * INC-2, AC-5): a plain-Node process (no Electron, no vitest, no env/locale/
 * clock reads) that compiles the production pack, issues a real
 * `SetResearchPriorityCommand`, commits one month through the real
 * `MonthExecutor`, verifies the engine applied the priorities (so a no-op
 * would fail loudly), and prints TWO stable hashes on stdout:
 *
 *   `rawHash`     — the persisted state's envelope+SHA-256 from `SaveStore`
 *   `serialized`  — `sha256Hex(canonicalSerialize(snapshot))`
 *
 * The orchestrator test runs this file twice (spawned processes) and requires
 * byte-identical output — proving the desktop slice adds no ambient
 * determinism leak to an already cross-process-proven authoritative chain.
 */

function fullPriorities(): Record<string, number> {
  const all: Record<string, number> = {};
  for (const field of CANONICAL_RESEARCH_FIELD_IDS)
    all[field] = RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW;
  all.GUNNERY = RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH;
  all.MACHINERY = RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM;
  all.HULL_CONSTRUCTION = RESEARCH_FIELD_PRIORITY_WEIGHTS.MEDIUM;
  return all;
}

function applyKey(record: Record<string, number>): string {
  return Object.entries(record)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([field, weight]) => `${field}=${String(weight)}`)
    .join(",");
}

async function run(): Promise<void> {
  const saveDir = mkdtempSync(resolve(tmpdir(), "bw-research-det-child-"));
  const runtime = ManagedRuntime.make(desktopMainLayer());
  try {
    const signal = new AbortController().signal;
    const collector = new DiagnosticCollector();
    const output = compileProductionCampaignFromArtifact(
      resolveGeneratedContentDir(),
      signal,
      collector,
    );
    if (!output || collector.hasErrors) {
      throw new Error(`compile failed: ${collector.errors.map((d) => d.message).join("; ")}`);
    }
    const state = toSaveableState(output.state);
    new SaveStore().save(state, saveDir);
    registerCampaignSession({
      sessionId: "child-session",
      saveDir,
      playerSlotId: "uk",
      campaignSeed: "a".repeat(32),
      month: { month: 1, year: 1880 },
      state,
    });

    const issued = projectCommandExit(
      await runtime.runPromiseExit(
        setResearchPriorityCommandProgram({
          sessionId: "child-session",
          expectedRevision: 0,
          transportRequestId: "req-1",
          fieldPriorities: fullPriorities(),
        }),
      ),
    );
    if (issued.outcome !== "success") throw new Error(`issue failed: ${issued.reason}`);

    const committed = projectCommandExit(
      await runtime.runPromiseExit(
        commitMonthProgram({
          sessionId: "child-session",
          expectedRevision: 0,
          transportRequestId: "commit-1",
        }),
      ),
    );
    if (committed.outcome !== "success") {
      throw new Error(`commit failed: ${committed.reason}: ${committed.diagnostics.join("; ")}`);
    }

    const post = new SaveStore().load(saveDir, new DiagnosticCollector());
    if (!post) throw new Error("load failed after commit");
    const applied = post.snapshot.nations.get("uk")!.research.fieldPriorities;
    if (applyKey(Object.fromEntries(Object.entries(applied))) !== applyKey(fullPriorities())) {
      throw new Error("engine did not apply the queued priorities");
    }

    const serialized = sha256Hex(canonicalSerialize(post.snapshot));
    process.stdout.write(`${post.rawHash}\n${serialized}\n`);
  } finally {
    await runtime.dispose();
    clearResearchWorkspacesForTest();
    rmSync(saveDir, { recursive: true, force: true });
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    process.stderr.write(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
