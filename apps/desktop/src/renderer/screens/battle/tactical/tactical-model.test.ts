import type { PlayerBattleShipView, PlayerBattleView } from "@bluewave/combat/battleResolution";
import { describe, expect, it } from "vite-plus/test";
import {
  PROVISIONAL_TRAIL_LENGTH,
  appendTrails,
  divisionOfShip,
  knownPositions,
  selectedShip,
  shipStatus,
} from "./tactical-model.js";

const ship = (patch: Partial<PlayerBattleShipView>): PlayerBattleShipView => ({
  shipId: "s1",
  name: "HMS One",
  className: "c",
  shipType: "ironclad",
  sideId: "ATTACKER",
  divisionId: "d1",
  hitPoints: 10,
  maxHitPoints: 10,
  damageState: "NORMAL",
  position: [0, 0],
  headingDeg: 0,
  speedBp: 0,
  contactConfidenceBp: null,
  ...patch,
});

const viewOf = (ships: PlayerBattleShipView[]): PlayerBattleView => ({
  battleId: "b",
  campaignMonth: "1880-02",
  playerNationId: "uk",
  areaId: "channel",
  attackerId: "uk",
  defenderId: "fr",
  minute: 0,
  maxMinutes: 10,
  ended: false,
  endReason: null,
  winnerId: null,
  loserId: null,
  objectives: [],
  weather: { seaState: "CALM", visibilityNm: 10, precipitation: "CLEAR", daylight: true },
  ships,
  divisions: [],
  log: [],
});

describe("ship status", () => {
  it("separates operational, damaged and sunk ships", () => {
    expect(shipStatus(ship({}))).toBe("operational");
    expect(shipStatus(ship({ hitPoints: 4 }))).toBe("damaged");
    expect(shipStatus(ship({ damageState: "CRIPPLED" }))).toBe("damaged");
    expect(shipStatus(ship({ damageState: "SINKING" }))).toBe("sunk");
    expect(shipStatus(ship({ damageState: "FOUNDERED" }))).toBe("sunk");
  });
});

describe("trails", () => {
  it("records a new point only when the ship has moved", () => {
    const first = appendTrails({}, viewOf([ship({ position: [1, 1] })]));
    const same = appendTrails(first, viewOf([ship({ position: [1, 1] })]));
    const moved = appendTrails(same, viewOf([ship({ position: [2, 3] })]));
    expect(same["s1"]).toHaveLength(1);
    expect(moved["s1"]).toEqual([
      [1, 1],
      [2, 3],
    ]);
  });

  it("bounds the history and forgets ships with no known position", () => {
    let trails = {};
    for (let step = 0; step < PROVISIONAL_TRAIL_LENGTH + 5; step += 1) {
      trails = appendTrails(trails, viewOf([ship({ position: [step, 0] })]));
    }
    expect((trails as Record<string, unknown[]>)["s1"]).toHaveLength(PROVISIONAL_TRAIL_LENGTH);
    expect(appendTrails(trails, viewOf([ship({ position: null })]))).toEqual({});
  });
});

describe("selection helpers", () => {
  const view = viewOf([ship({}), ship({ shipId: "s2", divisionId: null, position: null })]);

  it("finds the selected ship and its division", () => {
    expect(selectedShip(view, "s1")?.name).toBe("HMS One");
    expect(selectedShip(view, "gone")).toBeNull();
    expect(selectedShip(view, null)).toBeNull();
    expect(divisionOfShip(view, "s1")).toBe("d1");
    expect(divisionOfShip(view, "s2")).toBeNull();
  });

  it("lists only ships whose position is known", () => {
    expect(knownPositions(view)).toEqual([[0, 0]]);
  });
});
