import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import type { DivisionRole } from "@bluewave/campaign";
import type { TacticalDivision } from "@bluewave/combat/tactical";
import {
  DIVISION_ORDER_VERSION,
  FORCE_ORDER_VERSION,
  PROVISIONAL_FORCE_ORDER_RULESET,
  REALISM_MODES,
  advanceForce,
  createForceRuntime,
  decodeForceOrderSet,
  decodeForceState,
  forceFormationCohesionBp,
  type DivisionOrder,
  type DivisionOrderSet,
  type ForceOrder,
  type ForceRuntime,
  type ForceSituation,
} from "@bluewave/combat/orders";

const ruleset = PROVISIONAL_FORCE_ORDER_RULESET;

function division(divisionId: string, sideId: string, role: DivisionRole): TacticalDivision {
  return {
    tacticalDivisionId: divisionId,
    battleId: "battle",
    sideId,
    role,
    formation: "LINE_AHEAD",
    orderedTacticalUnitIds: [`${divisionId}-ship`],
    tacticalFlagshipId: `${divisionId}-ship`,
    tacticalCommanderId: "VACANT",
    sourcePermanentDivisionIds: [],
    projectionAdjustmentRecords: [],
    campaignAssetProvenanceIds: [],
    temporaryAssetProvenanceIds: [],
    initialExperience: SafeInt(20),
    initialCohesion: SafeInt(30),
    rulesetVersion: "ruleset",
    recordHash: "record",
  };
}

const divisions = [
  division("A1", "ATTACKER", "INDEPENDENT"),
  division("A2", "ATTACKER", "CORE"),
  division("A3", "ATTACKER", "SCREEN"),
  division("B1", "DEFENDER", "INDEPENDENT"),
];

function divisionOrder(source: TacticalDivision, leadDivisionId: string | null): DivisionOrder {
  return {
    divisionId: source.tacticalDivisionId,
    navigation: { kind: "STANCE", stance: "ENGAGE" },
    speed: { kind: "PERCENT", percent: 100 },
    formation: source.formation,
    role: source.role,
    leadDivisionId,
    control: "PLAYER",
    turnTogether: false,
    issuedAtMinute: 0,
  };
}

function baseSet(links: Readonly<Record<string, string | null>> = {}): DivisionOrderSet {
  return {
    version: DIVISION_ORDER_VERSION,
    divisions: divisions.map((entry) =>
      divisionOrder(entry, links[entry.tacticalDivisionId] ?? null),
    ),
  };
}

const calm: ForceSituation = { casualtyBp: 0, ammunitionBp: 10_000 };

function orders(...list: ForceOrder[]): {
  version: typeof FORCE_ORDER_VERSION;
  orders: ForceOrder[];
} {
  return { version: FORCE_ORDER_VERSION, orders: list };
}

function rally(minute: number, forceId = "ATTACKER"): ForceOrder {
  return { forceId, kind: "RALLY", issuedAtMinute: minute };
}

function changeLead(minute: number, divisionId: string, forceId = "ATTACKER"): ForceOrder {
  return { forceId, kind: "CHANGE_LEAD_DIVISION", divisionId, issuedAtMinute: minute };
}

function step(
  runtime: ForceRuntime,
  minute: number,
  list: ForceOrder[],
  overrides: {
    mode?: (typeof REALISM_MODES)[number];
    control?: "PLAYER" | "AI";
    situation?: ForceSituation;
    divisionOrders?: DivisionOrderSet;
  } = {},
) {
  return advanceForce({
    forceId: "ATTACKER",
    orders: orders(...list),
    runtime,
    minute,
    realismMode: overrides.mode ?? "ADMIRAL",
    control: overrides.control ?? "PLAYER",
    divisions,
    divisionOrders: overrides.divisionOrders ?? baseSet(),
    situation: overrides.situation ?? calm,
    ruleset,
  });
}

