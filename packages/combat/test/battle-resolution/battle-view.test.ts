import { describe, expect, it } from "vite-plus/test";
import {
  advancePlayerBattleMinute,
  battleView,
  createPlayerBattleSession,
  playerBattleSessionHash,
  type PlayerBattleOrders,
  type PlayerBattleSession,
} from "@bluewave/combat/battleResolution";
import { createContactTrack } from "@bluewave/combat/contact";
import type { PermanentDivision } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { ATTACKER_NATION, makeAutoInput, makeNations } from "./fixtures.js";

const NO_ORDERS: PlayerBattleOrders = { divisions: {} };
const UM_PER_M = 1_000_000;

function newSession(): PlayerBattleSession {
  return createPlayerBattleSession({ ...makeAutoInput(), playerNationId: ATTACKER_NATION });
}

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

function newDivisionSession(): PlayerBattleSession {
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
    playerNationId: "n-uk",
  });
}

function enemyUnits(session: PlayerBattleSession) {
  return session.units.filter((unit) => unit.sideId === "DEFENDER");
}

function ownPosition(session: PlayerBattleSession): readonly [number, number] {
  const own = session.units.find((unit) => unit.sideId === "ATTACKER")!;
  return session.state.movementStates![own.assetId]!.position;
}

function withContact(
  session: PlayerBattleSession,
  enemyIndex: number,
  offsetM: number,
  overrides: { stale?: boolean; sideId?: string } = {},
): PlayerBattleSession {
  const target = enemyUnits(session)[enemyIndex]!;
  const [x, y] = ownPosition(session);
  const contact = {
    ...createContactTrack({
      battleId: session.battleId,
      assetId: target.assetId,
      sideId: overrides.sideId ?? "DEFENDER",
      estimatedIdentity: target.className,
      position: [x + offsetM * UM_PER_M, y],
      course: 90,
      speedBpKnots: 12_000,
      observationTime: "1880-02-01T06:00:00.000Z",
      minute: session.minute,
    }),
    stale: overrides.stale ?? false,
  };
  return { ...session, state: { ...session.state, contacts: [contact] } };
}

function view(session: PlayerBattleSession) {
  return battleView(session, { pauseReason: null, orders: null });
}

