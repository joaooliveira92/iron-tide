import {
  computeInterruptionId,
  makeRecordedInput,
  type OfferResponseInput,
} from "@bluewave/messages";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { describe, expect, it } from "vite-plus/test";
import {
  consumeOfferResponse,
  createInterruptionState,
  unifiedSnapshotHash,
  MonthExecutor,
  PLAYER_NATION_UNKNOWN,
} from "../src/index.js";
import { makeBattleSnapshot, makeBattle, ATTACKER_NATION } from "./battle-fixtures.js";

const subject = { battleId: "battle-1", phase: "battle_generation" } as const;

function expectedId(ordinal: number, turnId = "t-1"): string {
  return computeInterruptionId({
    turnId,
    phase: subject.phase,
    ordinal,
    subjectKey: subject.battleId,
  });
}

function recordedFor(response: OfferResponseInput["response"], ordinal = 0) {
  const interruptionId = expectedId(ordinal);
  return makeRecordedInput({
    ordinal,
    kind: "offer",
    interruptionId,
    payload: { interruptionId, battleId: subject.battleId, response },
  });
}

describe("consumeOfferResponse", () => {
  it("is inactive without an interruption channel", () => {
    expect(consumeOfferResponse(undefined, subject)).toEqual({ status: "inactive" });
  });

  it("reports awaiting input with the deterministic interruption id, without advancing", () => {
    const state = createInterruptionState({ turnId: "t-1", recordedInputs: [] });
    expect(consumeOfferResponse(state, subject)).toEqual({
      status: "awaiting",
      ordinal: 0,
      interruptionId: expectedId(0),
    });
    expect(state.nextOrdinal).toBe(0);
  });

  it("consumes each response kind once, advancing the ordinal", () => {
    for (const response of ["accept", "decline", "delegate"] as const) {
      const state = createInterruptionState({
        turnId: "t-1",
        recordedInputs: [recordedFor(response)],
      });
      const resolved = consumeOfferResponse(state, subject);
      expect(resolved.status).toBe("resolved");
      if (resolved.status === "resolved") expect(resolved.response.response).toBe(response);
      expect(state.nextOrdinal).toBe(1);
    }
  });

  it("rejects, without advancing, a tampered id, a swapped payload, a wrong kind and a wrong battle", () => {
    const good = recordedFor("accept");
    const tamperedPayload = { ...good, payload: { ...good.payload, response: "decline" as const } };
    const wrongBattle = makeRecordedInput({
      ordinal: 0,
      kind: "offer",
      interruptionId: good.interruptionId,
      payload: { interruptionId: good.interruptionId, battleId: "other", response: "accept" },
    });
    const wrongKind = makeRecordedInput({
      ordinal: 0,
      kind: "decision",
      interruptionId: good.interruptionId,
      payload: { interruptionId: good.interruptionId, decisionId: "d", optionId: "o" },
    });
    for (const recorded of [
      { ...good, interruptionId: "tampered" },
      tamperedPayload,
      wrongBattle,
      wrongKind,
    ]) {
      const state = createInterruptionState({ turnId: "t-1", recordedInputs: [recorded] });
      expect(consumeOfferResponse(state, subject).status).toBe("invalid");
      expect(state.nextOrdinal).toBe(0);
    }
  });
});

describe("month player-nation input", () => {
  const snapshot = makeBattleSnapshot({ wars: [], battles: [makeBattle()] });
  const run = (playerNationId?: string) =>
    new MonthExecutor().execute(
      snapshot,
      [],
      "seed",
      new DiagnosticCollector(),
      undefined,
      playerNationId === undefined ? undefined : { playerNationId },
    );

  it("changes nothing but the player's own battle prestige when supplied for a known nation", () => {
    const control = run();
    const withPlayer = run(ATTACKER_NATION);
    expect(withPlayer.success).toBe(control.success);
    const nations = new Map(withPlayer.finalSnapshot.nations);
    const player = nations.get(ATTACKER_NATION)!;
    const controlPlayer = control.finalSnapshot.nations.get(ATTACKER_NATION)!;
    nations.set(ATTACKER_NATION, {
      ...player,
      prestige: controlPlayer.prestige,
      prestigeLastChange: controlPlayer.prestigeLastChange,
    });
    expect(unifiedSnapshotHash({ ...withPlayer.finalSnapshot, nations })).toBe(
      unifiedSnapshotHash(control.finalSnapshot),
    );
  });

  it("fails closed with a typed diagnostic for an unknown nation and runs no phase", () => {
    const collector = new DiagnosticCollector();
    const result = new MonthExecutor().execute(snapshot, [], "seed", collector, undefined, {
      playerNationId: "ATLANTIS",
    });
    expect(result.success).toBe(false);
    expect(collector.all.map((d) => d.code)).toContain(PLAYER_NATION_UNKNOWN);
    expect(unifiedSnapshotHash(result.finalSnapshot)).toBe(unifiedSnapshotHash(snapshot));
  });
});