describe("force order contract", () => {
  it("decodes a strict versioned order set", () => {
    const decoded = decodeForceOrderSet({
      version: FORCE_ORDER_VERSION,
      orders: [
        { forceId: "ATTACKER", kind: "RALLY", issuedAtMinute: 3 },
        { forceId: "ATTACKER", kind: "CHANGE_LEAD_DIVISION", divisionId: "A2", issuedAtMinute: 4 },
      ],
    });
    expect(decoded.orders).toHaveLength(2);
  });

  it("rejects excess properties, unknown kinds, a missing division and a wrong version", () => {
    const rejected = (value: unknown): void => {
      expect(() => decodeForceOrderSet(value)).toThrow();
    };
    rejected({
      version: FORCE_ORDER_VERSION,
      orders: [{ forceId: "A", kind: "RALLY", issuedAtMinute: 0, extra: 1 }],
    });
    rejected({
      version: FORCE_ORDER_VERSION,
      orders: [{ forceId: "A", kind: "RALLY", divisionId: "A2", issuedAtMinute: 0 }],
    });
    rejected({
      version: FORCE_ORDER_VERSION,
      orders: [{ forceId: "A", kind: "SURRENDER", issuedAtMinute: 0 }],
    });
    rejected({
      version: FORCE_ORDER_VERSION,
      orders: [{ forceId: "A", kind: "CHANGE_LEAD_DIVISION", issuedAtMinute: 0 }],
    });
    rejected({ version: "force_order_v0", orders: [] });
    rejected({
      version: FORCE_ORDER_VERSION,
      orders: [{ forceId: "A", kind: "RALLY", issuedAtMinute: -1 }],
    });
  });

  it("decodes force state strictly", () => {
    const state = {
      moraleBp: 5_000,
      flotillaAttackActive: false,
      leadChangeUsed: false,
      turnAwayUsed: false,
    };
    expect(decodeForceState(state)).toEqual(state);
    expect(() => decodeForceState({ ...state, moraleBp: 10_001 })).toThrow();
    expect(() => decodeForceState({ ...state, extra: true })).toThrow();
  });
});

describe("force runtime", () => {
  it("starts at the neutral provisional morale with every flag clear", () => {
    expect(createForceRuntime(ruleset).state).toEqual({
      moraleBp: ruleset.neutralMoraleBp,
      flotillaAttackActive: false,
      leadChangeUsed: false,
      turnAwayUsed: false,
    });
  });

  it("leaves the division order set untouched when no order is issued", () => {
    const set = baseSet();
    const result = step(createForceRuntime(ruleset), 0, [], { divisionOrders: set });
    expect(result.divisionOrders).toBe(set);
    expect(result.runtime).toEqual(createForceRuntime(ruleset));
    expect(result.issues).toEqual([]);
  });
});

describe("rally", () => {
  it("raises morale by the provisional amount", () => {
    const result = step(createForceRuntime(ruleset), 2, [rally(2)]);
    expect(result.runtime.state.moraleBp).toBe(ruleset.neutralMoraleBp + ruleset.rallyAmountBp);
  });

  it("decays back to the starting morale and then stays there", () => {
    let runtime = step(createForceRuntime(ruleset), 2, [rally(2)]).runtime;
    for (let minute = 3; minute < 3 + ruleset.rallyDecayMinutes; minute += 1) {
      const next = step(runtime, minute, []).runtime;
      expect(next.state.moraleBp).toBeLessThanOrEqual(runtime.state.moraleBp);
      runtime = next;
    }
    expect(runtime.state.moraleBp).toBe(ruleset.neutralMoraleBp);
    expect(step(runtime, 40, []).runtime.state.moraleBp).toBe(ruleset.neutralMoraleBp);
  });

  it("applies once however many minutes the same order set is resent", () => {
    const resent = [rally(2)];
    let runtime = createForceRuntime(ruleset);
    const trace: number[] = [];
    for (let minute = 0; minute < 6; minute += 1) {
      runtime = step(runtime, minute, resent).runtime;
      trace.push(runtime.state.moraleBp);
    }
    const peak = ruleset.neutralMoraleBp + ruleset.rallyAmountBp;
    expect(trace[2]).toBe(peak);
    expect(trace[3]).toBeLessThan(peak);
    expect(Math.max(...trace)).toBe(peak);
  });

  it("is reduced by heavy casualties and by low ammunition, and by both", () => {
    const amount = (situation: ForceSituation): number =>
      step(createForceRuntime(ruleset), 0, [rally(0)], { situation }).runtime.state.moraleBp -
      ruleset.neutralMoraleBp;
    const full = amount(calm);
    const heavy = amount({ casualtyBp: ruleset.heavyCasualtyBp, ammunitionBp: 10_000 });
    const low = amount({ casualtyBp: 0, ammunitionBp: ruleset.lowAmmunitionBp - 1 });
    const both = amount({
      casualtyBp: ruleset.heavyCasualtyBp,
      ammunitionBp: ruleset.lowAmmunitionBp - 1,
    });
    expect(full).toBe(ruleset.rallyAmountBp);
    expect(heavy).toBeLessThan(full);
    expect(low).toBeLessThan(full);
    expect(both).toBeLessThan(heavy);
    expect(amount({ casualtyBp: ruleset.heavyCasualtyBp - 1, ammunitionBp: null })).toBe(full);
  });

  it("never lifts morale past the ceiling", () => {
    const tuned = { ...ruleset, neutralMoraleBp: 9_800 };
    const result = advanceForce({
      forceId: "ATTACKER",
      orders: orders(rally(0)),
      runtime: createForceRuntime(tuned),
      minute: 0,
      realismMode: "ADMIRAL",
      control: "PLAYER",
      divisions,
      divisionOrders: baseSet(),
      situation: calm,
      ruleset: tuned,
    });
    expect(result.runtime.state.moraleBp).toBe(10_000);
  });
});

