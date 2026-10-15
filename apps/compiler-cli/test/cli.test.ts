import { describe, it, expect } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { CommandEnvelope, BudgetProjectCommand } from "@bluewave/commands";
import { CommandLedger } from "@bluewave/commands";
import { MonthExecutor, ReplayVerifier } from "@bluewave/phase-engine";

function createSnapshot(): CampaignSnapshot {
  const nations = new Map<string, NationState>();
  nations.set("GBR", {
    id: "GBR",
    name: "United Kingdom",
    tag: "GBR",
    treasury: SafeInt(500),
    income: SafeInt(150),
    expenses: SafeInt(50),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(0),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [{ techId: "basic_steam", investedPoints: SafeInt(30), completed: false }],
      currentProjectTechId: "basic_steam",
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [
      {
        id: "proj-1",
        type: "ship",
        projectType: "NEW_CONSTRUCTION",
        targetId: "ship-1",
        designVersionId: "design-1",
        totalWork: SafeInt(200),
        completedWork: SafeInt(50),
        paidWork: SafeInt(0),
        status: "ACTIVE",
        startedAt: "1880-01",
      },
    ],
    isPlayable: true,
    isAI: false,
  });
  return {
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "replay-test",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations,
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
  };
}

function makeBudgetCommand(
  nationId: string,
  projectId: string,
  budget: SafeInt,
  snapshot: CampaignSnapshot,
): CommandEnvelope<BudgetProjectCommand> {
  const hash = sha256Hex(canonicalSerialize(snapshot));
  return {
    commandId: `cmd-${projectId}-${String(budget)}`,
    version: "0.1.0",
    expectedSnapshotHash: hash,
    idempotencyKey: `ik-${projectId}-${String(budget)}`,
    timestamp: "test",
    body: { type: "budget_project", nationId, projectId, budget },
  };
}

function cloneLedger(original: CommandLedger): CommandLedger {
  const clone = new CommandLedger();
  for (const outcome of original.all) {
    clone.add(outcome);
  }
  return clone;
}

function hashSnapshot(snapshot: CampaignSnapshot): string {
  const nations: Record<string, NationState> = {};
  for (const [id, nation] of snapshot.nations) {
    nations[id] = nation;
  }
  const wars = {
    wars: snapshot.wars.wars.map((w) => ({ ...w })),
    battles: snapshot.wars.battles.map((b) => ({ ...b })),
    participantMemberships: snapshot.wars.participantMemberships.map((m) => ({ ...m })),
    blockadeState: snapshot.wars.blockadeState.map((b) => ({ ...b })),
    battleManifests: (snapshot.wars.battleManifests ?? []).map((m) => ({ ...m })),
  };
  const hashable = {
    version: snapshot.version,
    turnNumber: snapshot.turnNumber,
    campaignId: snapshot.campaignId,
    // B-6/ADR-0025: start date + per-area weather are part of the
    // authoritative snapshot surface (parity with ReplayVerifier's subset).
    startYear: snapshot.startYear,
    startMonth: snapshot.startMonth,
    strategicWeather: (snapshot.strategicWeather ?? []).map((s) => ({ ...s })),
    slots: snapshot.slots.map((s) => ({ ...s })),
    world: {
      areas: snapshot.world.areas.map((a) => ({ ...a })),
      routes: snapshot.world.routes.map((r) => ({ ...r })),
      ports: snapshot.world.ports.map((p) => ({ ...p })),
    },
    nations,
    wars,
    politics: {
      relations: snapshot.politics.relations.map((r) => ({ ...r })),
      shells: { ...snapshot.politics.shells },
    },
    intelligence: {
      shells: { ...snapshot.intelligence.shells },
    },
    rulesetVersion: snapshot.rulesetVersion,
    compatibilityVersion: snapshot.compatibilityVersion,
  };
  return sha256Hex(canonicalSerialize(hashable));
}

