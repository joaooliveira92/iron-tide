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