describe("change lead division", () => {
  const links = { A2: "A1", A3: "A1" };

  it("makes the new lead independent and re-points the dependants and the old lead", () => {
    const result = step(createForceRuntime(ruleset), 5, [changeLead(5, "A2")], {
      divisionOrders: baseSet(links),
    });
    const byId = new Map(result.divisionOrders.divisions.map((entry) => [entry.divisionId, entry]));
    expect(byId.get("A2")).toMatchObject({ role: "INDEPENDENT", leadDivisionId: null });
    expect(byId.get("A1")?.leadDivisionId).toBe("A2");
    expect(byId.get("A3")?.leadDivisionId).toBe("A2");
    expect(byId.get("B1")?.leadDivisionId).toBeNull();
    expect(result.runtime.state.leadChangeUsed).toBe(true);
    expect(result.issues).toEqual([]);
  });

  it("keeps the new lead in effect when the unchanged base orders are resent", () => {
    let runtime = step(createForceRuntime(ruleset), 5, [changeLead(5, "A2")], {
      divisionOrders: baseSet(links),
    }).runtime;
    let last = baseSet(links);
    for (let minute = 6; minute < 9; minute += 1) {
      const next = step(runtime, minute, [changeLead(5, "A2")], { divisionOrders: baseSet(links) });
      runtime = next.runtime;
      last = next.divisionOrders;
    }
    const byId = new Map(last.divisions.map((entry) => [entry.divisionId, entry]));
    expect(byId.get("A2")?.role).toBe("INDEPENDENT");
    expect(byId.get("A3")?.leadDivisionId).toBe("A2");
    expect(runtime.state.leadChangeUsed).toBe(true);
  });

  it("allows one lead change per battle per force", () => {
    const first = step(createForceRuntime(ruleset), 5, [changeLead(5, "A2")], {
      divisionOrders: baseSet(links),
    });
    const second = step(first.runtime, 9, [changeLead(9, "A3")], {
      divisionOrders: baseSet(links),
    });
    expect(second.issues.map((issue) => issue.code)).toEqual(["FORCE_ORDER_LEAD_CHANGE_USED"]);
    const byId = new Map(second.divisionOrders.divisions.map((entry) => [entry.divisionId, entry]));
    expect(byId.get("A2")?.role).toBe("INDEPENDENT");
    expect(byId.get("A3")?.role).toBe("SCREEN");
  });

  it("rejects the current lead, unknown divisions and another force's division", () => {
    const codes = (target: string): string[] =>
      step(createForceRuntime(ruleset), 1, [changeLead(1, target)], {
        divisionOrders: baseSet(links),
      }).issues.map((issue) => issue.code);
    expect(codes("A1")).toEqual(["FORCE_ORDER_LEAD_ALREADY"]);
    expect(codes("Z9")).toEqual(["FORCE_ORDER_UNKNOWN_DIVISION"]);
    expect(codes("B1")).toEqual(["FORCE_ORDER_UNKNOWN_DIVISION"]);
    const unused = step(createForceRuntime(ruleset), 1, [changeLead(1, "A1")]);
    expect(unused.runtime.state.leadChangeUsed).toBe(false);
  });

  it("opens a confusion window that lowers formation cohesion inside the effect clamp", () => {
    const result = step(createForceRuntime(ruleset), 5, [changeLead(5, "A2")], {
      divisionOrders: baseSet(links),
    });
    const runtime = result.runtime;
    const lowered = 10_000 - ruleset.confusionPenaltyBp;
    expect(forceFormationCohesionBp(10_000, runtime, 5)).toBe(lowered);
    expect(forceFormationCohesionBp(7_800, runtime, 5)).toBe(7_500);
    expect(forceFormationCohesionBp(10_000, runtime, 5 + ruleset.confusionMinutes - 1)).toBe(
      lowered,
    );
    expect(forceFormationCohesionBp(10_000, runtime, 5 + ruleset.confusionMinutes)).toBe(10_000);
    expect(forceFormationCohesionBp(10_000, createForceRuntime(ruleset), 5)).toBe(10_000);
  });
});

