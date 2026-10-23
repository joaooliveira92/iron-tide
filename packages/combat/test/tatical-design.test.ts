import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  BATTLE_END_PRECEDENCE,
  BattleLedger,
  DEFAULT_MAX_BATTLE_MINUTES,
  type BattleEvent,
} from "@bluewave/combat/battleResolution";
import {
  substepsPerTurn,
  tacticalSubstepMilliseconds,
  tacticalTimePolicyId,
  tacticalTurnMilliseconds,
  validateTargetOrder,
  validateTacticalTimeContract,
} from "@bluewave/combat/tactical";

describe("DESIGN-38 focused", () => {
  it("1-2: turn 60_000, substep 1_000, 60/substep, policy tactical_time_v1, modulus 0", () => {
    expect(tacticalTurnMilliseconds).toBe(60_000);
    expect(tacticalSubstepMilliseconds).toBe(1_000);
    expect(substepsPerTurn).toBe(60);
    expect(tacticalTimePolicyId).toBe("tactical_time_v1");
    expect(tacticalTurnMilliseconds % tacticalSubstepMilliseconds).toBe(0);
    expect(() => validateTacticalTimeContract(null)).toThrow(BluewaveError);
    expect(() => validateTacticalTimeContract({ tacticalTurnMilliseconds: 60_001 })).toThrow(
      /INVALID_TACTICAL_TIME_CONTRACT/,
    );
  });
  it("16: fog-of-war leak -> TACTICAL_FOG_OF_WAR_VIOLATION", () => {
    expect(() => validateTargetOrder("unknown", new Map())).toThrow(
      /TACTICAL_FOG_OF_WAR_VIOLATION/,
    );
  });
  it("29-30: battle-end precedence 6, default 360m", () => {
    expect(DEFAULT_MAX_BATTLE_MINUTES).toBe(360);
    expect(BATTLE_END_PRECEDENCE).toEqual([
      "scenario_terminal",
      "no_viable_combatants",
      "objective_immediate",
      "withdrawal_complete",
      "mutual_disengagement",
      "time_limit",
    ]);
  });
  it("34-35: ledger canonical order minute,substep,priority,actor,target,event, identical seed identical hash", () => {
    const l1 = new BattleLedger();
    const l2 = new BattleLedger();
    const e: BattleEvent = {
      battleId: "b1",
      minute: 0,
      substep: 1,
      eventPriority: 1,
      actorId: "a",
      targetId: "t",
      eventId: "e1",
      eventType: "x",
    };
    l1.append(e);
    l2.append(e);
    expect(l1.hash()).toBe(l2.hash());
    const l = new BattleLedger();
    l.append({ ...e, minute: 1, eventId: "e2" });
    l.append({ ...e, minute: 0, eventId: "e1" });
    expect(l.sorted()[0].eventId).toBe("e1");
  });
});
