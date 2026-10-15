import { describe, it, expect } from "vite-plus/test";
import { resolveBattleAuto } from "../../src/battleResolution/resolve.js";
import { decideBattleEnd, type ShipViability } from "../../src/battleResolution/viability.js";
import { battleLoss, hpOfState } from "../../src/battleResolution/damage.js";
import { initialDamageState } from "../../src/battleResolution/damage.js";
import type { ShipDamageState } from "../../src/damage/state.js";
import { DEFAULT_MAX_BATTLE_MINUTES } from "../../src/battleEnd.js";
import { makeAutoInput } from "./fixtures.js";

describe("AC-7: winner/loser viability rule", () => {
  it("withdrawing side loses: winner is the other nation, loser keeps its survivors (ADR-0073)", () => {
    // ADR-0098: the default fixture now resolves by fleet-strength withdrawal
    // (post caliber correction + lethality rebalance). This seed withdraws with
    // no ship sunk, so the winner/loser rule is exercised in isolation. The
    // winner/loser rule under test is unchanged.
    const input = { ...makeAutoInput(), campaignSeed: "cause-1" };
    const result = resolveBattleAuto(input);
    expect(result.battleEndReason).toBe("withdrawal_complete");
    expect([input.attacker.nationId, input.defender.nationId]).toContain(result.winnerId);

    const loserNation =
      result.winnerId === input.attacker.nationId
        ? input.defender.nationId
        : input.attacker.nationId;
    expect(result.loserId).toBe(loserNation);

    const loserSurvivors =
      result.winnerId === input.attacker.nationId
        ? result.defenderSurvivorIds
        : result.attackerSurvivorIds;
    expect(loserSurvivors.length).toBeGreaterThan(0);
    const loserSunk =
      result.winnerId === input.attacker.nationId ? result.defenderSunkIds : result.attackerSunkIds;
    expect(loserSunk).toHaveLength(0);
  });

  it("eliminated side = non-viable; winner formation is a pure function of the seed", () => {
    // same input twice -> same winner/loser, byte-identical
    const a = resolveBattleAuto(makeAutoInput());
    const b = resolveBattleAuto(makeAutoInput());
    expect(a.winnerId).toBe(b.winnerId);
    expect(a.loserId).toBe(b.loserId);
    expect(a.battleEndReason).toBe(b.battleEndReason);
  });

  it("both-non-viable tie -> reason no_viable_combatants with null winner (decision level)", () => {
    const ships: ShipViability[] = [
      {
        assetId: "a1",
        sideId: "ATTACKER",
        damageState: { ...initialDamageState("a1"), terminalStatus: "SINKING" as const },
      },
      {
        assetId: "a2",
        sideId: "ATTACKER",
        damageState: { ...initialDamageState("a2"), terminalStatus: "FOUNDERED" as const },
      },
      {
        assetId: "d1",
        sideId: "DEFENDER",
        damageState: { ...initialDamageState("d1"), terminalStatus: "SINKING" as const },
      },
      {
        assetId: "d2",
        sideId: "DEFENDER",
        damageState: { ...initialDamageState("d2"), terminalStatus: "SINKING" as const },
      },
    ];
    const decision = decideBattleEnd(ships, 30, DEFAULT_MAX_BATTLE_MINUTES);
    expect(decision).toEqual({ ended: true, reason: "no_viable_combatants", eliminatedSide: null });
  });

  it("damageReport = accumulated hp loss; a sunk ship reports its whole battle hp", () => {
    const state = initialDamageState("d1");
    const sinking: ShipDamageState = { ...state, terminalStatus: "SINKING", flotationReserve: 0 };
    expect(hpOfState(sinking, 100)).toBe(0 as never);
    expect(battleLoss(100, sinking, 100)).toBe(100 as never);

    const damaged: ShipDamageState = {
      ...state,
      structuralIntegrity: Math.floor(state.structuralIntegrity / 2),
      flotationReserve: Math.floor(state.flotationReserve / 2),
    };
    const partial = battleLoss(100, damaged, 100) as number;
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(100);
    expect(Number.isInteger(partial)).toBe(true);
  });
});
