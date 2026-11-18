import { describe, expect, it } from "vite-plus/test";
import {
  WAYPOINT_ARRIVAL_TOLERANCE_METRES,
  WAYPOINT_REACHED_EVENT_TYPE,
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  playerBattleSessionHash,
  runPlayerBattle,
  type PlayerBattleDivisionOrder,
  type PlayerBattleOrders,
  type PlayerBattleSession,
  type RunRequest,
} from "@bluewave/combat/battleResolution";
import type { PermanentDivision } from "@bluewave/campaign";
import { SafeInt, isBluewaveError } from "@bluewave/contracts";
import { ATTACKER_NATION, makeAutoInput, makeNations } from "./fixtures.js";

const UM_PER_M = 1_000_000;
const LEG_METRES = 3_000;

function permanentDivision(
  divisionId: string,
  nationId: string,
  shipOrder: string[],
): PermanentDivision {
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

function fresh(rules?: { arrivalToleranceMetres: number }): PlayerBattleSession {
  const nations = makeNations();
  return createPlayerBattleSession({
    ...makeAutoInput({
      nations: {
        ...nations,
        attacker: {
          ...nations.attacker,
          divisions: [permanentDivision("div-att", "n-uk", ["a1", "a2"])],
        },
        defender: {
          ...nations.defender,
          divisions: [permanentDivision("div-def", "n-fr", ["d1", "d2"])],
        },
      },
    }),
    playerNationId: ATTACKER_NATION,
    ...(rules === undefined ? {} : { waypointRules: rules }),
  });
}

function attackerDivision(session: PlayerBattleSession) {
  const division = session.state.divisions.find((candidate) => candidate.sideId === "ATTACKER");
  if (division === undefined) throw new Error("fixture has no attacker division");
  return division;
}

function flagshipMetres(session: PlayerBattleSession): readonly [number, number] {
  const flagship = attackerDivision(session).tacticalFlagshipId;
  const movement = session.state.movementStates?.[flagship];
  if (movement === undefined) throw new Error("flagship has no movement state");
  return [Math.trunc(movement.position[0] / UM_PER_M), Math.trunc(movement.position[1] / UM_PER_M)];
}

function waypointOrders(
  session: PlayerBattleSession,
  pauseOnArrival: boolean,
  legMetres = LEG_METRES,
): PlayerBattleOrders {
  const [x, y] = flagshipMetres(session);
  const order: PlayerBattleDivisionOrder = {
    stance: "ENGAGE",
    speedPercent: 100,
    speedKnots: 12,
    waypoint: { xMetres: x + legMetres, yMetres: y, pauseOnArrival },
  };
  return { divisions: { [attackerDivision(session).tacticalDivisionId]: order } };
}

function untilEvent(pauseOn: RunRequest["pauseOn"]): RunRequest {
  return { mode: { kind: "RUN_UNTIL_EVENT" }, pauseOn, runCapMinutes: 60 };
}

function distanceMetres(session: PlayerBattleSession, target: readonly [number, number]): number {
  const [x, y] = flagshipMetres(session);
  return Math.hypot(x - target[0], y - target[1]);
}

describe("waypoint orders", () => {
  it("steers the division to the point, consumes the waypoint and reports it once", () => {
    const start = fresh();
    const orders = waypointOrders(start, false);
    const [startX, startY] = flagshipMetres(start);
    const target: readonly [number, number] = [startX + LEG_METRES, startY];
    const outcome = runPlayerBattle(start, orders, untilEvent([]));
    const reached = outcome.session.log.filter(
      (event) => event.eventType === WAYPOINT_REACHED_EVENT_TYPE,
    );
    expect(reached).toHaveLength(1);
    expect(reached[0]?.targetId).toBe(attackerDivision(start).tacticalDivisionId);
    expect(reached[0]?.actorId).toBe(attackerDivision(start).tacticalFlagshipId);
    const arrival = outcome.session.waypointArrivals?.[attackerDivision(start).tacticalDivisionId];
    expect(arrival?.minute).toBe(reached[0]?.minute);
    expect(arrival?.xMetres).toBe(target[0]);
  });

  it("is within the arrival tolerance at the minute the event is raised", () => {
    const start = fresh();
    const [startX, startY] = flagshipMetres(start);
    const orders = waypointOrders(start, true);
    const outcome = runPlayerBattle(start, orders, untilEvent(["WAYPOINT_REACHED"]));
    expect(outcome.pauseReason).toBe("WAYPOINT_REACHED");
    expect(distanceMetres(outcome.session, [startX + LEG_METRES, startY])).toBeLessThanOrEqual(
      WAYPOINT_ARRIVAL_TOLERANCE_METRES,
    );
    expect(outcome.minutesAdvanced).toBeGreaterThan(1);
  });

  it("pauses on arrival only when the order and the player's pause set both ask for it", () => {
    const start = fresh();
    const pausing = runPlayerBattle(start, waypointOrders(start, true), untilEvent([]));
    expect(pausing.pauseReason).not.toBe("WAYPOINT_REACHED");
    const quiet = runPlayerBattle(
      start,
      waypointOrders(start, false),
      untilEvent(["WAYPOINT_REACHED"]),
    );
    expect(quiet.pauseReason).not.toBe("WAYPOINT_REACHED");
    const both = runPlayerBattle(
      start,
      waypointOrders(start, true),
      untilEvent(["WAYPOINT_REACHED"]),
    );
    expect(both.pauseReason).toBe("WAYPOINT_REACHED");
  });

  it("holds the last heading after arrival instead of steering back to the point", () => {
    const start = fresh();
    const orders = waypointOrders(start, true);
    const arrived = runPlayerBattle(start, orders, untilEvent(["WAYPOINT_REACHED"]));
    const flagship = attackerDivision(start).tacticalFlagshipId;
    const headingAtArrival = arrived.session.state.movementStates?.[flagship]?.heading;
    const later = runPlayerBattle(arrived.session, orders, {
      mode: { kind: "RUN_N", minutes: 4 },
      pauseOn: ["WAYPOINT_REACHED"],
    });
    expect(later.events.filter((e) => e.eventType === WAYPOINT_REACHED_EVENT_TYPE)).toEqual([]);
    expect(later.session.state.movementStates?.[flagship]?.heading).toBe(headingAtArrival);
  });

  it("re-arms when a different waypoint replaces the consumed one", () => {
    const start = fresh();
    const first = runPlayerBattle(
      start,
      waypointOrders(start, true),
      untilEvent(["WAYPOINT_REACHED"]),
    );
    const next = waypointOrders(first.session, true, 2_000);
    const second = runPlayerBattle(first.session, next, untilEvent(["WAYPOINT_REACHED"]));
    expect(second.pauseReason).toBe("WAYPOINT_REACHED");
    expect(
      second.session.log.filter((event) => event.eventType === WAYPOINT_REACHED_EVENT_TYPE),
    ).toHaveLength(2);
  });

  it("honours a ruleset arrival tolerance", () => {
    const start = fresh({ arrivalToleranceMetres: 3_500 });
    const outcome = runPlayerBattle(
      start,
      waypointOrders(start, true),
      untilEvent(["WAYPOINT_REACHED"]),
    );
    expect(outcome.pauseReason).toBe("WAYPOINT_REACHED");
    expect(outcome.minutesAdvanced).toBe(1);
  });

  it("gives identical hashes for the same seed and orders", () => {
    const a = fresh();
    const b = fresh();
    const runA = runPlayerBattle(a, waypointOrders(a, true), untilEvent(["WAYPOINT_REACHED"]));
    const runB = runPlayerBattle(b, waypointOrders(b, true), untilEvent(["WAYPOINT_REACHED"]));
    expect(playerBattleSessionHash(runA.session)).toBe(playerBattleSessionHash(runB.session));
  });

  it("matches minute for minute between single turns and one RUN_N with a waypoint order", () => {
    const start = fresh();
    const orders = waypointOrders(start, true);
    const minutes = 14;
    const hashes: string[] = [];
    let stepped = start;
    for (let minute = 0; minute < minutes; minute += 1) {
      stepped = runPlayerBattle(stepped, orders, { mode: { kind: "TURN" }, pauseOn: [] }).session;
      hashes.push(playerBattleSessionHash(stepped));
    }
    const batch = runPlayerBattle(start, orders, {
      mode: { kind: "RUN_N", minutes },
      pauseOn: [],
    });
    expect(batch.minutesAdvanced).toBe(minutes);
    expect(playerBattleSessionHash(batch.session)).toBe(hashes[minutes - 1]);
    let prefix = start;
    hashes.forEach((hash, index) => {
      prefix = runPlayerBattle(prefix, orders, {
        mode: { kind: "RUN_N", minutes: 1 },
        pauseOn: [],
      }).session;
      expect(playerBattleSessionHash(prefix), `minute ${String(index + 1)}`).toBe(hash);
    });
  });

  it("leaves a waypoint-free session byte-identical to the pre-waypoint stepper", () => {
    const session = advancePlayerBattleMinute(fresh(), { divisions: {} });
    expect(session.waypointArrivals).toBeUndefined();
    expect(session.log.some((event) => event.eventType === WAYPOINT_REACHED_EVENT_TYPE)).toBe(
      false,
    );
  });

  it("rejects a waypoint combined with a course, and out-of-range points", () => {
    const start = fresh();
    const id = attackerDivision(start).tacticalDivisionId;
    const bad = (order: PlayerBattleDivisionOrder): unknown => {
      try {
        advancePlayerBattleMinute(start, { divisions: { [id]: order } });
      } catch (error) {
        return isBluewaveError(error) ? error.context.code : error;
      }
      return null;
    };
    const waypoint = { xMetres: 1_000, yMetres: 0, pauseOnArrival: false };
    expect(bad({ stance: "ENGAGE", speedPercent: 100, courseDeg: 90, waypoint })).not.toBeNull();
    expect(
      bad({
        stance: "ENGAGE",
        speedPercent: 100,
        waypoint: { ...waypoint, xMetres: 9_000_000 },
      }),
    ).not.toBeNull();
    expect(
      bad({ stance: "ENGAGE", speedPercent: 100, waypoint: { ...waypoint, yMetres: 0.5 } }),
    ).not.toBeNull();
  });
});
