import { describe, expect, it } from "vite-plus/test";
import {
  RUN_CAP_REQUIRED,
  RUN_REQUEST_INVALID,
  RUN_PAUSE_KINDS,
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  decodeRunRequest,
  holdsEnemyContact,
  minutePauseKinds,
  pauseReasonOf,
  type MinutePauseKind,
  playerBattleSessionHash,
  requestedMinutes,
  runPlayerBattle,
  runPlayerBattleToEnd,
  type PlayerBattleOrders,
  type PlayerBattleSession,
  type RunPauseKind,
  type RunRequest,
} from "@bluewave/combat/battleResolution";
import { isBluewaveError } from "@bluewave/contracts";
import { ATTACKER_NATION, makeAutoInput } from "./fixtures.js";

const ORDERS: PlayerBattleOrders = { divisions: {} };

function fresh(): PlayerBattleSession {
  return createPlayerBattleSession({ ...makeAutoInput(), playerNationId: ATTACKER_NATION });
}

function request(mode: RunRequest["mode"], pauseOn: readonly RunPauseKind[] = []): RunRequest {
  return { mode, pauseOn };
}

function codeOf(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    if (isBluewaveError(error)) return error.context.code;
    throw error;
  }
  throw new Error("expected the call to throw");
}

describe("battle run and pause control", () => {
  it("N single-turn requests and one RUN_N of N produce identical session hashes", () => {
    const hashes: string[] = [];
    let stepped = fresh();
    for (let minute = 0; minute < 12; minute += 1) {
      const turn = runPlayerBattle(stepped, ORDERS, request({ kind: "TURN" }));
      expect(turn.minutesAdvanced).toBe(1);
      stepped = turn.session;
      hashes.push(playerBattleSessionHash(stepped));
    }
    const batch = runPlayerBattle(fresh(), ORDERS, request({ kind: "RUN_N", minutes: 12 }));
    expect(batch.minutesAdvanced).toBe(12);
    expect(playerBattleSessionHash(batch.session)).toBe(hashes[11]);
    let prefix = fresh();
    hashes.forEach((hash, index) => {
      prefix = runPlayerBattle(prefix, ORDERS, request({ kind: "RUN_N", minutes: 1 })).session;
      expect(playerBattleSessionHash(prefix), `minute ${String(index + 1)}`).toBe(hash);
    });
  });

  it("matches the existing minute stepper", () => {
    const direct = advancePlayerBattleMinute(fresh(), ORDERS);
    const turn = runPlayerBattle(fresh(), ORDERS, request({ kind: "TURN" }));
    expect(playerBattleSessionHash(turn.session)).toBe(playerBattleSessionHash(direct));
    expect(turn.events).toEqual(direct.log);
  });

  it("reports the events the run produced and none from before it", () => {
    const first = runPlayerBattle(fresh(), ORDERS, request({ kind: "RUN_N", minutes: 6 }));
    const second = runPlayerBattle(first.session, ORDERS, request({ kind: "RUN_N", minutes: 6 }));
    expect(second.events).toEqual(second.session.log.slice(first.session.log.length));
    expect(first.events).toEqual(first.session.log);
  });

  it("stops at the end of the battle whatever the request and pause set", () => {
    const outcome = runPlayerBattle(fresh(), ORDERS, request({ kind: "RUN_N", minutes: 99 }, []));
    const finished = runPlayerBattleToEnd(fresh(), ORDERS);
    expect(finished.minute).toBeLessThan(99);
    expect(outcome.session.ended).toBe(true);
    expect(outcome.pauseReason).toBe("BATTLE_END");
    expect(outcome.minutesAdvanced).toBe(finished.minute);
    expect(playerBattleSessionHash(outcome.session)).toBe(playerBattleSessionHash(finished));
  });

  it("does nothing on a battle that has already ended", () => {
    const finished = runPlayerBattleToEnd(fresh(), ORDERS);
    const outcome = runPlayerBattle(finished, ORDERS, request({ kind: "RUN_N", minutes: 5 }));
    expect(outcome.minutesAdvanced).toBe(0);
    expect(outcome.pauseReason).toBe("BATTLE_END");
    expect(outcome.events).toEqual([]);
    expect(outcome.session).toBe(finished);
  });

  it("pauses after the minute that raised a requested kind, never mid-minute", () => {
    const paused = runPlayerBattle(fresh(), ORDERS, {
      mode: { kind: "RUN_UNTIL_EVENT" },
      pauseOn: [...RUN_PAUSE_KINDS],
      runCapMinutes: 240,
    });
    expect(paused.pauseReason).not.toBeNull();
    expect(paused.minutesAdvanced).toBe(paused.session.minute);
    expect(paused.events).toEqual(paused.session.log);
    const resumed = runPlayerBattle(paused.session, ORDERS, request({ kind: "RUN_N", minutes: 1 }));
    expect(resumed.session.minute).toBe(paused.session.minute + 1);
  });

  it("pauses on the first sighting of an enemy when asked to and not otherwise", () => {
    const paused = runPlayerBattle(fresh(), ORDERS, {
      mode: { kind: "RUN_UNTIL_EVENT" },
      pauseOn: ["ENEMY_SIGHTED"],
      runCapMinutes: 240,
    });
    expect(paused.pauseReason).toBe("ENEMY_SIGHTED");
    expect(paused.minutesAdvanced).toBe(1);
    const unpaused = runPlayerBattle(fresh(), ORDERS, {
      mode: { kind: "RUN_UNTIL_EVENT" },
      pauseOn: [],
      runCapMinutes: 240,
    });
    expect(unpaused.pauseReason).toBe("BATTLE_END");
    expect(unpaused.minutesAdvanced).toBeGreaterThan(1);
  });

  it("pauses on a hit to a friendly ship only when asked to", () => {
    const hit = runPlayerBattle(fresh(), ORDERS, {
      mode: { kind: "RUN_UNTIL_EVENT" },
      pauseOn: ["FRIENDLY_HIT"],
      runCapMinutes: 240,
    });
    expect(hit.pauseReason).toBe("FRIENDLY_HIT");
    const friendly = new Set(
      hit.session.units.filter((unit) => unit.sideId === "ATTACKER").map((unit) => unit.assetId),
    );
    const last = hit.events.filter((event) => event.minute === hit.session.minute);
    expect(last.some((event) => friendly.has(event.targetId))).toBe(true);
  });

  it("stops RUN_UNTIL_EVENT at the explicit cap and reports RUN_CAP", () => {
    const outcome = runPlayerBattle(fresh(), ORDERS, {
      mode: { kind: "RUN_UNTIL_EVENT" },
      pauseOn: [],
      runCapMinutes: 3,
    });
    expect(outcome.minutesAdvanced).toBe(3);
    expect(outcome.pauseReason).toBe("RUN_CAP");
  });

  it("refuses RUN_UNTIL_EVENT without a cap", () => {
    expect(
      codeOf(() => runPlayerBattle(fresh(), ORDERS, request({ kind: "RUN_UNTIL_EVENT" }))),
    ).toBe(RUN_CAP_REQUIRED);
  });

  it("runs 5 minutes when an enemy contact is held and 60 otherwise on RUN_CONTACT_AWARE", () => {
    const start = fresh();
    expect(holdsEnemyContact(start)).toBe(false);
    const blind = runPlayerBattle(start, ORDERS, request({ kind: "RUN_CONTACT_AWARE" }));
    expect(requestedMinutes({ kind: "RUN_CONTACT_AWARE" }, false)).toBe(60);
    expect(requestedMinutes({ kind: "RUN_CONTACT_AWARE" }, true)).toBe(5);
    expect(blind.minutesAdvanced).toBeGreaterThan(5);
    expect(blind.pauseReason).toBe("BATTLE_END");
    const sighted = runPlayerBattle(start, ORDERS, request({ kind: "RUN_N", minutes: 1 })).session;
    expect(holdsEnemyContact(sighted)).toBe(true);
    const aware = runPlayerBattle(sighted, ORDERS, request({ kind: "RUN_CONTACT_AWARE" }));
    expect(aware.minutesAdvanced).toBe(5);
    expect(aware.pauseReason).toBeNull();
  });

  describe("pause detection", () => {
    const base = advancePlayerBattleMinute(fresh(), ORDERS);

    it("raises SHIP_SUNK when a ship leaves normal status", () => {
      const [shipId, target] = Object.entries(base.damage.targets)[0]!;
      const after: PlayerBattleSession = {
        ...base,
        damage: {
          ...base.damage,
          targets: {
            ...base.damage.targets,
            [shipId]: { ...target, state: { ...target.state, terminalStatus: "SINKING" } },
          },
        },
      };
      expect(minutePauseKinds(base, after, []).has("SHIP_SUNK")).toBe(true);
      expect(minutePauseKinds(after, after, []).has("SHIP_SUNK")).toBe(false);
    });

    it("raises TORPEDO for a launch or a hit by anyone", () => {
      for (const eventType of ["torpedo_launch", "torpedo_hit"]) {
        const event = { minute: 2, eventType, actorId: "x", targetId: "y" };
        expect(minutePauseKinds(base, base, [event]).has("TORPEDO")).toBe(true);
      }
    });

    it("raises FRIENDLY_HIT only for damage to the player side", () => {
      const own = base.units.find((unit) => unit.sideId === "ATTACKER")!.assetId;
      const enemy = base.units.find((unit) => unit.sideId === "DEFENDER")!.assetId;
      const hit = (targetId: string) => [
        { minute: 2, eventType: "damage_impact", actorId: "x", targetId },
      ];
      expect(minutePauseKinds(base, base, hit(own)).has("FRIENDLY_HIT")).toBe(true);
      expect(minutePauseKinds(base, base, hit(enemy)).has("FRIENDLY_HIT")).toBe(false);
    });

    it("raises CONTACT_LOST when a held enemy contact goes stale", () => {
      const lost: PlayerBattleSession = {
        ...base,
        state: {
          ...base.state,
          contacts: (base.state.contacts ?? []).map((contact) => ({ ...contact, stale: true })),
        },
      };
      expect(holdsEnemyContact(base)).toBe(true);
      expect(minutePauseKinds(base, lost, []).has("CONTACT_LOST")).toBe(true);
    });

    it("orders simultaneous kinds by precedence and ignores unrequested ones", () => {
      const raised = new Set<MinutePauseKind>(["SHIP_SUNK", "ENEMY_SIGHTED", "BATTLE_END"]);
      expect(pauseReasonOf(raised, [])).toBe("BATTLE_END");
      raised.delete("BATTLE_END");
      expect(pauseReasonOf(raised, ["ENEMY_SIGHTED"])).toBe("ENEMY_SIGHTED");
      expect(pauseReasonOf(raised, ["ENEMY_SIGHTED", "SHIP_SUNK"])).toBe("SHIP_SUNK");
      expect(pauseReasonOf(raised, ["TORPEDO"])).toBeNull();
    });
  });

  it("decodes the request strictly", () => {
    const bad: unknown[] = [
      { mode: { kind: "RUN_N", minutes: 0 }, pauseOn: [] },
      { mode: { kind: "RUN_N", minutes: 100 }, pauseOn: [] },
      { mode: { kind: "RUN_N", minutes: 1.5 }, pauseOn: [] },
      { mode: { kind: "SPRINT" }, pauseOn: [] },
      { mode: { kind: "TURN" }, pauseOn: ["OBJECTIVE_COMPLETED"] },
      { mode: { kind: "TURN" }, pauseOn: [], extra: true },
      { mode: { kind: "TURN" } },
      { mode: { kind: "RUN_UNTIL_EVENT" }, pauseOn: [], runCapMinutes: 0 },
    ];
    for (const value of bad)
      expect(codeOf(() => decodeRunRequest(value))).toBe(RUN_REQUEST_INVALID);
    expect(
      decodeRunRequest({ mode: { kind: "RUN_N", minutes: 99 }, pauseOn: ["SHIP_SUNK"] }),
    ).toEqual({
      mode: { kind: "RUN_N", minutes: 99 },
      pauseOn: ["SHIP_SUNK"],
    });
    expect(
      decodeRunRequest({ mode: { kind: "TURN" }, pauseOn: ["WAYPOINT_REACHED"] }).pauseOn,
    ).toEqual(["WAYPOINT_REACHED"]);
  });
});
