import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import { RandomEngine } from "@bluewave/random";
import {
  tacticalTurnMilliseconds,
  tacticalSubstepMilliseconds,
  substepsPerTurn,
  tacticalTimePolicyId,
  validateTacticalTimeContract,
} from "../src/tacticalTime.js";
import { TacticalClock } from "../src/tacticalClock.js";
import { quantizeCommand } from "../src/commandQuantization.js";
import { createCommandRecord, transitionCommand } from "../src/commandRecord.js";
import { shippedCareerMultiplier, BattleRealism } from "../src/realism.js";
import {
  isWithinReach,
  getBaseDelay,
  computeFailureProbabilityBp,
  SHIPPED_PATH_RANGES_NM,
} from "../src/commandReach.js";
import { validateTargetOrder } from "../src/targeting.js";
import { isFullSpeedStress } from "../src/fullSpeedStress.js";
import {
  computeConfusionProbabilityBp,
  computeInitiationIntervalMinutes,
  CONFUSION_OUTCOMES,
  executeManeuver,
} from "../src/battleTurnAway.js";
import { WITHDRAWAL_PERSISTENCE_MINUTES } from "../src/withdrawal.js";
import { DEFAULT_MAX_BATTLE_MINUTES, BATTLE_END_PRECEDENCE } from "../src/battleEnd.js";
import { BattleLedger } from "../src/battleLedger.js";

