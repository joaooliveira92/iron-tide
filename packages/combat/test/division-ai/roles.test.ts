import { describe, expect, it } from "vite-plus/test";
import {
  createDivisionAiMemory,
  decideDivisionOrders,
  type DivisionAiDecision,
  type DivisionAiMemory,
  type DivisionAiView,
} from "@bluewave/combat/division-ai";
import { DIVISION_ORDER_VERSION, decodeDivisionOrderSet } from "@bluewave/combat/orders";
import { contact, division, fullForce, lead, view } from "./fixtures.js";

function run(
  state: DivisionAiView,
  memory: DivisionAiMemory = createDivisionAiMemory(),
): DivisionAiDecision {
  return decideDivisionOrders(state, memory);
}

function orderOf(decision: DivisionAiDecision, divisionId: string) {
  const order = decision.orders.find((candidate) => candidate.divisionId === divisionId);
  if (order === undefined) throw new Error(`no order for ${divisionId}`);
  return order;
}

function waypointOf(decision: DivisionAiDecision, divisionId: string) {
  const navigation = orderOf(decision, divisionId).navigation;
  if (navigation.kind !== "WAYPOINT") throw new Error("expected a waypoint");
  return navigation;
}

describe("decideDivisionOrders", () => {
  it("emits only valid AI division orders and skips the lead and player divisions", () => {
    const state = fullForce({ contacts: [contact("E1", "CAPITAL", 14_000, 3_000)] });
    const withPlayer = {
      ...state,
      divisions: [
        ...state.divisions,
        division("Z-PLAYER", "SUPPORT", 0, 5_000, { control: "PLAYER" }),
      ],
    };
    const decision = run(withPlayer);
    expect(decision.orders.map((order) => order.divisionId)).toEqual([
      "C-CORE",
      "D-SUPPORT",
      "E-SCOUT",
      "F-SCREEN",
      "G-PATROL",
      "H-INDEP",
    ]);
    const decoded = decodeDivisionOrderSet({
      version: DIVISION_ORDER_VERSION,
      divisions: decision.orders,
    });
    expect(decoded.divisions.every((order) => order.control === "AI")).toBe(true);
    expect(decision.orders.every((order) => order.leadDivisionId === "LEAD")).toBe(true);
    expect(decision.orders.every((order) => order.issuedAtMinute === 10)).toBe(true);
    expect(Object.keys(decision.reasons)).toEqual(decision.orders.map((order) => order.divisionId));
  });

  it("does not mutate its inputs", () => {
    const state = fullForce({ contacts: [contact("E1", "CAPITAL", 14_000, 3_000)] });
    const memory = createDivisionAiMemory();
    const before = JSON.stringify([state, memory]);
    run(state, memory);
    expect(JSON.stringify([state, memory])).toBe(before);
  });

  it("CORE follows the lead's recorded track about 800 m behind the last ship", () => {
    const decision = run(fullForce());
    expect(waypointOf(decision, "C-CORE")).toMatchObject({ xMetres: -2_000, yMetres: 0 });
    expect(decision.reasons["C-CORE"]).toBe("CORE_STATION");
    const order = orderOf(decision, "C-CORE");
    expect(order.speed).toEqual({ kind: "KNOTS", knots: 23 });
  });

  it("CORE falls back to the lead's heading when no track is recorded", () => {
    const state = view([
      lead({ track: [] }),
      division("C-CORE", "CORE", -4_000, 0, { shipTypes: ["BB"] }),
    ]);
    expect(waypointOf(run(state), "C-CORE")).toMatchObject({ xMetres: -2_000, yMetres: 0 });
  });

  it("SUPPORT holds the disengaged side astern and abeam of the lead", () => {
    const enemyPort = fullForce({ contacts: [contact("E1", "CAPITAL", 12_000, 4_000)] });
    const decision = run(enemyPort);
    expect(waypointOf(decision, "D-SUPPORT")).toMatchObject({ xMetres: -2_700, yMetres: -2_500 });
    expect(decision.reasons["D-SUPPORT"]).toBe("SUPPORT_STATION");
    const enemyStarboard = fullForce({ contacts: [contact("E1", "CAPITAL", 12_000, -4_000)] });
    expect(waypointOf(run(enemyStarboard), "D-SUPPORT")).toMatchObject({ yMetres: 2_500 });
  });

  it("SUPPORT keeps its side until the threat moves 20 degrees across the beam", () => {
    const first = run(fullForce({ contacts: [contact("E1", "CAPITAL", 12_000, 4_000)] }));
    const near = run(
      fullForce({ contacts: [contact("E1", "CAPITAL", 12_000, -2_000)], minute: 11 }),
      first.memory,
    );
    expect(waypointOf(near, "D-SUPPORT").yMetres).toBe(-2_500);
    const across = run(
      fullForce({ contacts: [contact("E1", "CAPITAL", 12_000, -6_000)], minute: 12 }),
      near.memory,
    );
    expect(waypointOf(across, "D-SUPPORT").yMetres).toBe(2_500);
    expect(across.memory.divisions.find((e) => e.divisionId === "D-SUPPORT")?.supportSide).toBe(1);
  });

  it("SUPPORT counterattacks an enemy destroyer inside 6 km and latches until 9 km", () => {
    const close = run(fullForce({ contacts: [contact("DD1", "DESTROYER", 5_000, 3_000)] }));
    expect(close.reasons["D-SUPPORT"]).toBe("SUPPORT_COUNTERATTACK_DD");
    expect(orderOf(close, "D-SUPPORT").speed).toEqual({ kind: "PRESET", preset: "SQUADRON_MAX" });
    const held = run(
      fullForce({ contacts: [contact("DD1", "DESTROYER", 8_000, 0)], minute: 11 }),
      close.memory,
    );
    expect(held.reasons["D-SUPPORT"]).toBe("SUPPORT_COUNTERATTACK_DD");
    const broken = run(
      fullForce({ contacts: [contact("DD1", "DESTROYER", 12_000, 0)], minute: 12 }),
      held.memory,
    );
    expect(broken.reasons["D-SUPPORT"]).toBe("SUPPORT_STATION");
    expect(broken.memory.divisions.find((e) => e.divisionId === "D-SUPPORT")?.attacking).toBe(
      false,
    );
  });

  it("SUPPORT torpedoes a capital ship inside 5 km only while salvos remain", () => {
    const capital = contact("BB1", "CAPITAL", -1_000, 3_000);
    const armed = run(fullForce({ contacts: [capital] }));
    expect(armed.reasons["D-SUPPORT"]).toBe("SUPPORT_TORPEDO_ATTACK");
    const state = fullForce({ contacts: [capital] });
    const spent = {
      ...state,
      divisions: state.divisions.map((d) =>
        d.divisionId === "D-SUPPORT" ? { ...d, salvosLeft: 0 } : d,
      ),
    };
    expect(run(spent).reasons["D-SUPPORT"]).toBe("SUPPORT_STATION");
  });

  it("SCOUT searches about 8 km ahead of the lead at lead speed plus 4 knots", () => {
    const decision = run(fullForce());
    expect(waypointOf(decision, "E-SCOUT")).toMatchObject({ xMetres: 8_000, yMetres: 0 });
    expect(orderOf(decision, "E-SCOUT").formation).toBe("SEARCH_LINE");
    expect(orderOf(decision, "E-SCOUT").speed).toEqual({ kind: "KNOTS", knots: 22 });
  });

  it("SCOUT keeps its current formation when it cannot search", () => {
    const state = fullForce();
    const blind = {
      ...state,
      divisions: state.divisions.map((d) =>
        d.divisionId === "E-SCOUT" ? { ...d, searchCapable: false } : d,
      ),
    };
    expect(orderOf(run(blind), "E-SCOUT").formation).toBe("LINE_AHEAD");
  });

  it("SCOUT opens range inside 4.5 km of an enemy and heads away from it", () => {
    const decision = run(fullForce({ contacts: [contact("E1", "CAPITAL", 11_000, 0)] }));
    expect(decision.reasons["E-SCOUT"]).toBe("SCOUT_OPEN_RANGE");
    expect(waypointOf(decision, "E-SCOUT").xMetres).toBeLessThan(8_000);
  });

  it("SCOUT transits via the disengaged flank when the lead reverses", () => {
    const state = fullForce({ contacts: [contact("E1", "CAPITAL", 30_000, 4_000)] });
    const reversed = {
      ...state,
      divisions: state.divisions.map((d) =>
        d.divisionId === "LEAD"
          ? { ...d, headingDeg: 180 }
          : d.divisionId === "E-SCOUT"
            ? { ...d, position: { xMetres: 8_000, yMetres: 0 } }
            : d,
      ),
    };
    const decision = run(reversed);
    expect(decision.reasons["E-SCOUT"]).toBe("SCOUT_TRANSIT_FLANK");
    expect(orderOf(decision, "E-SCOUT").speed).toEqual({ kind: "PRESET", preset: "SQUADRON_MAX" });
  });

  it("SCREEN holds about 3 km ahead in screen formation and interposes on the enemy bearing", () => {
    const calm = run(fullForce());
    expect(waypointOf(calm, "F-SCREEN")).toMatchObject({ xMetres: 3_000, yMetres: 0 });
    expect(orderOf(calm, "F-SCREEN").formation).toBe("SCREEN");
    const enemy = run(fullForce({ contacts: [contact("E1", "CAPITAL", 0, 10_000)] }));
    expect(enemy.reasons["F-SCREEN"]).toBe("SCREEN_INTERPOSE");
    expect(waypointOf(enemy, "F-SCREEN")).toMatchObject({ xMetres: 0, yMetres: 3_000 });
  });

  it("PATROL anchors on the objective, else the lead, and walks a square", () => {
    const first = run(fullForce({ objective: { xMetres: 30_000, yMetres: 30_000 } }));
    expect(waypointOf(first, "G-PATROL")).toMatchObject({ xMetres: 34_000, yMetres: 30_000 });
    expect(orderOf(first, "G-PATROL").speed).toEqual({ kind: "KNOTS", knots: 8 });
    const entry = first.memory.divisions.find((e) => e.divisionId === "G-PATROL");
    expect(entry?.patrolAnchor).toEqual({ xMetres: 30_000, yMetres: 30_000 });
    const noObjective = run(fullForce());
    expect(waypointOf(noObjective, "G-PATROL")).toMatchObject({ xMetres: 4_000, yMetres: 0 });
  });

  it("PATROL advances to the next corner on arrival and keeps its anchor", () => {
    const first = run(fullForce({ objective: { xMetres: 30_000, yMetres: 30_000 } }));
    const state = fullForce({ minute: 11 });
    const arrived = {
      ...state,
      divisions: state.divisions.map((d) =>
        d.divisionId === "G-PATROL" ? { ...d, position: { xMetres: 34_000, yMetres: 30_000 } } : d,
      ),
    };
    const second = run(arrived, first.memory);
    expect(waypointOf(second, "G-PATROL")).toMatchObject({ xMetres: 30_000, yMetres: 34_000 });
    const entry = second.memory.divisions.find((e) => e.divisionId === "G-PATROL");
    expect(entry?.waypointIndex).toBe(1);
    expect(entry?.patrolAnchor).toEqual({ xMetres: 30_000, yMetres: 30_000 });
  });

  it("PATROL avoids an enemy inside 7 km", () => {
    const state = fullForce({ contacts: [contact("E1", "CAPITAL", 20_000, 25_000)] });
    const decision = run(state);
    expect(decision.reasons["G-PATROL"]).toBe("PATROL_AVOID");
  });

  it("INDEPENDENT runs parallel to the lead inside its leash", () => {
    const decision = run(fullForce());
    expect(orderOf(decision, "H-INDEP").navigation).toEqual({ kind: "COURSE", headingDeg: 0 });
    expect(decision.reasons["H-INDEP"]).toBe("INDEPENDENT_PARALLEL");
  });

  it("INDEPENDENT closes on the flagship beyond 6 km and engages through a standoff point", () => {
    const state = fullForce();
    const far = {
      ...state,
      divisions: state.divisions.map((d) =>
        d.divisionId === "H-INDEP" ? { ...d, position: { xMetres: 0, yMetres: -9_000 } } : d,
      ),
    };
    expect(run(far).reasons["H-INDEP"]).toBe("INDEPENDENT_CLOSE_ON_FLAG");
    const engaged = run(fullForce({ contacts: [contact("E1", "CAPITAL", 2_000, -12_000)] }));
    expect(engaged.reasons["H-INDEP"]).toBe("INDEPENDENT_ENGAGE");
    expect(waypointOf(engaged, "H-INDEP")).toMatchObject({ xMetres: 2_000, yMetres: -9_000 });
  });

  it("never emits a waypoint beyond the order bound or a non-positive speed", () => {
    const state = fullForce({ contacts: [contact("E1", "CAPITAL", 12_000, 4_000)] });
    const edge = {
      ...state,
      divisions: state.divisions.map((d) =>
        d.divisionId === "G-PATROL"
          ? { ...d, position: { xMetres: 499_000, yMetres: 499_000 }, maxSpeedKnots: 1 }
          : d,
      ),
    };
    const decision = run({ ...edge, moraleBp: 1_000 });
    for (const order of decision.orders) {
      if (order.navigation.kind === "WAYPOINT") {
        expect(Math.abs(order.navigation.xMetres)).toBeLessThanOrEqual(500_000);
        expect(Math.abs(order.navigation.yMetres)).toBeLessThanOrEqual(500_000);
      }
      if (order.speed.kind === "KNOTS") expect(order.speed.knots).toBeGreaterThan(0);
    }
  });
});
