import type { CampaignSnapshot, DiplomaticRelation, NationState } from "@bluewave/campaign";
import type { EventResolutionRules, GameEvent } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  computeOrderedInputsHash,
  computeTurnId,
  makeRecordedInput,
  type DecisionRequest,
  type RecordedInput,
} from "@bluewave/messages";
import { FIXTURE_PRESTIGE_RULES } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import {
  dilemmaHints,
  MonthExecutor,
  ReplayVerifier,
  unifiedSnapshotHash,
  type EventEngineContent,
  type InterruptionChannel,
} from "../src/index.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET" as const,
  confidence: "LOW" as const,
  kind: "balance_adjustment" as const,
  sources: [],
};

const RULES: EventResolutionRules = {
  sectionVersion: 1,
  defaultAnswerAfterMonths: 3,
  aiStanceWeightsBp: {
    liberal_democracy: { hawkBp: 0, doveBp: 10_000, neutralBp: 0 },
    limited_democracy: { hawkBp: 5_000, doveBp: 5_000, neutralBp: 0 },
    autocratic: { hawkBp: 10_000, doveBp: 0, neutralBp: 0 },
    fascist: { hawkBp: 10_000, doveBp: 0, neutralBp: 0 },
    communist: { hawkBp: 5_000, doveBp: 5_000, neutralBp: 0 },
    eastern: { hawkBp: 5_000, doveBp: 5_000, neutralBp: 0 },
  },
  traitShifts: [],
  answerEffects: {
    budgetDecayMonths: 12,
    budgetStackCapBp: 1_000,
    tensionJumpCap: 3,
    traitEffects: [],
  },
  provenance,
};

const BORDER_INCIDENT: GameEvent = {
  id: "border_incident",
  titleKey: "event.border_incident.title",
  bodyKey: "event.border_incident.body",
  gates: {},
  weightBp: 10_000,
  cooldownMonths: 24,
  once: false,
  defaultAnswerId: "protest",
  answers: [
    {
      id: "mobilise",
      stance: "hawk",
      labelKey: "event.border_incident.mobilise",
      effects: {
        budgetBp: 600,
        unrest: 1,
        prestige: { kind: "FIXED_GAIN", amount: 5, reasonCode: "MOBILISED" },
        tension: { counterpart: "highest_tension_rival", delta: 2 },
        setFlag: "mobilised",
      },
    },
    {
      id: "protest",
      stance: "dove",
      labelKey: "event.border_incident.protest",
      effects: {
        budgetBp: -300,
        unrest: -1,
        prestige: { kind: "PROPORTIONAL_LOSS", basisPoints: 500, reasonCode: "BACKED_DOWN" },
        tension: { counterpart: "highest_tension_rival", delta: -2 },
      },
    },
  ],
  provenance,
};

const content: EventEngineContent = { rules: RULES, catalogue: [BORDER_INCIDENT] };

function nation(id: string, extra: Partial<NationState> = {}): NationState {
  return {
    id,
    name: id,
    tag: id,
    governmentType: "autocratic",
    traits: [],
    eventHistory: { fired: [], flags: [] },
    prestige: SafeInt(20),
    treasury: SafeInt(10_000),
    income: SafeInt(100),
    expenses: SafeInt(0),
    baseResources: SafeInt(0),
    navalAppropriationRateBp: SafeInt(2_000),
    maintenanceCost: SafeInt(0),
    fleets: [],
    divisions: [],
    research: {
      nationId: id,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    },
    constructionProjects: [],
    isPlayable: id === "GBR",
    isAI: id !== "GBR",
    ...extra,
  };
}

const RELATIONS: DiplomaticRelation[] = [
  { nationA: "FRA", nationB: "GBR", relation: "neutral", tension: 6, nap: false, since: "1880-01" },
];

function snapshot(nations: readonly NationState[]): CampaignSnapshot {
  return {
    prestigeRules: FIXTURE_PRESTIGE_RULES,
    version: "0.1.0",
    turnNumber: SafeInt(1),
    campaignId: "dilemma-interruption",
    startYear: 1880,
    startMonth: 1,
    strategicWeather: [],
    slots: [{ nationId: "GBR", type: "playable" }],
    world: { areas: [], routes: [], ports: [] },
    nations: new Map(nations.map((n) => [n.id, n])),
    wars: {
      wars: [],
      battles: [],
      participantMemberships: [],
      blockadeState: [],
      battleManifests: [],
    },
    politics: { relations: RELATIONS, shells: {} },
    intelligence: { shells: {} },
    designs: new Map(),
    designFamilies: new Map(),
    rulesetVersion: "0.1.0",
    compatibilityVersion: "5.0.0",
  };
}

