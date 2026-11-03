import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_DIVISION_ORDER,
  MAX_SPEED_PERCENT,
  MIN_SPEED_PERCENT,
  defaultOrdersFor,
  ordersToDtos,
  playerSideOf,
  type OrdersView,
  standingOrdersFor,
  toCombatOrders,
} from "./player-battle-orders.js";

const viewOf = (playerNationId: string): OrdersView => ({
  playerNationId,
  attackerId: "uk",
  defenderId: "france",
  divisions: [
    { divisionId: "a1", sideId: "ATTACKER" },
    { divisionId: "a2", sideId: "ATTACKER" },
    { divisionId: "d1", sideId: "DEFENDER" },
  ],
});

describe("player battle orders", () => {
  it("resolves the player side from the nation", () => {
    expect(playerSideOf(viewOf("uk"))).toBe("ATTACKER");
    expect(playerSideOf(viewOf("france"))).toBe("DEFENDER");
    expect(playerSideOf(viewOf("spain"))).toBeNull();
  });

  it("defaults only the player's divisions to full-speed engage", () => {
    expect(defaultOrdersFor(viewOf("uk"))).toEqual({
      a1: DEFAULT_DIVISION_ORDER,
      a2: DEFAULT_DIVISION_ORDER,
    });
    expect(defaultOrdersFor(viewOf("france"))).toEqual({ d1: DEFAULT_DIVISION_ORDER });
    expect(defaultOrdersFor(viewOf("spain"))).toEqual({});
    expect(DEFAULT_DIVISION_ORDER).toEqual({ stance: "ENGAGE", speedPercent: MAX_SPEED_PERCENT });
    expect(MIN_SPEED_PERCENT).toBe(0);
  });

  it("overlays the last standing orders on the defaults", () => {
    const orders = standingOrdersFor(viewOf("uk"), [
      { divisionId: "a1", stance: "HOLD", speedPercent: 40 },
    ]);
    expect(orders).toEqual({
      a1: { stance: "HOLD", speedPercent: 40 },
      a2: DEFAULT_DIVISION_ORDER,
    });
  });

  it("round-trips orders through the wire dtos and the combat shape", () => {
    const dtos = ordersToDtos({ a1: { stance: "WITHDRAW", speedPercent: 0 } });
    expect(dtos).toEqual([{ divisionId: "a1", stance: "WITHDRAW", speedPercent: 0 }]);
    expect(toCombatOrders(dtos)).toEqual({
      divisions: { a1: { stance: "WITHDRAW", speedPercent: 0 } },
    });
    expect(toCombatOrders([])).toEqual({ divisions: {} });
  });
});

describe("course and knots orders", () => {
  const steered = { stance: "ENGAGE", speedPercent: 100, courseDeg: 270, speedKnots: 12 } as const;

  it("carries a course and a speed in knots through the wire dtos and the combat shape", () => {
    const dtos = ordersToDtos({ a1: steered });
    expect(dtos).toEqual([{ divisionId: "a1", ...steered }]);
    expect(toCombatOrders(dtos)).toEqual({ divisions: { a1: steered } });
  });

  it("restores a standing course order over the default", () => {
    const orders = standingOrdersFor(viewOf("uk"), [{ divisionId: "a1", ...steered }]);
    expect(orders.a1).toEqual(steered);
    expect(orders.a2).toEqual(DEFAULT_DIVISION_ORDER);
  });

  it("leaves the keys out when no course or knots were ordered", () => {
    expect(
      Object.keys(
        toCombatOrders([{ divisionId: "a1", stance: "HOLD", speedPercent: 0 }]).divisions.a1!,
      ),
    ).toEqual(["stance", "speedPercent"]);
  });
});
