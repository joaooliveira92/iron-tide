import { describe, expect, it } from "vite-plus/test";
import {
  NO_TRAINING_EFFECTS,
  resolveBattleAuto,
  type BattleResolutionResult,
} from "@bluewave/combat/battleResolution";
import {
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  playerBattleResult,
  playerBattleSessionHash,
  playerBattleView,
  runPlayerBattleToEnd,
  type PlayerBattleOrders,
} from "@bluewave/combat/battleResolution";
import { ATTACKER_NATION, makeAutoInput, makeNations } from "./fixtures.js";
import type { PermanentDivision } from "@bluewave/campaign";
import { BluewaveError, isBluewaveError, SafeInt } from "@bluewave/contracts";
import { BATTLE_AUTO_RESOLUTION_FAILED } from "@bluewave/combat/battleResolution";

function capture(run: () => unknown): BluewaveError {
  try {
    run();
  } catch (error) {
    if (isBluewaveError(error)) return error;
    throw error;
  }
  throw new Error("expected the call to throw");
}

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

function inputWithDivisions() {
  const nations = makeNations();
  return {
    ...makeAutoInput({
      nations: {
        ...nations,
        attacker: {
          ...nations.attacker,
          divisions: [division("div-att", "n-uk", ["a1", "a2"])],
        },
        defender: {
          ...nations.defender,
          divisions: [division("div-def", "n-fr", ["d1", "d2"])],
        },
      },
    }),
    playerNationId: "n-uk",
  };
}

const DEFAULT_ORDERS: PlayerBattleOrders = { divisions: {} };

function makePlayerInput() {
  return { ...makeAutoInput(), playerNationId: ATTACKER_NATION };
}

function auto(): BattleResolutionResult {
  return resolveBattleAuto(makeAutoInput());
}

function player(): ReturnType<typeof runPlayerBattleToEnd> {
  return runPlayerBattleToEnd(createPlayerBattleSession(makePlayerInput()), DEFAULT_ORDERS);
}

