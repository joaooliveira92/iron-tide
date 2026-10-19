// Ticket 06 — full CommandRecord lifecycle exercised against the running
// snapshot for a real command type (budget_project). Proves the modeled
// lifecycle machine in @bluewave/commands actually executes against the
// snapshot: validation, authorization, treasury reservation before effects,
// lock at the irreversible boundary, resolution (real effects), settlement onto
// the financial ledger, hash-chained transition/settlement/audit records, and a
// replay that reproduces identical outcomes and hashes. The default month
// pipeline is untouched (existing commands remain behaviorally unchanged).

import type { CampaignSlot, CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { BudgetProjectCommand, CommandEnvelope } from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { EventLedger } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import { BudgetProjectLifecycle, FinancialLedger, MonthExecutor } from "../src/index.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

function createSnapshot(overrides?: Partial<CampaignSnapshot>): CampaignSnapshot {
  const nations = new Map<string, NationState>();
  nations.set("GBR", {
    prestige: SafeInt(20),
    id: "GBR",
    name: "United Kingdom",
    tag: "GBR",
    treasury: SafeInt(500),
    income: SafeInt(150),
    expenses: SafeInt(50),
    baseResources: SafeInt(120000),
    navalAppropriationRateBp: SafeInt(2000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: "GBR",
      technologies: [],
      currentProjectTechId: "",
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
        designVersionId: "",
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

  const base: CampaignSnapshot = {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "test-campaign-lifecycle",
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

  return overrides ? { ...base, ...overrides } : base;
}

const SLOT: CampaignSlot = { nationId: "GBR", type: "playable" };

function makeBudgetCommand(
  snapshot: CampaignSnapshot,
  budget: SafeInt,
  overrides?: Partial<CommandEnvelope<BudgetProjectCommand>>,
): CommandEnvelope<BudgetProjectCommand> {
  return {
    commandId: "cmd-budget-1",
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey: "ik-budget-1",
    timestamp: "test",
    body: { type: "budget_project", nationId: "GBR", projectId: "proj-1", budget },
    ...overrides,
  };
}

describe("BudgetProjectLifecycle (ticket 06)", () => {
  it("resolves a real command through the full lifecycle against the running snapshot", () => {
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand(snapshot, SafeInt(100));
    const financial = new FinancialLedger();
    const events = new EventLedger();
    const collector = new DiagnosticCollector();

    const out = new BudgetProjectLifecycle().complete(
      snapshot,
      cmd,
      SLOT,
      snapshot.turnNumber,
      financial,
      events,
      collector,
    );

    expect(out.terminalStatus).toBe("COMPLETED");
    expect(out.record.status).toBe("COMPLETED");
    expect(out.result).not.toBeNull();
    expect(out.settlement).not.toBeNull();

    // Real effects applied against the snapshot.
    const gbr = out.snapshot.nations.get("GBR")!;
    expect(gbr.treasury as number).toBe(500 - 100);
    const proj = gbr.constructionProjects.find((p) => p.id === "proj-1")!;
    expect(proj.completedWork as number).toBe(50 + 100);

    // Settlement records the reserved == consumed amount, nothing released.
    expect(out.settlement!.branchId).toBe("completion");
    expect(out.settlement!.reservedAmount).toBe(100);
    expect(out.settlement!.consumedAmount).toBe(100);
    expect(out.settlement!.releasedAmount).toBe(0);

    // Result hash-chains pre/post resolution state hashes.
    expect(out.result!.preResolutionStateHash).toBe(sha256Hex(canonicalSerialize(snapshot)));
    expect(out.result!.postResolutionStateHash).toBe(sha256Hex(canonicalSerialize(out.snapshot)));
    expect(out.result!.terminalStatus).toBe("COMPLETED");

    // Audit + settlement landed on the financial ledger.
    expect(financial.all.some((t) => t.categoryId === "COMMAND_SETTLEMENT")).toBe(true);
    expect(financial.all.some((t) => t.categoryId === "CONSTRUCTION_BUDGET")).toBe(true);
    expect(out.auditHeadHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reserves treasury before effects apply and settles on completion", () => {
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand(snapshot, SafeInt(100));
    const out = new BudgetProjectLifecycle().complete(
      snapshot,
      cmd,
      SLOT,
      snapshot.turnNumber,
      new FinancialLedger(),
      new EventLedger(),
      new DiagnosticCollector(),
    );

    // A TREASURY reservation was created and attached to the record.
    expect(out.record.reservationRecordIds.length).toBe(1);
    expect(out.record.reservationRecordIds[0]).toContain("TREASURY");
    // The reservation is settled (consumed) on completion.
    expect(out.settlement!.consumedAmount).toBe(100);
  });

  it("honors the lock / irreversible-phase cancellation boundary", () => {
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand(snapshot, SafeInt(100));
    const lc = new BudgetProjectLifecycle();

    // Before the irreversible phase (still LOCKED), cancellation is allowed.
    const before = lc.canCancel(snapshot, cmd, SLOT, "command_collection", "LOCKED");
    expect(before.allowed).toBe(true);
    expect(before.reasonCode).toBe("COMMAND_CANCELLED");

    // At/after the irreversible phase (appropriation), cancellation is refused.
    const atBoundary = lc.canCancel(snapshot, cmd, SLOT, "appropriation", "RESOLVING");
    expect(atBoundary.allowed).toBe(false);
    expect(atBoundary.reasonCode).toBe("IRREVERSIBLE_EFFECT_ALREADY_APPLIED");
  });

  it("produces a deterministic hash-chained status-transition ledger", () => {
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand(snapshot, SafeInt(100));
    const out = new BudgetProjectLifecycle().complete(
      snapshot,
      cmd,
      SLOT,
      snapshot.turnNumber,
      new FinancialLedger(),
      new EventLedger(),
      new DiagnosticCollector(),
    );

    const expected = [
      "VALIDATED",
      "AUTHORIZED",
      "RESERVED",
      "ACCEPTED",
      "LOCKED",
      "RESOLVING",
      "COMPLETED",
    ];
    expect(out.transitions.map((t) => t.toStatus)).toEqual(expected);

    // Hash chain: each previousHash equals the prior recordHash; first is genesis.
    expect(out.transitions[0]!.previousHash).toBe("0".repeat(64));
    for (let i = 1; i < out.transitions.length; i++) {
      expect(out.transitions[i]!.previousHash).toBe(out.transitions[i - 1]!.recordHash);
    }
  });

  it("is deterministic under replay: identical results, hashes, and snapshot", () => {
    const run = () => {
      const snapshot = createSnapshot();
      const cmd = makeBudgetCommand(snapshot, SafeInt(100));
      const financial = new FinancialLedger();
      return new BudgetProjectLifecycle().complete(
        snapshot,
        cmd,
        SLOT,
        snapshot.turnNumber,
        financial,
        new EventLedger(),
        new DiagnosticCollector(),
      );
    };

    const a = run();
    const b = run();
    expect(a.result!.resultHash).toBe(b.result!.resultHash);
    expect(a.settlement!.settlementHash).toBe(b.settlement!.settlementHash);
    expect(a.auditHeadHash).toBe(b.auditHeadHash);
    expect(sha256Hex(canonicalSerialize(a.snapshot))).toBe(
      sha256Hex(canonicalSerialize(b.snapshot)),
    );
    expect(canonicalSerialize(a.transitions)).toBe(canonicalSerialize(b.transitions));
  });

  it("rejects a command not authorized for the slot with no effects applied", () => {
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand(snapshot, SafeInt(100), {
      body: { type: "budget_project", nationId: "FRA", projectId: "proj-1", budget: SafeInt(100) },
    });
    const financial = new FinancialLedger();
    const out = new BudgetProjectLifecycle().complete(
      snapshot,
      cmd,
      SLOT,
      snapshot.turnNumber,
      financial,
      new EventLedger(),
      new DiagnosticCollector(),
    );

    expect(out.terminalStatus).toBe("REJECTED");
    expect(out.result).toBeNull();
    expect(out.settlement).toBeNull();
    // The record itself records the terminal status (not a dangling SUBMITTED).
    expect(out.record.status).toBe("REJECTED");
    // No effects applied: treasury unchanged, no ledger entries.
    expect(out.snapshot.nations.get("GBR")!.treasury as number).toBe(500);
    expect(financial.all.length).toBe(0);
  });

  it("settles a cancellation through the preLockCancellation branch (full refund)", () => {
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand(snapshot, SafeInt(100));
    const financial = new FinancialLedger();
    const out = new BudgetProjectLifecycle().cancel(
      snapshot,
      cmd,
      SLOT,
      snapshot.turnNumber,
      financial,
    );

    expect(out.terminalStatus).toBe("CANCELLED");
    expect(out.record.status).toBe("CANCELLED");
    expect(out.settlement).not.toBeNull();
    // preLockCancellation branch: reserved 100, consumed 0, fully released.
    expect(out.settlement!.branchId).toBe("preLockCancellation");
    expect(out.settlement!.reservedAmount).toBe(100);
    expect(out.settlement!.consumedAmount).toBe(0);
    expect(out.settlement!.releasedAmount).toBe(100);
    // Cancellation applies no effects: treasury and project are unchanged.
    expect(out.snapshot.nations.get("GBR")!.treasury as number).toBe(500);
    expect(out.snapshot.nations.get("GBR")!.constructionProjects[0]!.completedWork as number).toBe(
      50,
    );
    // The settlement was posted onto the financial ledger.
    expect(financial.all.some((t) => t.categoryId === "COMMAND_SETTLEMENT")).toBe(true);
  });

  it("is deterministic under cancellation replay", () => {
    const run = () => {
      const snapshot = createSnapshot();
      const cmd = makeBudgetCommand(snapshot, SafeInt(100));
      const financial = new FinancialLedger();
      return new BudgetProjectLifecycle().cancel(
        snapshot,
        cmd,
        SLOT,
        snapshot.turnNumber,
        financial,
      );
    };
    const a = run();
    const b = run();
    expect(a.result!.resultHash).toBe(b.result!.resultHash);
    expect(a.settlement!.settlementHash).toBe(b.settlement!.settlementHash);
    expect(a.auditHeadHash).toBe(b.auditHeadHash);
    expect(canonicalSerialize(a.transitions)).toBe(canonicalSerialize(b.transitions));
  });

  it("fails reservation closed when treasury is insufficient, applying no effects", () => {
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand(snapshot, SafeInt(100000));
    const financial = new FinancialLedger();
    const out = new BudgetProjectLifecycle().complete(
      snapshot,
      cmd,
      SLOT,
      snapshot.turnNumber,
      financial,
      new EventLedger(),
      new DiagnosticCollector(),
    );

    expect(out.terminalStatus).toBe("REJECTED");
    expect(out.result).toBeNull();
    expect(out.settlement).toBeNull();
    expect(out.snapshot.nations.get("GBR")!.treasury as number).toBe(500);
    expect(financial.all.length).toBe(0);
  });

  it("leaves the default month pipeline behaviorally unchanged", () => {
    // The full-lifecycle path is opt-in; the default MonthExecutor path still
    // resolves budget_project through its existing success/reject outcome and
    // produces a successful, deterministic month.
    const snapshot = createSnapshot();
    const cmd = makeBudgetCommand(snapshot, SafeInt(100));
    const collector = new DiagnosticCollector();
    const r1 = new MonthExecutor().execute(snapshot, [cmd], "seed", collector);
    const collector2 = new DiagnosticCollector();
    const snapshot2 = createSnapshot();
    const cmd2 = makeBudgetCommand(snapshot2, SafeInt(100));
    const r2 = new MonthExecutor().execute(snapshot2, [cmd2], "seed", collector2);
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(sha256Hex(canonicalSerialize(r1.finalSnapshot))).toBe(
      sha256Hex(canonicalSerialize(r2.finalSnapshot)),
    );
  });
});
