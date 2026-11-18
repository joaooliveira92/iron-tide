import { describe, expect, it } from "vite-plus/test";
import {
  createDivisionAiMemory,
  decideDivisionOrders,
  flotillaAttackIssuedAtMinute,
  flotillaDelayMinutes,
  type DivisionAiMemory,
  type DivisionAiView,
} from "@bluewave/combat/division-ai";
import { createForceRuntime, PROVISIONAL_FORCE_ORDER_RULESET } from "@bluewave/combat/orders";
import { contact, division, fullForce, lead, view } from "./fixtures.js";

const enemy = [contact("E1", "CAPITAL", 12_000, 4_000)];

function reasons(state: DivisionAiView, memory?: DivisionAiMemory) {
  return decideDivisionOrders(state, memory ?? createDivisionAiMemory()).reasons;
}

function withDivision(
  state: DivisionAiView,
  id: string,
  patch: Record<string, unknown>,
): DivisionAiView {
  return {
    ...state,
    divisions: state.divisions.map((d) => (d.divisionId === id ? { ...d, ...patch } : d)),
  };
}

describe("role-aware morale tiers", () => {
  it("opens range below 4000 bp for INDEPENDENT and PATROL, and pulls SCOUT and SCREEN back", () => {
    const result = reasons(fullForce({ moraleBp: 3_500, contacts: enemy }));
    expect(result["H-INDEP"]).toBe("MORALE_OPEN_RANGE");
    expect(result["G-PATROL"]).toBe("MORALE_OPEN_RANGE");
    expect(result["E-SCOUT"]).toBe("SCOUT_FALL_BACK");
    expect(result["F-SCREEN"]).toBe("SCREEN_FALL_BACK");
    expect(result["C-CORE"]).toBe("CORE_STATION");
    expect(result["D-SUPPORT"]).toBe("SUPPORT_STATION");
  });

  it("falls SCOUT and SCREEN back astern of the lead, not onto it", () => {
    const decision = decideDivisionOrders(
      fullForce({ moraleBp: 3_500, contacts: enemy }),
      createDivisionAiMemory(),
    );
    for (const id of ["E-SCOUT", "F-SCREEN"]) {
      const order = decision.orders.find((o) => o.divisionId === id)!;
      expect(order.navigation).toMatchObject({ kind: "WAYPOINT", xMetres: -2_000, yMetres: 0 });
    }
  });

  it("starts no new SUPPORT attack below 4000 bp", () => {
    const capital = [contact("BB1", "CAPITAL", -1_000, 3_000)];
    expect(reasons(fullForce({ contacts: capital }))["D-SUPPORT"]).toBe("SUPPORT_TORPEDO_ATTACK");
    expect(reasons(fullForce({ contacts: capital, moraleBp: 3_900 }))["D-SUPPORT"]).toBe(
      "SUPPORT_STATION",
    );
  });

  it("withdraws everything except CORE below 2000 bp while the lead is player-controlled", () => {
    const result = reasons(fullForce({ moraleBp: 1_500, contacts: enemy }));
    expect(result["C-CORE"]).toBe("CORE_STATION");
    for (const id of ["D-SUPPORT", "E-SCOUT", "F-SCREEN", "G-PATROL", "H-INDEP"]) {
      expect(result[id]).toBe("MORALE_WITHDRAW");
    }
  });

  it("withdraws CORE too when the lead is AI-controlled", () => {
    const state = fullForce({ moraleBp: 1_500, contacts: enemy });
    const aiLead = withDivision(state, "LEAD", { control: "AI" });
    expect(reasons(aiLead)["C-CORE"]).toBe("MORALE_WITHDRAW");
  });

  it("only withdraws when an enemy is in contact", () => {
    expect(reasons(fullForce({ moraleBp: 1_500 }))["D-SUPPORT"]).toBe("SUPPORT_STATION");
  });
});

describe("minimum dwell hysteresis", () => {
  function scoutAt(minute: number, enemyX: number, memory?: DivisionAiMemory) {
    const state = view([lead(), division("E-SCOUT", "SCOUT", 8_000, 0, { shipTypes: ["CL"] })], {
      minute,
      contacts: [contact("E1", "CAPITAL", enemyX, 0)],
    });
    return decideDivisionOrders(state, memory ?? createDivisionAiMemory());
  }

  it("holds a decision label for the dwell and switches after three minutes", () => {
    const m10 = scoutAt(10, 20_000);
    expect(m10.reasons["E-SCOUT"]).toBe("SCOUT_STATION");
    const m11 = scoutAt(11, 14_000, m10.memory);
    expect(m11.reasons["E-SCOUT"]).toBe("SCOUT_STATION");
    const m12 = scoutAt(12, 20_000, m11.memory);
    expect(m12.reasons["E-SCOUT"]).toBe("SCOUT_STATION");
    const m13 = scoutAt(13, 14_000, m12.memory);
    expect(m13.reasons["E-SCOUT"]).toBe("SCOUT_BREAK_CONTACT");
    expect(m13.memory.divisions[0]?.modeSinceMinute).toBe(13);
  });

  it("recomputes the station geometry every minute while the label holds", () => {
    const m10 = scoutAt(10, 20_000);
    const held = scoutAt(11, 14_000, m10.memory);
    expect(held.reasons["E-SCOUT"]).toBe("SCOUT_STATION");
    expect(held.orders[0]?.navigation).toMatchObject({ xMetres: 8_000 });
  });

  it("lets urgent transitions bypass the dwell", () => {
    const m10 = scoutAt(10, 20_000);
    const m11 = scoutAt(11, 11_000, m10.memory);
    expect(m11.reasons["E-SCOUT"]).toBe("SCOUT_OPEN_RANGE");
  });

  it("applies the dwell when leaving an urgent scout mode", () => {
    const m10 = scoutAt(10, 11_000);
    expect(m10.reasons["E-SCOUT"]).toBe("SCOUT_OPEN_RANGE");
    const m11 = scoutAt(11, 20_000, m10.memory);
    expect(m11.reasons["E-SCOUT"]).toBe("SCOUT_OPEN_RANGE");
    const m13 = scoutAt(13, 20_000, m11.memory);
    expect(m13.reasons["E-SCOUT"]).toBe("SCOUT_STATION");
  });

  it("drops a held label that no longer belongs to the division's role", () => {
    const m10 = scoutAt(10, 20_000);
    const retasked = view(
      [lead(), division("E-SCOUT", "SCREEN", 8_000, 0, { shipTypes: ["CL"] })],
      { minute: 11 },
    );
    const decision = decideDivisionOrders(retasked, m10.memory);
    expect(decision.reasons["E-SCOUT"]).toBe("SCREEN_STATION");
  });
});