describe("T-2 player battle session", () => {
  it("default ENGAGE orders reproduce the auto-resolver byte-for-byte", () => {
    const expected = auto();
    const actual = player();
    const result = playerBattleResult(actual);

    expect(actual.ended).toBe(true);
    expect(actual.endReason).toBe(expected.battleEndReason);
    expect(actual.minute).toBe(expected.elapsedMinutes);
    expect(actual.winnerId).toBe(expected.winnerId);
    expect(actual.loserId).toBe(expected.loserId);
    expect(result.attackerLosses).toEqual(expected.attackerSunkIds);
    expect(result.defenderLosses).toEqual(expected.defenderSunkIds);
    expect(result.damageReport).toEqual(expected.damageReport);
  });

  it("is deterministic across independent sessions", () => {
    const a = player();
    const b = player();
    expect(playerBattleSessionHash(a)).toBe(playerBattleSessionHash(b));
  });

  it("advancing one minute at a time equals running to the end", () => {
    const stepped = advancePlayerBattleMinute(
      createPlayerBattleSession(makePlayerInput()),
      DEFAULT_ORDERS,
    );
    expect(stepped.minute).toBe(1);
    expect(stepped.log.length).toBeGreaterThan(0);
    const finished = runPlayerBattleToEnd(stepped, DEFAULT_ORDERS);
    expect(playerBattleSessionHash(finished)).toBe(playerBattleSessionHash(player()));
  });

  it("explains the accuracy of the player's own gunned ships and never the enemy's", () => {
    const view = playerBattleView(createPlayerBattleSession(makePlayerInput()));
    const own = view.ships.filter((ship) => ship.sideId === "ATTACKER");
    const enemy = view.ships.filter((ship) => ship.sideId === "DEFENDER");
    expect(own.length).toBeGreaterThan(0);
    for (const ship of own) {
      expect(ship.gunneryAccuracy?.formulaId).toBe("gunnery_accuracy");
      expect(ship.gunneryAccuracy?.unit).toBe("bp");
    }
    for (const ship of enemy) expect(ship).not.toHaveProperty("gunneryAccuracy");
  });

  it("shows the training bonus as a factor of the accuracy it explains", () => {
    const base = makePlayerInput();
    const trained = {
      ...base,
      attacker: {
        ...base.attacker,
        trainingEffects: { ...NO_TRAINING_EFFECTS, gunneryBp: 1_000 },
      },
    };
    const plain = playerBattleView(createPlayerBattleSession(base));
    const view = playerBattleView(createPlayerBattleSession(trained));
    const shipId = view.ships.find((ship) => ship.sideId === "ATTACKER")!.shipId;
    const explained = (v: typeof view) =>
      v.ships.find((ship) => ship.shipId === shipId)!.gunneryAccuracy!;
    const training = explained(view).children?.find(
      (c) => c.formulaId === "gunnery_accuracy.training",
    );
    expect(training?.inputs["multiplierBp"]).toBe(11_000);
    expect(
      explained(plain).children?.some((c) => c.formulaId === "gunnery_accuracy.training"),
    ).toBeFalsy();
    expect(Number(explained(view).result)).toBeGreaterThan(Number(explained(plain).result));
  });

  it("exposes a structured view with objectives, ships and divisions", () => {
    const session = createPlayerBattleSession(makePlayerInput());
    const view = playerBattleView(session);
    expect(view.battleId).toBe(session.battleId);
    expect(view.minute).toBe(0);
    expect(view.ships.map((s) => s.shipId).sort()).toEqual(["a1", "a2", "d1", "d2"]);
    for (const ship of view.ships) {
      expect(ship.maxHitPoints).toBe(100);
      expect(ship.damageState).toBe("NORMAL");
    }
  });

  it("HOLD orders keep the ships out of the fight and change the outcome", () => {
    const input = inputWithDivisions();
    const session = createPlayerBattleSession(input);
    expect(session.state.divisions).toHaveLength(2);
    const divisions = session.state.divisions.map((d) => [
      d.tacticalDivisionId,
      { stance: "HOLD" as const, speedPercent: 0 },
    ]);
    const baseline = runPlayerBattleToEnd(session, DEFAULT_ORDERS);
    const held = runPlayerBattleToEnd(session, { divisions: Object.fromEntries(divisions) });
    expect(held.ended).toBe(true);
    expect(baseline.ended).toBe(true);
    expect(playerBattleSessionHash(held)).not.toBe(playerBattleSessionHash(baseline));
  });

  it("enforces integer speed percentages", () => {
    const session = createPlayerBattleSession(inputWithDivisions());
    const division = session.state.divisions[0];
    if (!division) throw new Error("fixture must produce a division");
    expect(() =>
      advancePlayerBattleMinute(session, {
        divisions: { [division.tacticalDivisionId]: { stance: "ENGAGE", speedPercent: 50.5 } },
      }),
    ).toThrow(BluewaveError);
    const failure = capture(() =>
      advancePlayerBattleMinute(session, {
        divisions: { [division.tacticalDivisionId]: { stance: "ENGAGE", speedPercent: 50.5 } },
      }),
    );
    expect(failure.context.code).toBe(BATTLE_AUTO_RESOLUTION_FAILED);
    expect(failure.context.reason).toBe("speedPercent must be an integer");
  });

  it("tags the failure when a side has no promotable ship", () => {
    const input = makePlayerInput();
    const failure = capture(() =>
      createPlayerBattleSession({
        ...input,
        manifest: { ...input.manifest, persistentAssets: [] },
      }),
    );
    expect(failure.context.code).toBe(BATTLE_AUTO_RESOLUTION_FAILED);
    expect(failure.context.reason).toBe(
      "both sides require at least one committed, promotable ship",
    );
  });
});
