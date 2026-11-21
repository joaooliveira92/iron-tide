import { describe, expect, it } from "vite-plus/test";
import { cloneSnapshot } from "../src/snapshotClone.js";
import { ATTACKER_NATION, makeBattleSnapshot, makeShip } from "./battle-fixtures.js";

describe("snapshotClone — interned ships", () => {
  it("deep-clones the internment record without sharing it with the input", () => {
    const internment = {
      sinceMonth: "1880-03",
      cause: "FUEL_EXHAUSTION",
      readinessBefore: "ACTIVE",
    } as const;
    const interned = makeShip("g1", "dv-att-a", ATTACKER_NATION, { internment });
    const input = makeBattleSnapshot({ attackerShips: [interned] });
    const inputShip = input.nations.get(ATTACKER_NATION)!.fleets[0]!.ships[0]!;
    const cloneShip = cloneSnapshot(input).nations.get(ATTACKER_NATION)!.fleets[0]!.ships[0]!;
    expect(cloneShip.internment).toEqual(internment);
    expect(cloneShip.internment).not.toBe(inputShip.internment);
  });
});
