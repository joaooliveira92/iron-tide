import { describe, expect, it } from "vite-plus/test";
import {
  classifyWithdrawalReason,
  decideBattleEnd,
  shipStrengthBp,
  sideStrengthBp,
  sideWithdraws,
  type ShipViability,
} from "@bluewave/combat/battleResolution";
import {
  FLOAT_UNIT,
  STRUCTURE_UNIT,
  WITHDRAWAL_STRENGTH_THRESHOLD_BP,
  SHIPPED_BATTLE_AUTO_RESOLUTION_V1,
  validateBattleAutoResolutionContract,
} from "@bluewave/combat/battleResolution";
import { initialDamageState } from "@bluewave/combat/battleResolution";
import {
  DEFAULT_MAX_BATTLE_MINUTES,
  BATTLE_END_PRECEDENCE,
} from "@bluewave/combat/battleResolution";

function atBp(sideId: "ATTACKER" | "DEFENDER", assetId: string, bp: number): ShipViability {
  return {
    assetId,
    sideId,
    damageState: {
      ...initialDamageState(assetId),
      structuralIntegrity: Math.floor((STRUCTURE_UNIT * bp) / 10_000),
      flotationReserve: Math.floor((FLOAT_UNIT * bp) / 10_000),
    },
  };
}
const T = WITHDRAWAL_STRENGTH_THRESHOLD_BP;
const decide = (ships: ShipViability[], minute = 30) =>
  decideBattleEnd(ships, minute, DEFAULT_MAX_BATTLE_MINUTES);

describe("ADR-0073 withdrawal predicate", () => {
  it("the shipped threshold is 2000 bp and is part of the validated contract", () => {
    expect(T).toBe(2_000);
    expect(SHIPPED_BATTLE_AUTO_RESOLUTION_V1.withdrawalStrengthThresholdBp).toBe(T);
    expect(() =>
      validateBattleAutoResolutionContract(SHIPPED_BATTLE_AUTO_RESOLUTION_V1),
    ).not.toThrow();
    expect(() =>
      validateBattleAutoResolutionContract({
        ...SHIPPED_BATTLE_AUTO_RESOLUTION_V1,
        withdrawalStrengthThresholdBp: T + 1,
      }),
    ).toThrow();
    expect(BATTLE_END_PRECEDENCE).toContain("withdrawal_complete");
    expect(BATTLE_END_PRECEDENCE).toContain("mutual_disengagement");
  });

  it("ship and side strength are integer bp; terminal ships count zero", () => {
    expect(shipStrengthBp(atBp("ATTACKER", "a", 10_000))).toBe(10_000);
    expect(shipStrengthBp(atBp("ATTACKER", "a", 4_000))).toBe(4_000);
    const dead: ShipViability = {
      assetId: "a2",
      sideId: "ATTACKER",
      damageState: { ...initialDamageState("a2"), terminalStatus: "SINKING" },
    };
    expect(shipStrengthBp(dead)).toBe(0);
    expect(sideStrengthBp([atBp("ATTACKER", "a1", 10_000), dead], "ATTACKER")).toBe(5_000);
  });

  it("boundary: exactly at the threshold stays; one bp below breaks off", () => {
    const at = [atBp("ATTACKER", "a1", T), atBp("DEFENDER", "d1", 10_000)];
    expect(sideStrengthBp(at, "ATTACKER")).toBe(T);
    expect(sideWithdraws(at, "ATTACKER")).toBe(false);
    expect(decide(at).ended).toBe(false);

    const below = [atBp("ATTACKER", "a1", T - 1), atBp("DEFENDER", "d1", 10_000)];
    expect(sideWithdraws(below, "ATTACKER")).toBe(true);
    expect(decide(below)).toEqual({
      ended: true,
      reason: "withdrawal_complete",
      eliminatedSide: null,
      withdrawnSide: "ATTACKER",
      withdrawalReason: "FLEET_STRENGTH_FLOODING",
    });
  });

  it("the defender can withdraw; fresh fleets never do", () => {
    const ships = [atBp("ATTACKER", "a1", 9_000), atBp("DEFENDER", "d1", 500)];
    expect(decide(ships)).toMatchObject({
      reason: "withdrawal_complete",
      withdrawnSide: "DEFENDER",
    });
    expect(decide([atBp("ATTACKER", "a1", 10_000), atBp("DEFENDER", "d1", 10_000)]).ended).toBe(
      false,
    );
  });

  it("fleet strength is a mean: one healthy ship keeps a fleet in the fight", () => {
    const ships = [
      atBp("ATTACKER", "a1", 10_000),
      atBp("ATTACKER", "a2", 500),
      atBp("DEFENDER", "d1", 10_000),
    ];
    expect(sideStrengthBp(ships, "ATTACKER")).toBe(5_250);
    expect(decide(ships).ended).toBe(false);
  });

  it("both sides below the threshold -> mutual_disengagement, no withdrawn side", () => {
    const d = decide([atBp("ATTACKER", "a1", 1_000), atBp("DEFENDER", "d1", 1_500)]);
    expect(d).toEqual({
      ended: true,
      reason: "mutual_disengagement",
      eliminatedSide: null,
      withdrawalReason: "MUTUAL_DISENGAGEMENT",
    });
    expect(d.withdrawnSide).toBeUndefined();
  });

  it("classifies the withdrawal reason from the dominant loss", () => {
    expect(classifyWithdrawalReason([atBp("ATTACKER", "a1", 1_000)], "ATTACKER")).toBe(
      "FLEET_STRENGTH_FLOODING",
    );
    const burning: ShipViability = {
      assetId: "a1",
      sideId: "ATTACKER",
      damageState: {
        ...initialDamageState("a1"),
        structuralIntegrity: Math.floor(STRUCTURE_UNIT / 4),
        fireRecords: [{ locationId: "BELT", intensityBp: 5_000, cause: "FIRE_SOURCE_CREATED" }],
      },
    };
    expect(classifyWithdrawalReason([burning], "ATTACKER")).toBe("FLEET_STRENGTH_FIRE");
    const holed: ShipViability = {
      assetId: "a1",
      sideId: "ATTACKER",
      damageState: {
        ...initialDamageState("a1"),
        structuralIntegrity: Math.floor(STRUCTURE_UNIT / 4),
      },
    };
    expect(classifyWithdrawalReason([holed], "ATTACKER")).toBe("FLEET_STRENGTH_GUNFIRE");
  });

  it("precedence: elimination beats withdrawal; withdrawal beats time_limit", () => {
    const sunk: ShipViability = {
      assetId: "d1",
      sideId: "DEFENDER",
      damageState: { ...initialDamageState("d1"), terminalStatus: "SINKING" },
    };
    expect(decide([atBp("ATTACKER", "a1", 100), sunk])).toEqual({
      ended: true,
      reason: "no_viable_combatants",
      eliminatedSide: "DEFENDER",
    });
    expect(
      decideBattleEnd(
        [atBp("ATTACKER", "a1", 100), atBp("DEFENDER", "d1", 10_000)],
        DEFAULT_MAX_BATTLE_MINUTES,
        DEFAULT_MAX_BATTLE_MINUTES,
      ).reason,
    ).toBe("withdrawal_complete");
  });

  it("an empty side fails closed", () => {
    expect(() => sideStrengthBp([atBp("ATTACKER", "a1", 10_000)], "DEFENDER")).toThrow();
  });
});
