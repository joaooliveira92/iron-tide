import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  makeRecordedInput,
  type DecisionAnswer,
  type DecisionRequest,
  type PendingDecision,
  type RecordedInput,
  type BattleRequest,
  type BattleResultInput,
} from "@bluewave/messages";
import { describe, expect, it } from "vite-plus/test";
import {
  unifiedSnapshotHash,
  MonthExecutor,
  monthPipeline,
  ReplayVerifier,
  type InterruptionChannel,
} from "../src/index.js";
import {
  ATTACKER_NATION,
  DEFENDER_NATION,
  makeBattle,
  makeBattleSnapshot,
} from "./battle-fixtures.js";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";

function createSnapshot(): CampaignSnapshot {
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
      technologies: [{ techId: "basic_steam", investedPoints: SafeInt(30), completed: false }],
      currentProjectTechId: "basic_steam",
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: true,
    isAI: false,
  });

  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "interruption-seam-test",
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

const pendingDecision: PendingDecision = {
  phase: "appropriation",
  subjectKey: "GBR",
  decisionId: "dec-1",
  titleKey: "messages.decision.title",
  bodyKey: "messages.decision.body",
  interpolation: {},
  options: [
    {
      optionId: "approve",
      titleKey: "messages.decision.approve.title",
      bodyKey: "messages.decision.approve.body",
      hints: [],
      effects: [{ nationId: "GBR", attribute: "treasury", delta: -50 }],
    },
    {
      optionId: "decline",
      titleKey: "messages.decision.decline.title",
      bodyKey: "messages.decision.decline.body",
      hints: [],
      effects: [],
    },
  ],
};

function run(snapshot: CampaignSnapshot, channel?: InterruptionChannel) {
  const executor = new MonthExecutor();
  const collector = new DiagnosticCollector();
  const engineOptions = channel === undefined ? undefined : { interruptions: channel };
  return executor.execute(snapshot, [], "seam-seed", collector, undefined, engineOptions);
}

function answerFor(request: DecisionRequest, optionId: string): RecordedInput {
  const payload: DecisionAnswer = {
    interruptionId: request.interruptionId,
    decisionId: request.decisionId,
    optionId,
  };
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "decision",
    interruptionId: request.interruptionId,
    payload,
  });
}

function resultFor(request: BattleRequest): RecordedInput {
  const payload: BattleResultInput = {
    interruptionId: request.interruptionId,
    battleId: request.battleId,
    winnerId: ATTACKER_NATION,
    loserId: DEFENDER_NATION,
    attackerLosses: [],
    defenderLosses: [],
    damageReport: {},
  };
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "battle",
    interruptionId: request.interruptionId,
    payload,
  });
}