describe("realism and control gating", () => {
  it("accepts force orders in every realism mode for a player-controlled force", () => {
    for (const mode of REALISM_MODES) {
      const result = step(createForceRuntime(ruleset), 0, [rally(0)], { mode });
      expect(result.issues).toEqual([]);
      expect(result.runtime.state.moraleBp).toBeGreaterThan(ruleset.neutralMoraleBp);
    }
  });

  it("refuses an AI-controlled force and changes nothing", () => {
    const runtime = createForceRuntime(ruleset);
    const result = step(runtime, 0, [rally(0), changeLead(0, "A2")], { control: "AI" });
    expect(result.issues.map((issue) => issue.code)).toEqual([
      "FORCE_ORDER_NOT_PLAYER_CONTROLLED",
      "FORCE_ORDER_NOT_PLAYER_CONTROLLED",
    ]);
    expect(result.runtime).toEqual(runtime);
  });

  it("ignores orders addressed to another force", () => {
    const result = step(createForceRuntime(ruleset), 0, [rally(0, "DEFENDER")]);
    expect(result.issues.map((issue) => issue.code)).toEqual(["FORCE_ORDER_UNKNOWN_FORCE"]);
    expect(result.runtime.state.moraleBp).toBe(ruleset.neutralMoraleBp);
  });
});

describe("AI-dependent seams", () => {
  it("records the flotilla attack and recall as a flag with no behaviour", () => {
    const attack = step(createForceRuntime(ruleset), 1, [
      { forceId: "ATTACKER", kind: "FLOTILLA_ATTACK", issuedAtMinute: 1 },
    ]);
    expect(attack.runtime.state.flotillaAttackActive).toBe(true);
    const recall = step(attack.runtime, 2, [
      { forceId: "ATTACKER", kind: "FLOTILLA_RECALL", issuedAtMinute: 2 },
    ]);
    expect(recall.runtime.state.flotillaAttackActive).toBe(false);
    expect(recall.runtime.deferred.map((entry) => entry.kind)).toEqual([
      "FLOTILLA_ATTACK",
      "FLOTILLA_RECALL",
    ]);
  });

  it("records a disengage without touching morale or division orders", () => {
    const set = baseSet();
    const result = step(
      createForceRuntime(ruleset),
      3,
      [{ forceId: "ATTACKER", kind: "DISENGAGE", issuedAtMinute: 3 }],
      { divisionOrders: set },
    );
    expect(result.runtime.state.moraleBp).toBe(ruleset.neutralMoraleBp);
    expect(result.divisionOrders).toBe(set);
    expect(result.runtime.deferred.map((entry) => entry.kind)).toEqual(["DISENGAGE"]);
  });

  it("accepts one battle turn away, sets the flag and refuses a second", () => {
    const turn: ForceOrder = { forceId: "ATTACKER", kind: "BATTLE_TURN_AWAY", issuedAtMinute: 4 };
    const first = step(createForceRuntime(ruleset), 4, [turn]);
    expect(first.runtime.state.turnAwayUsed).toBe(true);
    expect(first.runtime.deferred.map((entry) => entry.kind)).toEqual(["BATTLE_TURN_AWAY"]);
    const second = step(first.runtime, 8, [{ ...turn, issuedAtMinute: 8 }]);
    expect(second.issues.map((issue) => issue.code)).toEqual(["FORCE_ORDER_TURN_AWAY_USED"]);
  });
});
