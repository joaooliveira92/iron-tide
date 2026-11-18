import { describe, expect, it } from "vite-plus/test";
import type { PermanentDivision } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import {
  advancePlayerBattleMinute,
  createPlayerBattleSession,
  enablePlayerForceOrders,
  playerBattleSessionHash,
  runPlayerBattleToEnd,
  type PlayerBattleOrders,
  type PlayerBattleSession,
} from "@bluewave/combat/battleResolution";
import {
  FORCE_ORDER_VERSION,
  PROVISIONAL_FORCE_ORDER_RULESET,
  type ForceOrder,
} from "@bluewave/combat/orders";
import { makeAutoInput, makeNations } from "./fixtures.js";

function division(
  divisionId: string,
  nationId: string,
  shipOrder: string[],
  divisionRole: PermanentDivision["divisionRole"],
): PermanentDivision {
  return {
    divisionId,
    nationId,
    shipOrder,
    flagshipShipId: shipOrder[0]!,
    commanderOfficerId: "VACANT",
    divisionRole,
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
          divisions: [
            division("div-a1", "n-uk", ["a1"], "INDEPENDENT"),
            division("div-a2", "n-uk", ["a2"], "CORE"),
          ],
        },
        defender: {
          ...nations.defender,
          divisions: [division("div-d", "n-fr", ["d1", "d2"], "CORE")],
        },
      },
    }),
    playerNationId: "n-uk",
  });
}

function tacticalId(session: PlayerBattleSession, divisionId: string): string {
  return `${session.battleId}:${divisionId}`;
}

function withForceOrders(...orders: ForceOrder[]): PlayerBattleOrders {
  return { divisions: {}, forceOrders: { version: FORCE_ORDER_VERSION, orders } };
}

function outcomeHash(session: PlayerBattleSession): string {
  const { force: _force, ...rest } = session;
  return playerBattleSessionHash(rest);
}

describe("player session force orders", () => {
  it("is dormant until enabled: no force state and an unchanged hash", () => {
    const plain = runPlayerBattleToEnd(newSession(), { divisions: {} });
    expect(plain.force).toBeUndefined();
    const ignored = runPlayerBattleToEnd(newSession(), withForceOrders());
    expect(playerBattleSessionHash(ignored)).toBe(playerBattleSessionHash(plain));
  });

  it("changes no battle outcome when enabled with no force orders", () => {
    const plain = runPlayerBattleToEnd(newSession(), { divisions: {} });
    const enabled = runPlayerBattleToEnd(
      enablePlayerForceOrders(newSession(), { realismMode: "ADMIRAL" }),
      { divisions: {} },
    );
    expect(outcomeHash(enabled)).toBe(playerBattleSessionHash(plain));
    expect(enabled.force?.runtime.state.moraleBp).toBe(
      PROVISIONAL_FORCE_ORDER_RULESET.neutralMoraleBp,
    );
  });

  it("applies a rally and a lead change once while the same orders are resent", () => {
    const orders = withForceOrders(
      { forceId: "ATTACKER", kind: "RALLY", issuedAtMinute: 1 },
      {
        forceId: "ATTACKER",
        kind: "CHANGE_LEAD_DIVISION",
        divisionId: tacticalId(newSession(), "div-a2"),
        issuedAtMinute: 2,
      },
      { forceId: "ATTACKER", kind: "FLOTILLA_ATTACK", issuedAtMinute: 2 },
    );
    let session = enablePlayerForceOrders(newSession(), { realismMode: "CAPTAIN" });
    const morale: number[] = [];
    for (let minute = 0; minute < 4; minute += 1) {
      session = advancePlayerBattleMinute(session, orders);
      morale.push(session.force!.runtime.state.moraleBp);
    }
    const neutral = PROVISIONAL_FORCE_ORDER_RULESET.neutralMoraleBp;
    expect(morale[0]).toBe(neutral);
    expect(morale[1]).toBeGreaterThan(neutral);
    expect(morale[2]).toBeLessThan(morale[1]!);
    const force = session.force!;
    expect(force.runtime.state).toMatchObject({
      leadChangeUsed: true,
      flotillaAttackActive: true,
      turnAwayUsed: false,
    });
    expect(force.runtime.lead?.divisionId).toBe(tacticalId(session, "div-a2"));
    expect(force.lastIssues).toEqual([]);

    const plain = runPlayerBattleToEnd(newSession(), { divisions: {} });
    const forced = runPlayerBattleToEnd(
      enablePlayerForceOrders(newSession(), { realismMode: "CAPTAIN" }),
      orders,
    );
    expect(outcomeHash(forced)).toBe(playerBattleSessionHash(plain));
    expect(playerBattleSessionHash(forced)).not.toBe(playerBattleSessionHash(plain));
  });

  it("reports a second lead change as an issue and keeps the first", () => {
    let session = enablePlayerForceOrders(newSession(), { realismMode: "ADMIRAL" });
    const second = tacticalId(session, "div-a2");
    const first = tacticalId(session, "div-a1");
    session = advancePlayerBattleMinute(
      session,
      withForceOrders({
        forceId: "ATTACKER",
        kind: "CHANGE_LEAD_DIVISION",
        divisionId: second,
        issuedAtMinute: 0,
      }),
    );
    session = advancePlayerBattleMinute(
      session,
      withForceOrders({
        forceId: "ATTACKER",
        kind: "CHANGE_LEAD_DIVISION",
        divisionId: first,
        issuedAtMinute: 1,
      }),
    );
    expect(session.force?.lastIssues.map((issue) => issue.code)).toEqual([
      "FORCE_ORDER_LEAD_CHANGE_USED",
    ]);
    expect(session.force?.runtime.lead?.divisionId).toBe(second);
  });
});