describe("month interruption seam", () => {
  it("is byte-identical to today when no interruptions are supplied", () => {
    const snapshot = createSnapshot();
    const withoutChannel = run(snapshot);
    const withEmptyChannel = run(snapshot, { turnId: "t-1", recordedInputs: [] });
    expect(withEmptyChannel.outcome).toBe("completed");
    expect(unifiedSnapshotHash(withEmptyChannel.finalSnapshot)).toBe(
      unifiedSnapshotHash(withoutChannel.finalSnapshot),
    );
  });

  it("suspends for a decision when no input is recorded, then resumes exactly once", () => {
    const snapshot = createSnapshot();
    const pending = { turnId: "t-1", recordedInputs: [], pendingDecisions: [pendingDecision] };
    const suspended = run(snapshot, pending);
    expect(suspended.success).toBe(true);
    expect(suspended.outcome).toBe("suspended");
    expect(suspended.suspended?.reason).toBe("awaiting-input");
    const request = suspended.suspended?.request;
    expect(request?.kind).toBe("decision");
    if (request?.kind !== "decision") return;

    const recorded = answerFor(request, "approve");
    const channel: InterruptionChannel = {
      turnId: "t-1",
      recordedInputs: [recorded],
      pendingDecisions: [pendingDecision],
    };
    const resumed = run(snapshot, channel);
    expect(resumed.outcome).toBe("completed");
    const gbr = resumed.finalSnapshot.nations.get("GBR");
    const control = run(snapshot);
    const controlGbr = control.finalSnapshot.nations.get("GBR");
    expect(Number(gbr?.treasury)).toBe(Number(controlGbr?.treasury) - 50);
  });

  it("re-executing from the same snapshot and inputs is bit-identical", () => {
    const snapshot = createSnapshot();
    const pending = { turnId: "t-1", recordedInputs: [], pendingDecisions: [pendingDecision] };
    const request = run(snapshot, pending).suspended?.request;
    if (request?.kind !== "decision") throw new Error("expected a decision request");
    const channel: InterruptionChannel = {
      turnId: "t-1",
      recordedInputs: [answerFor(request, "approve")],
      pendingDecisions: [pendingDecision],
    };
    const first = run(snapshot, channel);
    const second = run(snapshot, channel);
    expect(unifiedSnapshotHash(first.finalSnapshot)).toBe(
      unifiedSnapshotHash(second.finalSnapshot),
    );
  });

  it("suspends with an error on a hash-mismatched input", () => {
    const snapshot = createSnapshot();
    const pending = { turnId: "t-1", recordedInputs: [], pendingDecisions: [pendingDecision] };
    const request = run(snapshot, pending).suspended?.request;
    if (request?.kind !== "decision") throw new Error("expected a decision request");
    const good = answerFor(request, "approve");
    const bad: RecordedInput = { ...good, interruptionId: "tampered" };
    const resumed = run(snapshot, {
      turnId: "t-1",
      recordedInputs: [bad],
      pendingDecisions: [pendingDecision],
    });
    expect(resumed.outcome).toBe("suspended");
    expect(resumed.suspended?.reason).toBe("invalid-input");
  });

  it("suspends with an error on an extra trailing input", () => {
    const snapshot = createSnapshot();
    const orphan = makeRecordedInput({
      ordinal: 0,
      kind: "decision",
      interruptionId: "orphan",
      payload: { interruptionId: "orphan", decisionId: "dec-1", optionId: "approve" },
    });
    const resumed = run(snapshot, { turnId: "t-1", recordedInputs: [orphan] });
    expect(resumed.outcome).toBe("suspended");
    expect(resumed.suspended?.reason).toBe("invalid-input");
  });

  it("applies a recorded battle result exactly once and never re-rolls", () => {
    const snapshot = makeBattleSnapshot({ wars: [], battles: [makeBattle()] });
    const pending = run(snapshot, { turnId: "t-1", recordedInputs: [] });
    expect(pending.outcome).toBe("suspended");
    const request = pending.suspended?.request;
    expect(request?.kind).toBe("battle");
    if (request?.kind !== "battle") return;

    const channel: InterruptionChannel = {
      turnId: "t-1",
      recordedInputs: [resultFor(request)],
    };
    const resumed = run(snapshot, channel);
    expect(resumed.outcome).toBe("completed");
    const battle = resumed.finalSnapshot.wars.battles.find((b) => b.id === "battle-1");
    expect(battle?.phase).toBe("resolved");
    expect(battle?.result?.winnerId).toBe(ATTACKER_NATION);
    expect(battle?.result?.explanation).toEqual(["player-resolved"]);

    const replayed = new ReplayVerifier().verify(
      snapshot,
      [],
      resumed.commandLedger,
      unifiedSnapshotHash(resumed.finalSnapshot),
      "seam-seed",
      new DiagnosticCollector(),
      { interruptions: channel },
    );
    expect(replayed.match).toBe(true);
  });

  it("runs interruptions through a checkpoint rather than a phase", () => {
    expect(monthPipeline.phaseIds.some((id) => id.includes("interruption"))).toBe(false);
    const nodes = monthPipeline.nodes;
    const index = nodes.findIndex((node) => node.id === "interruption_checkpoint");
    expect(nodes[index]?.kind).toBe("checkpoint");
    expect(nodes[index - 1]?.id).toBe("resolve_carrier_operations");
    expect(nodes[index + 1]?.id).toBe("battle_generation");
  });

  it("suspend() never repurposes the success flag", () => {
    const snapshot = createSnapshot();
    const result = run(snapshot, {
      turnId: "t-1",
      recordedInputs: [],
      pendingDecisions: [pendingDecision],
    });
    expect(result.success).toBe(true);
    expect(result.outcome).toBe("suspended");
  });
});