describe("fog: hidden truth never reaches the view", () => {
  it("shows no enemy identity at all while nothing is spotted", () => {
    const session = newSession();
    const json = JSON.stringify(view(session));
    expect(enemyUnits(session).length).toBeGreaterThan(0);
    for (const unit of enemyUnits(session)) {
      expect(json).not.toContain(unit.assetId);
      expect(json).not.toContain(unit.name);
      expect(json).not.toContain(unit.className);
      expect(json).not.toContain(unit.designVersionId);
    }
    expect(view(session).contacts).toEqual([]);
  });

  it("lists only the player's own ships and divisions", () => {
    const session = newSession();
    const own = new Set(
      session.units.filter((unit) => unit.sideId === "ATTACKER").map((unit) => unit.assetId),
    );
    expect(view(session).ships.length).toBe(own.size);
    for (const ship of view(session).ships) expect(own.has(ship.shipId)).toBe(true);
    for (const division of view(session).divisions) {
      for (const shipId of division.shipIds) expect(own.has(shipId)).toBe(true);
    }
  });

  it("withholds the true class of a distant contact", () => {
    const session = withContact(newSession(), 0, 1_000_000);
    const target = enemyUnits(session)[0]!;
    const [contact] = view(session).contacts;
    expect(contact?.tier).toBe("UNIDENTIFIED");
    const json = JSON.stringify(view(session));
    expect(json).not.toContain(target.className);
    expect(json).not.toContain(target.assetId);
    expect(json).not.toContain(target.name);
    expect(contact).not.toHaveProperty("shipType");
    expect(contact).not.toHaveProperty("className");
  });

  it("reveals the type but not the class at TYPE tier", () => {
    const base = newSession();
    const visibleM = Math.floor(base.state.weather.visibilityNm * 1_852);
    const session = withContact(base, 0, Math.floor((visibleM * 4_500) / 10_000));
    const target = enemyUnits(session)[0]!;
    const [contact] = view(session).contacts;
    expect(contact?.tier).toBe("TYPE");
    expect(contact).toHaveProperty("shipType", target.shipType);
    expect(JSON.stringify(view(session))).not.toContain(target.className);
  });

  it("reveals the class only at CLASS tier", () => {
    const session = withContact(newSession(), 0, 100);
    const target = enemyUnits(session)[0]!;
    const [contact] = view(session).contacts;
    expect(contact?.tier).toBe("CLASS");
    expect(contact).toHaveProperty("className", target.className);
    expect(JSON.stringify(view(session))).not.toContain(target.assetId);
    expect(JSON.stringify(view(session))).not.toContain(target.name);
  });

  it("degrades a stale contact to UNIDENTIFIED and reports its age", () => {
    const aged = advancePlayerBattleMinute(newSession(), NO_ORDERS);
    const session = withContact({ ...aged, minute: 5 }, 0, 100, { stale: true });
    const [contact] = view({
      ...session,
      state: {
        ...session.state,
        contacts: session.state.contacts.map((entry) => ({ ...entry, lastUpdateMinute: 2 })),
      },
    }).contacts;
    expect(contact?.tier).toBe("UNIDENTIFIED");
    expect(contact?.stale).toBe(true);
    expect(contact?.ageMinutes).toBe(3);
  });

  it("ignores contacts the enemy holds on the player's ships", () => {
    const base = newSession();
    const own = base.units.find((unit) => unit.sideId === "ATTACKER")!;
    const [x, y] = ownPosition(base);
    const enemyKnowledge = createContactTrack({
      battleId: base.battleId,
      assetId: own.assetId,
      sideId: "ATTACKER",
      estimatedIdentity: own.className,
      position: [x, y],
      course: 0,
      speedBpKnots: 0,
      observationTime: "1880-02-01T06:00:00.000Z",
      minute: 0,
    });
    const session = { ...base, state: { ...base.state, contacts: [enemyKnowledge] } };
    expect(view(session).contacts).toEqual([]);
  });

  it("gives a contact an opaque handle that is stable and not the asset id", () => {
    const session = withContact(newSession(), 0, 100);
    const target = enemyUnits(session)[0]!;
    const [first] = view(session).contacts;
    const [second] = view(session).contacts;
    expect(first?.handle).toBe(second?.handle);
    expect(first?.handle).not.toContain(target.assetId);
    expect(first?.handle.length).toBeGreaterThan(0);
  });

  it("drops log events about ships the player has not spotted", () => {
    let session = newSession();
    for (let step = 0; step < 6; step += 1) {
      session = advancePlayerBattleMinute(session, NO_ORDERS);
    }
    const json = JSON.stringify(view(session).log);
    const known = new Set(
      (session.state.contacts ?? [])
        .filter((contact) => contact.sideId === "DEFENDER")
        .map((contact) => contact.assetId),
    );
    for (const unit of enemyUnits(session)) {
      if (!known.has(unit.assetId)) expect(json).not.toContain(unit.assetId);
    }
    expect(json).not.toContain("obs-");
    expect(json).not.toContain("pipeline");
  });
});

