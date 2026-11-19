import { describe, expect, it } from "vite-plus/test";
import {
  gbrShips,
  runTrade,
  tradeEnvelope,
  tradeShip,
  tradeSnapshot,
} from "./fixtures/trade-protection.js";

const setDuty = (shipIds: string[], duty: "TRADE_PROTECTION" | "RAIDER" | "NONE") =>
  ({ type: "SetTradeDuty", nationId: "GBR", shipIds, duty }) as const;

describe("#997: SetTradeDuty command", () => {
  it("assigns the duty to ships in id order and records one event per ship", () => {
    const from = tradeSnapshot({
      gbrShips: [tradeShip("a", "d-dd"), tradeShip("b", "d-dd"), tradeShip("c", "d-dd")],
    });
    const result = runTrade(from, [tradeEnvelope(setDuty(["b", "a"], "TRADE_PROTECTION"), from)]);
    expect(gbrShips(result.finalSnapshot).map((s) => s.stationAssignment)).toEqual([
      "TRADE_PROTECTION",
      "TRADE_PROTECTION",
      undefined,
    ]);
    const events = result.eventLedger.all.filter(
      (e) => e.body.kind === "ShipStationAssignmentChanged",
    );
    expect(events.map((e) => (e.body as { shipId: string }).shipId)).toEqual(["a", "b"]);
    expect((events[0]!.body as { reason: string }).reason).toBe("TRADE_DUTY_ASSIGNED");
  });

  it("switches between duties and clears with one event each", () => {
    const from = tradeSnapshot({
      gbrShips: [tradeShip("a", "d-cp", { stationAssignment: "TRADE_PROTECTION" })],
    });
    const raider = runTrade(from, [tradeEnvelope(setDuty(["a"], "RAIDER"), from)]);
    expect(gbrShips(raider.finalSnapshot)[0]!.stationAssignment).toBe("RAIDER");
    const cleared = runTrade(from, [tradeEnvelope(setDuty(["a"], "NONE"), from)]);
    expect(gbrShips(cleared.finalSnapshot)[0]!.stationAssignment).toBeUndefined();
    const event = cleared.eventLedger.all.find(
      (e) => e.body.kind === "ShipStationAssignmentChanged",
    );
    expect((event!.body as { reason: string }).reason).toBe("TRADE_DUTY_CLEARED");
  });

  it("rejects the whole batch when one ship is ineligible, changing nothing", () => {
    const from = tradeSnapshot({
      gbrShips: [tradeShip("a", "d-dd"), tradeShip("r", "d-dd", { readiness: "RESERVE" })],
    });
    const result = runTrade(from, [tradeEnvelope(setDuty(["a", "r"], "RAIDER"), from)]);
    expect(gbrShips(result.finalSnapshot).every((s) => s.stationAssignment === undefined)).toBe(
      true,
    );
    const rejected = result.commandLedger.all.find((o) => o.type === "rejected");
    expect(rejected?.type === "rejected" && rejected.diagnostic.code).toBe("TRADE_DUTY_REJECTED");
  });

  it("refuses when the tradeProtection section is not authored", () => {
    const from = tradeSnapshot({ gbrShips: [tradeShip("a", "d-dd")] });
    const result = runTrade(from, [tradeEnvelope(setDuty(["a"], "RAIDER"), from)], null);
    expect(gbrShips(result.finalSnapshot)[0]!.stationAssignment).toBeUndefined();
    expect(result.collector.all.map((d) => d.code)).toContain("TRADE_DUTY_DORMANT");
  });
});