describe("flotilla attack", () => {
  const capital = contact("BB1", "CAPITAL", 12_000, 6_000);

  function flotillaState(minute: number, overrides: Partial<DivisionAiView> = {}) {
    return fullForce({
      minute,
      flotillaAttackIssuedAtMinute: 10,
      contacts: [capital],
      ...overrides,
    });
  }

  it("delays by ceil(3 minutes * 10000 / signaling bp)", () => {
    expect(flotillaDelayMinutes(10_000, 3)).toBe(3);
    expect(flotillaDelayMinutes(8_000, 3)).toBe(4);
    expect(flotillaDelayMinutes(12_500, 3)).toBe(3);
  });

  it("keeps the role until the delay has elapsed, then charges the capital ship", () => {
    expect(reasons(flotillaState(12))["D-SUPPORT"]).toBe("SUPPORT_STATION");
    const decision = decideDivisionOrders(flotillaState(13), createDivisionAiMemory());
    expect(decision.reasons["D-SUPPORT"]).toBe("FLOTILLA_ATTACK");
    const order = decision.orders.find((o) => o.divisionId === "D-SUPPORT")!;
    expect(order.formation).toBe("LINE_ABREAST");
    expect(order.speed).toEqual({ kind: "PRESET", preset: "SQUADRON_MAX" });
  });

  it("uses the slower signaling delay for a low-signaling division", () => {
    const slow = withDivision(flotillaState(13), "D-SUPPORT", { signalingBp: 8_000 });
    expect(reasons(slow)["D-SUPPORT"]).toBe("SUPPORT_STATION");
    const later = withDivision(flotillaState(14), "D-SUPPORT", { signalingBp: 8_000 });
    expect(reasons(later)["D-SUPPORT"]).toBe("FLOTILLA_ATTACK");
  });

  it("resumes the division's role when its salvos are spent", () => {
    const spent = withDivision(flotillaState(15), "D-SUPPORT", { salvosLeft: 0 });
    expect(reasons(spent)["D-SUPPORT"]).toBe("SUPPORT_STATION");
  });

  it("counters an enemy destroyer inside 6 km instead of charging the capital ship", () => {
    const state = flotillaState(15, {
      contacts: [capital, contact("DD1", "DESTROYER", -2_000, -1_000)],
    });
    expect(reasons(state)["D-SUPPORT"]).toBe("FLOTILLA_SELF_DEFENCE");
  });

  it("does not order non-destroyer divisions to charge", () => {
    const result = reasons(flotillaState(20));
    expect(result["E-SCOUT"]).toBe("SCOUT_STATION");
    expect(result["C-CORE"]).toBe("CORE_STATION");
  });

  it("keeps the current formation when LINE_ABREAST would be illegal for six ships", () => {
    const six = withDivision(flotillaState(15), "D-SUPPORT", {
      shipTypes: ["DD", "DD", "DD", "DD", "DD", "DD"],
    });
    const decision = decideDivisionOrders(six, createDivisionAiMemory());
    const order = decision.orders.find((o) => o.divisionId === "D-SUPPORT")!;
    expect(order.formation).toBe("LINE_AHEAD");
  });

  it("morale takes priority over the flotilla order", () => {
    const state = flotillaState(15, { moraleBp: 1_000 });
    expect(reasons(state)["D-SUPPORT"]).toBe("MORALE_WITHDRAW");
  });
});

describe("flotilla issue minute from force runtime", () => {
  const base = createForceRuntime(PROVISIONAL_FORCE_ORDER_RULESET);
  const attack = (minute: number) => ({
    forceId: "ATTACKER",
    kind: "FLOTILLA_ATTACK" as const,
    issuedAtMinute: minute,
  });
  const recall = (minute: number) => ({
    forceId: "ATTACKER",
    kind: "FLOTILLA_RECALL" as const,
    issuedAtMinute: minute,
  });

  it("is null while no attack is active", () => {
    expect(flotillaAttackIssuedAtMinute(base)).toBeNull();
  });

  it("reports the latest unrecalled attack", () => {
    const active = {
      ...base,
      state: { ...base.state, flotillaAttackActive: true },
      deferred: [attack(3), recall(5), attack(8)],
    };
    expect(flotillaAttackIssuedAtMinute(active)).toBe(8);
  });

  it("is null once the attack is recalled", () => {
    const recalled = {
      ...base,
      state: { ...base.state, flotillaAttackActive: false },
      deferred: [attack(3), recall(5)],
    };
    expect(flotillaAttackIssuedAtMinute(recalled)).toBeNull();
  });
});
