import { describe, expect, it } from "vite-plus/test";
import type { PermanentDivision } from "@bluewave/campaign";
import { SafeInt, isBluewaveError } from "@bluewave/contracts";
import {
  advancePlayerBattleMinute,
  contactHandle,
  createPlayerBattleSession,
  enablePlayerForceOrders,
  playerBattleSessionHash,
  runPlayerBattle,
  type PlayerBattleOrders,
  type PlayerBattleSession,
} from "@bluewave/combat/battleResolution";
import { ORDER_NOT_PERMITTED_AT_REALISM } from "@bluewave/combat/orders";
import { ATTACKER_NATION, makeAutoInput, makeNations } from "./fixtures.js";

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

function fresh(): PlayerBattleSession {
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
  });
}

function attackerDivision(session: PlayerBattleSession) {
  const division = session.state.divisions.find((candidate) => candidate.sideId === "ATTACKER");
  if (division === undefined) throw new Error("fixture has no attacker division");
  return division;
}

function ordersWith(session: PlayerBattleSession, targetAssetId?: string): PlayerBattleOrders {
  return {
    divisions: {
      [attackerDivision(session).tacticalDivisionId]: {
        stance: "ENGAGE",
        speedPercent: 100,
        ...(targetAssetId === undefined
          ? {}
          : { targetHandle: contactHandle(session.battleId, targetAssetId) }),
      },
    },
  };
}

function sighted(): PlayerBattleSession {
  const start = fresh();
  return runPlayerBattle(start, ordersWith(start), {
    mode: { kind: "RUN_UNTIL_EVENT" },
    pauseOn: ["ENEMY_SIGHTED"],
    runCapMinutes: 60,
  }).session;
}

function enemyAssetIds(session: PlayerBattleSession): readonly string[] {
  const prefix = `${session.battleId}:`;
  return (session.state.contacts ?? [])
    .map((contact) => contact.contactId)
    .filter((id) => id.startsWith(prefix))
    .map((id) => id.slice(prefix.length))
    .filter((id) => session.units.find((unit) => unit.assetId === id)?.sideId === "DEFENDER")
    .sort();
}

function attackerTargets(session: PlayerBattleSession): readonly string[] {
  const own = new Set(attackerDivision(session).orderedTacticalUnitIds);
  return session.batteries
    .filter((battery) => own.has(battery.ownerShipId))
    .map((battery) => battery.state.targetContactId);
}

describe("division target orders", () => {
  it("fires on the ordered contact where the automatic choice would pick another", () => {
    const session = sighted();
    const enemies = enemyAssetIds(session);
    expect(enemies.length).toBeGreaterThan(1);
    const automatic = attackerTargets(advancePlayerBattleMinute(session, ordersWith(session)));
    const other = enemies.find((id) =>
      automatic.some((target) => target !== `${session.battleId}:${id}`),
    );
    expect(other).toBeDefined();
    const ordered = attackerTargets(advancePlayerBattleMinute(session, ordersWith(session, other)));
    expect(new Set(ordered)).toEqual(new Set([`${session.battleId}:${other}`]));
  });

  it("leaves the session hash unchanged when no target is ordered", () => {
    const session = sighted();
    const plain = advancePlayerBattleMinute(session, ordersWith(session));
    const again = advancePlayerBattleMinute(session, ordersWith(session));
    expect(playerBattleSessionHash(again)).toBe(playerBattleSessionHash(plain));
  });

  it("is deterministic for the same target order", () => {
    const session = sighted();
    const target = enemyAssetIds(session)[0]!;
    const first = advancePlayerBattleMinute(session, ordersWith(session, target));
    const second = advancePlayerBattleMinute(session, ordersWith(session, target));
    expect(playerBattleSessionHash(second)).toBe(playerBattleSessionHash(first));
  });

  it("rejects a handle that does not name an enemy", () => {
    const session = sighted();
    const own = attackerDivision(session).orderedTacticalUnitIds[0]!;
    expect(() => advancePlayerBattleMinute(session, ordersWith(session, own))).toThrow();
    expect(() => advancePlayerBattleMinute(session, ordersWith(session, "nobody"))).toThrow();
  });

  it("is refused at Admiral and permitted at Rear Admiral", () => {
    const base = sighted();
    const target = enemyAssetIds(base)[0]!;
    const admiral = enablePlayerForceOrders(base, { realismMode: "ADMIRAL" });
    let caught: unknown;
    try {
      advancePlayerBattleMinute(admiral, ordersWith(admiral, target));
    } catch (error) {
      caught = error;
    }
    expect(isBluewaveError(caught) ? caught.context.code : caught).toBe(
      ORDER_NOT_PERMITTED_AT_REALISM,
    );
    const rear = enablePlayerForceOrders(base, { realismMode: "REAR_ADMIRAL" });
    expect(() => advancePlayerBattleMinute(rear, ordersWith(rear, target))).not.toThrow();
  });
});
