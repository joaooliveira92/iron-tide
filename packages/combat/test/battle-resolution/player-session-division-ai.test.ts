import { describe, expect, it } from "vite-plus/test";
import {
  PLAYER_BATTLE_DIVISION_AI_CHECKPOINT_INVALID,
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  divisionAiCheckpointOf,
  playerBattleSessionHash,
  restoreDivisionAiCheckpoint,
  withDivisionAiMemory,
  type PlayerBattleSession,
} from "@bluewave/combat/battleResolution";
import {
  createDivisionAiMemory,
  decideDivisionOrders,
  hashDivisionAiMemory,
  type DivisionAiMemory,
} from "@bluewave/combat/division-ai";
import { SafeInt, isBluewaveError } from "@bluewave/contracts";
import type { PermanentDivision } from "@bluewave/campaign";
import { contact, fullForce } from "../division-ai/fixtures.js";
import { ATTACKER_NATION, makeAutoInput, makeNations } from "./fixtures.js";

function division(divisionId: string, nationId: string, shipOrder: string[]): PermanentDivision {
  return {
    divisionId,
    nationId,
    shipOrder,
    flagshipShipId: shipOrder[0]!,
    commanderOfficerId: "VACANT",
    divisionRole: "CORE",
    preferredFormation: "LINE_AHEAD",
    experience: SafeInt(20),
    cohesion: SafeInt(30),
    locationAreaId: "area-eng-ch",
    creationMonth: "1880-01",
    lastReorganizationMonth: "1880-01",
    provenanceRefs: [],
    rulesetVersion: "b6_ruleset_v1",
    aggregateHash: "hash",
  };
}

function newSession(): PlayerBattleSession {
  const nations = makeNations();
  return createPlayerBattleSession({
    ...makeAutoInput({
      nations: {
        ...nations,
        attacker: { ...nations.attacker, divisions: [division("div-att", "n-uk", ["a1", "a2"])] },
        defender: { ...nations.defender, divisions: [division("div-def", "n-fr", ["d1", "d2"])] },
      },
    }),
    playerNationId: ATTACKER_NATION,
  });
}

function stepAi(session: PlayerBattleSession, memory: DivisionAiMemory): PlayerBattleSession {
  const view = fullForce({
    minute: session.minute,
    contacts: [contact("E1", "CAPITAL", 14_000, 3_000)],
  });
  const decision = decideDivisionOrders(view, memory);
  return withDivisionAiMemory(
    advancePlayerBattleMinute(session, { divisions: {} }),
    decision.memory,
  );
}

function memoryOf(session: PlayerBattleSession): DivisionAiMemory {
  return session.divisionAi?.memory ?? createDivisionAiMemory();
}

function run(session: PlayerBattleSession, minutes: number): PlayerBattleSession {
  let current = session;
  for (let index = 0; index < minutes; index += 1) current = stepAi(current, memoryOf(current));
  return current;
}

function failureCode(action: () => unknown): string | undefined {
  try {
    action();
  } catch (error) {
    return isBluewaveError(error) ? (error.context.code as string) : undefined;
  }
  return undefined;
}

describe("player battle session carries the division AI memory", () => {
  it("carries no memory until one is supplied, and then binds it into the session hash", () => {
    const session = newSession();
    const advanced = advancePlayerBattleMinute(session, { divisions: {} });
    expect(advanced.divisionAi).toBeUndefined();
    expect(divisionAiCheckpointOf(advanced)).toBeNull();
    expect(
      playerBattleSessionHash(withDivisionAiMemory(advanced, createDivisionAiMemory())),
    ).not.toBe(playerBattleSessionHash(advanced));
  });

  it("evolves a non-default memory that the session hash binds", () => {
    const ran = run(newSession(), 4);
    expect(memoryOf(ran).divisions.length).toBeGreaterThan(0);
    const other = withDivisionAiMemory(ran, createDivisionAiMemory());
    expect(playerBattleSessionHash(other)).not.toBe(playerBattleSessionHash(ran));
  });

  it("matches an uninterrupted run after a checkpoint round trip through JSON", () => {
    const uninterrupted = run(newSession(), 8);

    const first = run(newSession(), 4);
    const stored: unknown = JSON.parse(JSON.stringify(divisionAiCheckpointOf(first)));
    const replayed = advancePlayerBattleMinuteTimes(newSession(), 4);
    const resumed = run(restoreDivisionAiCheckpoint(replayed, stored), 4);

    expect(memoryOf(resumed)).toEqual(memoryOf(uninterrupted));
    expect(hashDivisionAiMemory(memoryOf(resumed))).toBe(
      hashDivisionAiMemory(memoryOf(uninterrupted)),
    );
    expect(playerBattleSessionHash(resumed)).toBe(playerBattleSessionHash(uninterrupted));
  });

  it("refuses a checkpoint from another minute", () => {
    const checkpoint = divisionAiCheckpointOf(run(newSession(), 4));
    const replayed = advancePlayerBattleMinuteTimes(newSession(), 3);
    expect(failureCode(() => restoreDivisionAiCheckpoint(replayed, checkpoint))).toBe(
      PLAYER_BATTLE_DIVISION_AI_CHECKPOINT_INVALID,
    );
  });

  it("refuses a checkpoint whose memory was edited", () => {
    const checkpoint = divisionAiCheckpointOf(run(newSession(), 4))!;
    const edited = {
      ...checkpoint,
      memory: createDivisionAiMemory(),
    };
    const replayed = advancePlayerBattleMinuteTimes(newSession(), 4);
    expect(failureCode(() => restoreDivisionAiCheckpoint(replayed, edited))).toBe(
      PLAYER_BATTLE_DIVISION_AI_CHECKPOINT_INVALID,
    );
  });

  it("refuses a malformed checkpoint", () => {
    const replayed = advancePlayerBattleMinuteTimes(newSession(), 4);
    expect(
      failureCode(() => restoreDivisionAiCheckpoint(replayed, { minute: 4, extra: true })),
    ).toBe(PLAYER_BATTLE_DIVISION_AI_CHECKPOINT_INVALID);
  });

  it("restores a null checkpoint as no memory", () => {
    const replayed = advancePlayerBattleMinuteTimes(newSession(), 2);
    expect(restoreDivisionAiCheckpoint(replayed, null)).toBe(replayed);
  });
});

function advancePlayerBattleMinuteTimes(
  session: PlayerBattleSession,
  minutes: number,
): PlayerBattleSession {
  let current = session;
  for (let index = 0; index < minutes; index += 1) {
    current = advancePlayerBattleMinute(current, { divisions: {} });
  }
  return current;
}