describe("determinism and units", () => {
  it("is a pure function of the session", () => {
    const session = withContact(newSession(), 0, 100);
    const hashBefore = playerBattleSessionHash(session);
    const frozenBefore = JSON.stringify(session.state);
    expect(view(session)).toEqual(view(session));
    expect(JSON.stringify(view(session))).toBe(JSON.stringify(view(session)));
    expect(playerBattleSessionHash(session)).toBe(hashBefore);
    expect(JSON.stringify(session.state)).toBe(frozenBefore);
  });

  it("reports every position in integer metres", () => {
    const session = withContact(newSession(), 0, 100);
    const built = view(session);
    const points = [
      ...built.ships.flatMap((ship) => (ship.positionM === null ? [] : [ship.positionM])),
      ...built.contacts.map((contact) => contact.positionM),
    ];
    expect(points.length).toBeGreaterThan(0);
    for (const point of points) {
      for (const axis of point) expect(Number.isInteger(axis)).toBe(true);
    }
    const [x] = ownPosition(session);
    const first = built.ships.find((ship) => ship.positionM !== null)!;
    expect(first.positionM![0]).toBe(Math.floor(x / UM_PER_M));
  });

  it("floors negative micrometre coordinates toward negative infinity", () => {
    const base = newSession();
    const own = base.units.find((unit) => unit.sideId === "ATTACKER")!;
    const movement = base.state.movementStates![own.assetId]!;
    const session: PlayerBattleSession = {
      ...base,
      state: {
        ...base.state,
        movementStates: {
          ...base.state.movementStates,
          [own.assetId]: { ...movement, position: [-1, -1_500_000] },
        },
      },
    };
    const ship = view(session).ships.find((entry) => entry.shipId === own.assetId)!;
    expect(ship.positionM).toEqual([-1, -2]);
  });
});

describe("own divisions and seams", () => {
  it("carries the pause reason and the order with its planned course ray", () => {
    const session = newDivisionSession();
    const division = session.state.divisions.find((entry) => entry.sideId === "ATTACKER")!;
    const orders: PlayerBattleOrders = {
      divisions: {
        [division.tacticalDivisionId]: { stance: "ENGAGE", speedPercent: 80, courseDeg: 45 },
      },
    };
    const built = battleView(session, { pauseReason: "ENEMY_SIGHTED", orders });
    expect(built.pauseReason).toBe("ENEMY_SIGHTED");
    const own = built.divisions.find((entry) => entry.divisionId === division.tacticalDivisionId)!;
    expect(own.control).toBe("PLAYER");
    expect(own.leadShipId).toBe(division.tacticalFlagshipId);
    expect(own.order?.plannedCourse?.kind).toBe("RAY");
    expect(own.order?.plannedCourse?.headingDeg).toBe(45);
    expect(own.order?.plannedCourse?.crossesLand).toBeNull();
  });

  it("leaves terrain, machinery, turret bearing and force state as typed empty seams", () => {
    const built = view(newSession());
    expect(built.overlays.terrain).toEqual({ land: [], shallows: [], exclusionZones: [] });
    expect(built.overlays.forceState).toBeNull();
    expect(built.friendlyReports).toEqual([]);
    for (const ship of built.ships) {
      expect(ship.machinery).toBeNull();
      expect(ship.turrets).toEqual([]);
      expect(ship.attainableSpeedMilliKnots).toBeNull();
    }
  });

  it("reports no separation flag when the session carries no separation map", () => {
    for (const ship of view(newSession()).ships) {
      expect(ship.separation).toBeNull();
    }
  });

  it("flags a separated or disordered own ship from the session separation map", () => {
    const session = newSession();
    const [first, second] = session.units.filter((unit) => unit.sideId === "ATTACKER");
    const held = {
      formation: "LINE_ABREAST",
      heldHeading: 90,
      heldSpeedBp: 5_000,
      driftMinutes: 3,
    };
    const flagged: PlayerBattleSession = {
      ...session,
      separation: {
        [first!.assetId]: { ...held, separated: true, disordered: false },
        ...(second === undefined
          ? {}
          : { [second.assetId]: { ...held, separated: false, disordered: true } }),
      },
    };
    const ships = view(flagged).ships;
    expect(ships.find((ship) => ship.shipId === first!.assetId)?.separation).toBe("SEPARATED");
    if (second !== undefined) {
      expect(ships.find((ship) => ship.shipId === second.assetId)?.separation).toBe("DISORDERED");
    }
    expect(JSON.stringify(view(flagged))).not.toContain("heldHeading");
  });

  it("explains the own current speed with an explanation tree", () => {
    const ship = view(newSession()).ships.find((entry) => entry.positionM !== null)!;
    expect(ship.speedExplanation?.formulaId).toBe("ship_motion");
  });
});