describe("ReplayVerifier", () => {
  it("replay with same snapshot and commands matches", () => {
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);
    const executor = new MonthExecutor();
    const result = executor.execute(snapshot, [cmd], "test-seed", collector);
    const originalLedger = cloneLedger(result.commandLedger);
    const expectedFinalHash = hashSnapshot(result.finalSnapshot);
    const verifier = new ReplayVerifier();
    const replayResult = verifier.verify(
      snapshot,
      [cmd],
      originalLedger,
      expectedFinalHash,
      "test-seed",
      new DiagnosticCollector(),
    );
    expect(replayResult.match).toBe(true);
    expect(replayResult.mismatches.length).toBe(0);
    expect(replayResult.steps.length).toBeGreaterThan(0);
    expect(replayResult.steps.every((s) => s.match)).toBe(true);
  });
  it("replay with wrong command detects mismatch", () => {
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const cmd100 = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);
    const cmd200 = makeBudgetCommand("GBR", "proj-1", SafeInt(200), snapshot);
    const executor = new MonthExecutor();
    const result = executor.execute(snapshot, [cmd100], "test-seed", collector);
    const originalLedger = cloneLedger(result.commandLedger);
    const expectedFinalHash = hashSnapshot(result.finalSnapshot);
    const verifier = new ReplayVerifier();
    const replayResult = verifier.verify(
      snapshot,
      [cmd200],
      originalLedger,
      expectedFinalHash,
      "test-seed",
      new DiagnosticCollector(),
    );
    expect(replayResult.match).toBe(false);
    expect(replayResult.mismatches.length).toBeGreaterThan(0);
  });
  it("replay detects step-level hash mismatches with different initial state", () => {
    const snapshot = createSnapshot();
    const collector = new DiagnosticCollector();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);
    const executor = new MonthExecutor();
    const result = executor.execute(snapshot, [cmd], "test-seed", collector);
    const originalLedger = cloneLedger(result.commandLedger);
    const expectedFinalHash = hashSnapshot(result.finalSnapshot);
    const wrongSnapshot = createSnapshot();
    const gbr = wrongSnapshot.nations.get("GBR")!;
    gbr.treasury = SafeInt(999);
    const verifier = new ReplayVerifier();
    const replayResult = verifier.verify(
      wrongSnapshot,
      [cmd],
      originalLedger,
      expectedFinalHash,
      "test-seed",
      new DiagnosticCollector(),
    );
    expect(replayResult.match).toBe(false);
    expect(replayResult.mismatches.length).toBeGreaterThan(0);
    for (const m of replayResult.mismatches) {
      expect(m.expectedHash).not.toBe(m.actualHash);
      expect(m.diagnostic.length).toBeGreaterThan(0);
    }
  });
  it("replay with no commands matches trivially", () => {
    const snapshot = createSnapshot();
    const emptyLedger = new CommandLedger();
    const executor = new MonthExecutor();
    const result = executor.execute(snapshot, [], "test-seed", new DiagnosticCollector());
    const finalHash = hashSnapshot(result.finalSnapshot);
    const verifier = new ReplayVerifier();
    const replayResult = verifier.verify(
      snapshot,
      [],
      emptyLedger,
      finalHash,
      "test-seed",
      new DiagnosticCollector(),
    );
    expect(replayResult.match).toBe(true);
    expect(replayResult.mismatches.length).toBe(0);
  });
  it("replay preserves determinism across multiple calls", () => {
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snapshot);
    const executor = new MonthExecutor();
    const result = executor.execute(
      snapshot,
      [cmd],
      "deterministic-seed",
      new DiagnosticCollector(),
    );
    const originalLedger = cloneLedger(result.commandLedger);
    const expectedFinalHash = hashSnapshot(result.finalSnapshot);
    const verifier = new ReplayVerifier();
    const r1 = verifier.verify(
      snapshot,
      [cmd],
      originalLedger,
      expectedFinalHash,
      "deterministic-seed",
      new DiagnosticCollector(),
    );
    const r2 = verifier.verify(
      snapshot,
      [cmd],
      originalLedger,
      expectedFinalHash,
      "deterministic-seed",
      new DiagnosticCollector(),
    );
    expect(r1.replayedFinalHash).toBe(r2.replayedFinalHash);
    expect(r1.match).toBe(r2.match);
  });
  it("wrong seed still matches for budget_project (no RNG)", () => {
    const snap = createSnapshot();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snap);
    const res = new MonthExecutor().execute(snap, [cmd], "seed-A", new DiagnosticCollector());
    const verify = new ReplayVerifier().verify(
      snap,
      [cmd],
      cloneLedger(res.commandLedger),
      hashSnapshot(res.finalSnapshot),
      "seed-B",
      new DiagnosticCollector(),
    );
    expect(verify.match).toBe(true);
  });
  it("ledger hash must match", () => {
    const snap = createSnapshot();
    const cmd = makeBudgetCommand("GBR", "proj-1", SafeInt(100), snap);
    const res = new MonthExecutor().execute(snap, [cmd], "s", new DiagnosticCollector());
    const badLedger = new CommandLedger();
    const v = new ReplayVerifier().verify(
      snap,
      [cmd],
      badLedger,
      hashSnapshot(res.finalSnapshot),
      "s",
      new DiagnosticCollector(),
    );
    expect(v.match).toBe(false);
  });
});
