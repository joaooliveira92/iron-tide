import { describe, expect, it } from "vite-plus/test";
import {
  BATTLE_AUTO_RESOLUTION_FAILED,
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  battleView,
  playerBattleSessionHash,
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

function view(session: PlayerBattleSession) {
  return battleView(session, { pauseReason: null, orders: null });
}

function divisionId(session: PlayerBattleSession): string {
  return view(session).divisions[0]!.divisionId;
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
  const own = view(session);
  const members = new Set(own.divisions[0]!.shipIds);
  return own.ships.filter((ship) => members.has(ship.shipId));
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
  it("projects an integer heading and a speed on every own ship", () => {
    const ships = view(newSession()).ships;
    expect(ships.length).toBeGreaterThan(0);
    for (const ship of ships) {
      expect(Number.isInteger(ship.headingDeg)).toBe(true);
      expect(ship.headingDeg).toBeGreaterThanOrEqual(0);
      expect(ship.headingDeg).toBeLessThan(360);
      expect(Number.isInteger(ship.currentSpeedMilliKnots)).toBe(true);
    }
  });

  it("turns a division onto an ordered course", () => {
    const start = newSession();
    const target = ((ownShips(start)[0]!.headingDeg ?? 0) + 90) % 360;
    const after = run(start, order(start, { courseDeg: target }), 20);
    for (const ship of ownShips(after)) expect(ship.headingDeg).toBe(target);
  });

  it("settles a division at an ordered speed in knots", () => {
    const start = newSession();
    const after = run(start, order(start, { courseDeg: 90, speedKnots: 6 }), 20);
    for (const ship of ownShips(after)) {
      expect(ship.currentSpeedMilliKnots).toBeLessThanOrEqual(6_000);
    }
    expect(Math.max(...ownShips(after).map((ship) => ship.currentSpeedMilliKnots ?? 0))).toBe(
      6_000,
    );
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

  it("explains the speed on every own ship", () => {
    const ships = view(run(newSession(), { divisions: {} }, 2)).ships;
    expect(ships.length).toBeGreaterThan(0);
    for (const ship of ships) expect(ship.speedExplanation?.formulaId).toBe("ship_motion");
  });
});

describe("own movement projection", () => {
  it("withholds hostile movement while no contact is held and keeps own movement exact", () => {
    const session = newSession();
    expect(session.state.contacts ?? []).toEqual([]);
    const built = view(session);
    expect(built.contacts).toEqual([]);
    for (const ship of built.ships) expect(ship.positionM).not.toBeNull();
  });
});

describe("breaking contact by course order", () => {
  it.each([0, 90, 180, 270])(
    "keeps stepping when the division steers %i degrees away for two hours",
    (courseDeg) => {
      let session = newSession();
      const orders = order(session, { courseDeg, speedKnots: 20 });
      for (let minute = 0; minute < 120 && !session.ended; minute += 1) {
        session = advancePlayerBattleMinute(session, orders);
      }
      expect(session.minute).toBeGreaterThan(0);
    },
  );
});

describe("a contact that lapses between minutes", () => {
  it("is dropped as a target instead of failing the step", () => {
    let session = newSession();
    for (let minute = 0; minute < 6; minute += 1) {
      session = advancePlayerBattleMinute(session, { divisions: {} });
    }
    const contacts = session.state.contacts ?? [];
    expect(contacts.length).toBeGreaterThan(0);
    const ownIds = new Set(view(session).ships.map((ship) => ship.shipId));
    const movement = Object.fromEntries(
      Object.entries(session.state.movementStates ?? {}).map(([id, state]) => [
        id,
        ownIds.has(id)
          ? {
              ...state,
              position: [state.position[0] + 9e11, state.position[1]] as [number, number],
            }
          : state,
      ]),
    );
    const brink = {
      ...session,
      state: {
        ...session.state,
        movementStates: movement,
        contacts: contacts.map((contact) => ({ ...contact, confidence: 1 })),
      },
    };
    expect(() => advancePlayerBattleMinute(brink, { divisions: {} })).not.toThrow();
  });
});
