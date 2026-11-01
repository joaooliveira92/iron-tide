import { describe, expect, it } from "vite-plus/test";
import {
  BATTLE_AUTO_RESOLUTION_FAILED,
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  playerBattleSessionHash,
  playerBattleView,
  type PlayerBattleOrders,
  type PlayerBattleSession,
} from "@bluewave/combat/battleResolution";
import { BluewaveError, isBluewaveError, SafeInt } from "@bluewave/contracts";
import type { PermanentDivision } from "@bluewave/campaign";
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
    playerNationId: ATTACKER_NATION,
  });
}

function divisionId(session: PlayerBattleSession): string {
  const own = playerBattleView(session).divisions.find((entry) => entry.sideId === "ATTACKER");
  return own!.divisionId;
}

function order(
  session: PlayerBattleSession,
  patch: { courseDeg?: number; speedKnots?: number },
): PlayerBattleOrders {
  return {
    divisions: {
      [divisionId(session)]: { stance: "ENGAGE", speedPercent: 100, ...patch },
    },
  };
}

function run(
  session: PlayerBattleSession,
  orders: PlayerBattleOrders,
  minutes: number,
): PlayerBattleSession {
  let current = session;
  for (let minute = 0; minute < minutes; minute += 1) {
    current = advancePlayerBattleMinute(current, orders);
  }
  return current;
}

function ownShips(session: PlayerBattleSession) {
  const view = playerBattleView(session);
  const members = new Set(view.divisions.find((entry) => entry.sideId === "ATTACKER")!.unitIds);
  return view.ships.filter((ship) => members.has(ship.shipId));
}

function capture(task: () => unknown): BluewaveError {
  try {
    task();
  } catch (error) {
    if (isBluewaveError(error)) return error;
    throw error;
  }
  throw new Error("expected the call to throw");
}

describe("real-time tactical orders", () => {
  it("projects an integer heading and a speed on every ship", () => {
    const ships = playerBattleView(newSession()).ships;
    expect(ships.length).toBeGreaterThan(0);
    for (const ship of ships) {
      expect(Number.isInteger(ship.headingDeg)).toBe(true);
      expect(ship.headingDeg).toBeGreaterThanOrEqual(0);
      expect(ship.headingDeg).toBeLessThan(360);
      expect(Number.isInteger(ship.speedBp)).toBe(true);
    }
  });

  it("turns a division onto an ordered course", () => {
    const start = newSession();
    const target = (ownShips(start)[0]!.headingDeg + 90) % 360;
    const after = run(start, order(start, { courseDeg: target }), 20);
    for (const ship of ownShips(after)) expect(ship.headingDeg).toBe(target);
  });

  it("settles a division at an ordered speed in knots", () => {
    const start = newSession();
    const after = run(start, order(start, { courseDeg: 90, speedKnots: 6 }), 20);
    for (const ship of ownShips(after)) expect(ship.speedBp).toBeLessThanOrEqual(6_000);
    expect(Math.max(...ownShips(after).map((ship) => ship.speedBp))).toBe(6_000);
  });

  it("changes the canonical hash when a course is ordered", () => {
    const start = newSession();
    const plain = run(start, order(start, {}), 5);
    const steered = run(start, order(start, { courseDeg: 270 }), 5);
    expect(playerBattleSessionHash(steered)).not.toBe(playerBattleSessionHash(plain));
  });

  it("reproduces identical hashes from identical ordered steps", () => {
    const first = newSession();
    const second = newSession();
    const orders = order(first, { courseDeg: 45, speedKnots: 9 });
    expect(playerBattleSessionHash(run(first, orders, 12))).toBe(
      playerBattleSessionHash(run(second, orders, 12)),
    );
  });

  it("is unchanged by orders that carry no course or speed", () => {
    const start = newSession();
    const legacy = run(start, { divisions: {} }, 6);
    const explicit = run(start, order(start, {}), 6);
    expect(playerBattleSessionHash(explicit)).toBe(playerBattleSessionHash(legacy));
  });

  it("rejects a course outside 0 to 359 or off the integer grid", () => {
    const start = newSession();
    for (const courseDeg of [-1, 360, 1.5, Number.NaN]) {
      const failure = capture(() => advancePlayerBattleMinute(start, order(start, { courseDeg })));
      expect(failure.context.code).toBe(BATTLE_AUTO_RESOLUTION_FAILED);
    }
  });

  it("rejects a speed that is not a positive whole number of knots", () => {
    const start = newSession();
    for (const speedKnots of [0, -3, 2.5, Number.NaN]) {
      const failure = capture(() => advancePlayerBattleMinute(start, order(start, { speedKnots })));
      expect(failure.context.code).toBe(BATTLE_AUTO_RESOLUTION_FAILED);
    }
  });

  it("explains the speed and heading only on the player's own ships", () => {
    const ships = playerBattleView(run(newSession(), { divisions: {} }, 2)).ships;
    for (const ship of ships) {
      if (ship.sideId === "ATTACKER") {
        expect(ship.motion?.formulaId).toBe("ship_motion");
      } else {
        expect(ship).not.toHaveProperty("motion");
      }
    }
  });
});