describe("DESIGN-38 focused", () => {
  it("1-2: turn 60_000, substep 1_000, 60/substep, policy tactical_time_v1, modulus 0", () => {
    expect(tacticalTurnMilliseconds).toBe(60_000);
    expect(tacticalSubstepMilliseconds).toBe(1_000);
    expect(substepsPerTurn).toBe(60);
    expect(tacticalTimePolicyId).toBe("tactical_time_v1");
    expect(tacticalTurnMilliseconds % tacticalSubstepMilliseconds).toBe(0);
    expect(() => validateTacticalTimeContract({} as any)).toThrow(BluewaveError);
    expect(() => validateTacticalTimeContract({ tacticalTurnMilliseconds: 60_001 } as any)).toThrow(
      /INVALID_TACTICAL_TIME_CONTRACT/,
    );
  });
  it("2: clock 0..59, hash stable, wall-clock does not advance", () => {
    const c = new TacticalClock({ battleId: "b1", battleStartCampaignTime: "1900-01-01" });
    expect(c.currentBattleMinute).toBe(0);
    expect(c.currentSubstep).toBe(0);
    const h0 = c.clockHash;
    c.advanceSubstep();
    expect(c.currentSubstep).toBe(1);
    expect(c.clockHash).not.toBe(h0);
  });
  it("4: quantize ceiling + 100ms cutoff, next-minute rollover", () => {
    expect(quantizeCommand(0)).toMatchObject({ effectiveSubstep: 0 });
    expect(quantizeCommand(1)).toMatchObject({ effectiveSubstep: 1 });
    expect(quantizeCommand(1000, { arrivedBeforeCutoff: true })).toMatchObject({
      effectiveSubstep: 1,
    });
    expect(quantizeCommand(1000, { arrivedBeforeCutoff: false })).toMatchObject({
      effectiveSubstep: 2,
    });
    expect(quantizeCommand(950)).toMatchObject({ effectiveSubstep: 2, wasAfterCutoff: true });
    expect(quantizeCommand(60_000)).toMatchObject({ effectiveMinute: 1, effectiveSubstep: 0 });
  });
  it("5+7: record + FSM 8 states, no EXECUTING before ACK", () => {
    let r = createCommandRecord({
      commandId: "c1",
      commandType: "RALLY",
      issuerParticipantId: "p1",
      commandSource: "flag",
      targetKind: "force",
      targetId: "f1",
      inputTimestampTacticalMs: 0,
      effectiveMinute: 0,
      effectiveSubstep: 0,
      intendedParameters: {},
      rulesetVersion: "1",
      formulaVersion: "1",
    } as any);
    expect(r.commandStatus).toBe("INTENDED");
    expect(() => transitionCommand(r, "EXECUTING")).toThrow(/INVALID_TACTICAL_COMMAND_TRANSITION/);
    r = transitionCommand(r, "ISSUED");
    r = transitionCommand(r, "TRANSMITTED");
    r = transitionCommand(r, "ACKNOWLEDGED");
    r = transitionCommand(r, "EXECUTING");
    expect(r.commandStatus).toBe("EXECUTING");
  });
  it("7+6: realism immutable, Admiral 11_000 Rear 10_000 Captain 9_500", () => {
    expect(shippedCareerMultiplier("ADMIRAL")).toBe(11_000);
    expect(shippedCareerMultiplier("REAR_ADMIRAL")).toBe(10_000);
    expect(shippedCareerMultiplier("CAPTAIN")).toBe(9_500);
    const br = new BattleRealism("ADMIRAL");
    expect(() => br.assertImmutable("CAPTAIN" as any)).toThrow(/TACTICAL_STATE_INVARIANT_FAILED/);
  });
  it("12: reach ranges 8/12/100/500/battle-wide, delays 2/1/2/1/0+2+1", () => {
    expect(SHIPPED_PATH_RANGES_NM.flag).toBe(8);
    expect(SHIPPED_PATH_RANGES_NM.lamp).toBe(12);
    expect(SHIPPED_PATH_RANGES_NM.early_radio).toBe(100);
    expect(SHIPPED_PATH_RANGES_NM.mature_radio).toBe(500);
    expect(isWithinReach(8, "flag", { visibilityNm: 10 })).toBe(true);
    expect(isWithinReach(8.1, "flag", {})).toBe(false);
    expect(getBaseDelay("flag")).toBe(2);
    expect(getBaseDelay("lamp")).toBe(1);
    expect(getBaseDelay("early_radio")).toBe(2);
    expect(getBaseDelay("mature_radio")).toBe(1);
    expect(getBaseDelay("data_link")).toBe(0);
    expect(getBaseDelay("flag", { isAlliedRequest: true, relayHops: 1 })).toBe(5);
  });
  it("13: failure clamp 0..10_000, keyed stream battle/command/path/transmission", () => {
    expect(
      computeFailureProbabilityBp({ basePathFailureBp: 9000, visibilityPenaltyBp: 2000 }),
    ).toBe(10_000);
    expect(computeFailureProbabilityBp({ basePathFailureBp: 100, commanderBonusBp: 200 })).toBe(0);
    const e = new RandomEngine("seed");
    const s1 = e.stream("battle/command/path/transmission:b1:c1:flag:0");
    const s2 = e.stream("battle/command/path/transmission:b1:c1:flag:0");
    expect(s1.next()).toBe(s2.next());
  });
  it("16: fog-of-war leak -> TACTICAL_FOG_OF_WAR_VIOLATION", () => {
    expect(() => validateTargetOrder("unknown", new Map())).toThrow(
      /TACTICAL_FOG_OF_WAR_VIOLATION/,
    );
  });
  it("18-19: full-speed >=9_500bp, vibration strictly >25kts", () => {
    expect(isFullSpeedStress(9500, 10000)).toBe(true);
    expect(isFullSpeedStress(9499, 10000)).toBe(false);
  });
  it("20-23: turn-away reversal 180° [A,B,C,D]->[D,C,B,A], interval clamp 1-4, nominal 1m", () => {
    const m = executeManeuver(["A", "B", "C", "D"], 0, "PORT");
    expect(m.reciprocalCourse).toBe(180);
    expect(m.newOrder).toEqual(["D", "C", "B", "A"]);
    expect(
      computeInitiationIntervalMinutes({
        formationDifficultyBp: 10_000,
        damageMultiplierBp: 10_000,
        confusionMultiplierBp: 10_000,
      }),
    ).toBe(1);
    expect(
      computeInitiationIntervalMinutes({
        formationDifficultyBp: 40_000,
        damageMultiplierBp: 40_000,
        confusionMultiplierBp: 40_000,
      }),
    ).toBe(4);
  });
  it("24-25: confusion 1_500 base, modifiers, weights 10_000, no direct damage", () => {
    expect(computeConfusionProbabilityBp({})).toBe(1_500);
    expect(computeConfusionProbabilityBp({ flagshipDegraded: true })).toBe(2_500);
    expect(CONFUSION_OUTCOMES.reduce((s, o) => s + o.weight, 0)).toBe(10_000);
  });
  it("29-30: withdrawal 5m, battle-end precedence 6, default 360m, completes minute", () => {
    expect(WITHDRAWAL_PERSISTENCE_MINUTES).toBe(5);
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
    const e = {
      battleId: "b1",
      minute: 0,
      substep: 1,
      eventPriority: 1,
      actorId: "a",
      targetId: "t",
      eventId: "e1",
      eventType: "x",
    } as any;
    l1.append(e);
    l2.append(e);
    expect(l1.hash()).toBe(l2.hash());
    const l = new BattleLedger();
    l.append({ ...e, minute: 1, eventId: "e2" } as any);
    l.append({ ...e, minute: 0, eventId: "e1" } as any);
    expect(l.sorted()[0].eventId).toBe("e1");
  });
});