const SEED = "dilemma-seed";

function turnIdOf(from: CampaignSnapshot): string {
  return computeTurnId({
    campaignId: from.campaignId,
    startingRevision: 0,
    committedOrderHash: "no-orders",
    orderedInputsHash: computeOrderedInputsHash([]),
  });
}

function run(from: CampaignSnapshot, channel?: InterruptionChannel, events = content) {
  return new MonthExecutor().execute(from, [], SEED, new DiagnosticCollector(), undefined, {
    events,
    playerNationId: "GBR",
    ...(channel === undefined ? {} : { interruptions: channel }),
  });
}

function answerFor(request: DecisionRequest, optionId: string): RecordedInput {
  return makeRecordedInput({
    ordinal: request.ordinal,
    kind: "decision",
    interruptionId: request.interruptionId,
    payload: { interruptionId: request.interruptionId, decisionId: request.decisionId, optionId },
  });
}

function suspendedRequest(from: CampaignSnapshot, turnId: string): DecisionRequest {
  const result = run(from, { turnId, recordedInputs: [] });
  expect(result.outcome).toBe("suspended");
  const request = result.suspended?.request;
  if (request?.kind !== "decision") throw new Error("expected a decision request");
  return request;
}

describe("dilemma interruption", () => {
  const start = snapshot([nation("FRA"), nation("GBR")]);
  const turnId = turnIdOf(start);

  it("suspends on a drawn dilemma with the event id, keys and declared deltas", () => {
    const request = suspendedRequest(start, turnId);
    expect(request.decisionId).toBe("border_incident");
    expect(request.subjectKey).toBe("border_incident");
    expect(request.phase).toBe("resolve_diplomacy");
    expect(request.titleKey).toBe("event.border_incident.title");
    expect(request.bodyKey).toBe("event.border_incident.body");
    expect(request.options.map((option) => option.optionId)).toEqual(["mobilise", "protest"]);
    const [mobilise, protest] = request.options;
    expect(mobilise?.titleKey).toBe("event.border_incident.mobilise");
    expect(mobilise?.deltas).toEqual([
      { target: { type: "nation", id: "GBR" }, attribute: "budgetBp", delta: 600 },
      { target: { type: "nation", id: "GBR" }, attribute: "prestige", delta: 5 },
      { target: { type: "nation", id: "GBR" }, attribute: "unrest", delta: 1 },
      { target: { type: "nation", id: "FRA" }, attribute: "tension", delta: 2 },
    ]);
    expect(protest?.deltas?.find((delta) => delta.attribute === "prestigeBp")?.delta).toBe(-500);
    expect(mobilise?.effects).toEqual([]);
  });

  it("derives hover hints from the declared deltas", () => {
    const request = suspendedRequest(start, turnId);
    const [mobilise] = request.options;
    expect(mobilise?.hints).toEqual(dilemmaHints(mobilise?.deltas ?? [], { prestige: 20 }));
    expect(mobilise?.hints).toEqual([
      {
        target: { type: "nation", id: "GBR" },
        attribute: "budgetBp",
        direction: "increase",
        magnitude: "minor",
      },
      {
        target: { type: "nation", id: "GBR" },
        attribute: "prestige",
        direction: "increase",
        magnitude: "minor",
      },
      {
        target: { type: "nation", id: "GBR" },
        attribute: "unrest",
        direction: "increase",
        magnitude: "minor",
      },
      {
        target: { type: "nation", id: "FRA" },
        attribute: "tension",
        direction: "increase",
        magnitude: "minor",
      },
    ]);
  });

  it("scales hint magnitude and direction from the delta alone", () => {
    const target = { type: "nation", id: "GBR" } as const;
    expect(
      dilemmaHints(
        [
          { target, attribute: "tension", delta: -5 },
          { target, attribute: "tension", delta: 7 },
          { target, attribute: "budgetBp", delta: 0 },
        ],
        { prestige: 20 },
      ).map((hint) => [hint.direction, hint.magnitude]),
    ).toEqual([
      ["decrease", "moderate"],
      ["increase", "major"],
      ["none", "minor"],
    ]);
  });

  it("resumes on an answer, records it as PLAYER and clears the pending dilemma", () => {
    const request = suspendedRequest(start, turnId);
    const channel: InterruptionChannel = {
      turnId,
      recordedInputs: [answerFor(request, "mobilise")],
    };
    const resumed = run(start, channel);
    expect(resumed.outcome).toBe("completed");
    const history = resumed.finalSnapshot.nations.get("GBR")?.eventHistory;
    expect(history?.pending).toBeUndefined();
    expect(history?.fired).toHaveLength(1);
    expect(history?.fired[0]).toMatchObject({
      eventId: "border_incident",
      month: "1880-02",
      answerId: "mobilise",
      resolvedBy: "PLAYER",
    });
  });

  it("applies the declared effects of the answer the player chose", () => {
    const request = suspendedRequest(start, turnId);
    const resumed = run(start, { turnId, recordedInputs: [answerFor(request, "mobilise")] });
    const final = resumed.finalSnapshot;
    const gbr = final.nations.get("GBR");
    expect(Number(gbr?.prestige)).toBe(25);
    expect(gbr?.prestigeLastChange).toMatchObject({
      reasonCode: "MOBILISED",
      month: "1880-02",
      delta: 5,
    });
    expect(gbr?.eventHistory?.fired[0]?.effects?.prestigeDelta).toBe(5);
    const relation = final.politics.relations.find((entry) => entry.nationB === "GBR");
    const effects = gbr?.eventHistory?.fired[0]?.effects;
    expect(Number(effects?.tensionAfter)).toBe(Number(effects?.tensionBefore) + 2);
    expect(relation?.tension).toBe(effects?.tensionAfter);
    expect(gbr?.budgetModifiers?.some((modifier) => modifier.eventId === "border_incident")).toBe(
      true,
    );
  });

  it("applies a different effect set for the other answer", () => {
    const request = suspendedRequest(start, turnId);
    const resumed = run(start, { turnId, recordedInputs: [answerFor(request, "protest")] });
    const gbr = resumed.finalSnapshot.nations.get("GBR");
    expect(Number(gbr?.prestige)).toBeLessThan(20);
    expect(gbr?.prestigeLastChange?.reasonCode).toBe("BACKED_DOWN");
    const relation = resumed.finalSnapshot.politics.relations.find(
      (entry) => entry.nationB === "GBR",
    );
    const effects = gbr?.eventHistory?.fired[0]?.effects;
    expect(effects?.tensionPartner).toBe("FRA");
    expect(Number(effects?.tensionAfter)).toBe(Number(effects?.tensionBefore) - 2);
    expect(relation?.tension).toBe(effects?.tensionAfter);
  });

  it("replays the recorded input to an identical hash", () => {
    const request = suspendedRequest(start, turnId);
    const channel: InterruptionChannel = {
      turnId,
      recordedInputs: [answerFor(request, "protest")],
    };
    const first = run(start, channel);
    const second = run(start, channel);
    expect(unifiedSnapshotHash(first.finalSnapshot)).toBe(
      unifiedSnapshotHash(second.finalSnapshot),
    );
    const replayed = new ReplayVerifier().verify(
      start,
      [],
      first.commandLedger,
      unifiedSnapshotHash(first.finalSnapshot),
      SEED,
      new DiagnosticCollector(),
      { events: content, playerNationId: "GBR", interruptions: channel },
    );
    expect(replayed.match).toBe(true);
  });

  it("keeps turn identity unchanged by answering", () => {
    const awaiting = suspendedRequest(start, turnId);
    const answered = answerFor(awaiting, "mobilise");
    expect(awaiting.turnId).toBe(turnId);
    const resumed = run(start, { turnId, recordedInputs: [answered] });
    expect(resumed.outcome).toBe("completed");
    expect(suspendedRequest(start, turnId).interruptionId).toBe(awaiting.interruptionId);
  });

  it("rejects an answer naming an option the event does not declare", () => {
    const request = suspendedRequest(start, turnId);
    const resumed = run(start, { turnId, recordedInputs: [answerFor(request, "invade")] });
    expect(resumed.outcome).toBe("suspended");
    expect(resumed.suspended?.reason).toBe("invalid-input");
  });

  it("leaves the dilemma pending when no interruption channel is supplied", () => {
    const result = run(start);
    expect(result.outcome).toBe("completed");
    expect(result.finalSnapshot.nations.get("GBR")?.eventHistory?.pending).toEqual({
      eventId: "border_incident",
      drawnMonth: "1880-02",
    });
  });

  it("presents a dilemma carried over from an earlier turn", () => {
    const carried = snapshot([
      nation("FRA"),
      nation("GBR", {
        eventHistory: {
          fired: [],
          flags: [],
          pending: { eventId: "border_incident", drawnMonth: "1880-01" },
        },
      }),
    ]);
    const request = suspendedRequest(carried, turnIdOf(carried));
    expect(request.decisionId).toBe("border_incident");
  });
});
