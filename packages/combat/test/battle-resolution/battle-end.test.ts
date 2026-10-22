import { describe, it, expect } from "vite-plus/test";
import { BluewaveError, isBluewaveError } from "@bluewave/contracts";
import {
  decideBattleEnd,
  isShipNonViable,
  sideEliminated,
  type ShipViability,
} from "@bluewave/combat/battleResolution";
import { evaluateBattleEnd, DEFAULT_MAX_BATTLE_MINUTES } from "@bluewave/combat/battleResolution";
import { initialDamageState } from "@bluewave/combat/battleResolution";
import { TACTICAL_STATE_INVARIANT_FAILED } from "@bluewave/combat/core";
import type { ShipDamageState } from "@bluewave/combat/damage";

function viable(sideId: "ATTACKER" | "DEFENDER", assetId: string): ShipViability {
  return { assetId, sideId, damageState: initialDamageState(assetId) };
}

function terminal(
  sideId: "ATTACKER" | "DEFENDER",
  assetId: string,
  status: ShipDamageState["terminalStatus"] = "SINKING",
): ShipViability {
  return {
    assetId,
    sideId,
    damageState: { ...initialDamageState(assetId), terminalStatus: status },
  };
}

describe("AC-6/AC-7: battle-end precedence + viability (DESIGN-38 §32)", () => {
  it("time-limit end when nothing lethal happens for the full duration (a)", () => {
    const ships = [
      viable("ATTACKER", "a1"),
      viable("ATTACKER", "a2"),
      viable("DEFENDER", "d1"),
      viable("DEFENDER", "d2"),
    ];
    const decision = decideBattleEnd(ships, DEFAULT_MAX_BATTLE_MINUTES, DEFAULT_MAX_BATTLE_MINUTES);
    expect(decision.ended).toBe(true);
    expect(decision.reason).toBe("time_limit");
    expect(decision.eliminatedSide ?? null).toBeNull();
  });

  it("one side all-terminally-damaged -> no_viable_combatants, other side wins (b)", () => {
    const ships = [
      terminal("DEFENDER", "d1"),
      terminal("DEFENDER", "d2"),
      viable("ATTACKER", "a1"),
      viable("ATTACKER", "a2"),
    ];
    expect(sideEliminated(ships, "DEFENDER")).toBe(true);
    expect(sideEliminated(ships, "ATTACKER")).toBe(false);
    const decision = decideBattleEnd(ships, 47, DEFAULT_MAX_BATTLE_MINUTES);
    expect(decision).toEqual({
      ended: true,
      reason: "no_viable_combatants",
      eliminatedSide: "DEFENDER",
    });
  });

  it("both sides non-viable in the same minute -> deterministic tie (c)", () => {
    const ships = [
      terminal("ATTACKER", "a1"),
      terminal("ATTACKER", "a2"),
      terminal("DEFENDER", "d1"),
      terminal("DEFENDER", "d2"),
    ];
    const decision = decideBattleEnd(ships, 22, DEFAULT_MAX_BATTLE_MINUTES);
    expect(decision.ended).toBe(true);
    expect(decision.reason).toBe("no_viable_combatants");
    expect(decision.eliminatedSide ?? null).toBeNull();
  });

  it("terminating-minute effects count: a kill on the final minute ends with no_viable (d)", () => {
    const ships = [
      viable("ATTACKER", "a1"),
      viable("ATTACKER", "a2"),
      terminal("DEFENDER", "d1"),
      terminal("DEFENDER", "d2"),
    ];
    const decision = decideBattleEnd(ships, DEFAULT_MAX_BATTLE_MINUTES, DEFAULT_MAX_BATTLE_MINUTES);
    expect(decision.ended).toBe(true);
    expect(decision.reason).toBe("no_viable_combatants");
    expect(decision.eliminatedSide ?? null).toBe("DEFENDER");
  });

  it("evaluating the time-limit end before the current minute's effects fail (AC-6)", () => {
    expect(() =>
      evaluateBattleEnd({
        scenarioTerminal: false,
        objectiveImmediateEnd: false,
        mutualDisengagement: false,
        elapsedMinutes: DEFAULT_MAX_BATTLE_MINUTES,
        maxMinutes: DEFAULT_MAX_BATTLE_MINUTES,
        currentMinuteEffectsResolved: false,
      }),
    ).toThrow(BluewaveError);
    let caught: unknown;
    try {
      evaluateBattleEnd({
        scenarioTerminal: false,
        objectiveImmediateEnd: false,
        mutualDisengagement: false,
        elapsedMinutes: DEFAULT_MAX_BATTLE_MINUTES,
        maxMinutes: DEFAULT_MAX_BATTLE_MINUTES,
        currentMinuteEffectsResolved: false,
      });
    } catch (e) {
      caught = e;
    }
    expect(isBluewaveError(caught)).toBe(true);
    expect((caught as BluewaveError).message).toBe(TACTICAL_STATE_INVARIANT_FAILED);
  });

  it("a ship with exhausted structure+flotation but NORMAL status is non-viable", () => {
    const state: ShipDamageState = {
      ...initialDamageState("d1"),
      structuralIntegrity: 0,
      flotationReserve: 0,
    };
    expect(isShipNonViable({ assetId: "d1", sideId: "DEFENDER", damageState: state })).toBe(true);
    const state2: ShipDamageState = {
      ...initialDamageState("d1"),
      structuralIntegrity: 1,
      flotationReserve: 0,
    };
    expect(isShipNonViable({ assetId: "d1", sideId: "DEFENDER", damageState: state2 })).toBe(false);
  });

  it("FOUNDERED is terminal and ends the battle", () => {
    const ships = [viable("ATTACKER", "a1"), terminal("DEFENDER", "d1", "FOUNDERED")];
    expect(sideEliminated(ships, "DEFENDER")).toBe(true);
  });
});
