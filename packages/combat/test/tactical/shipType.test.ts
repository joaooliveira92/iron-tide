import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  classifyShip,
  CANONICAL_SHIP_TYPES,
  SHIP_TYPE_CLASSIFIER_VERSION,
  InvalidShipType,
} from "@bluewave/combat/tactical";
import type { CompiledDesignVersion } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { makeDesign } from "../fixtures/unit-fixture.js";

describe("DESIGN-22 ship-type classifier (ship_type_classifier_v2)", () => {
  it("registry is exactly 14 types, no extension fallback", () => {
    expect(CANONICAL_SHIP_TYPES).toHaveLength(14);
    expect([...CANONICAL_SHIP_TYPES]).toEqual([
      "CV",
      "CVL",
      "AV",
      "SS",
      "MTB",
      "TR",
      "BB",
      "BC",
      "B",
      "CA",
      "CL",
      "DD",
      "KE",
      "AMC",
    ]);
    expect(SHIP_TYPE_CLASSIFIER_VERSION).toBe("ship_type_classifier_v2");
  });

  it("dreadnought hull -> BB", () => {
    expect(classifyShip(makeDesign({ hullType: "dreadnought" }))).toBe("BB");
  });

  it("battlecruiser hull -> BC", () => {
    const d = makeDesign({ hullType: "battlecruiser" });
    expect(classifyShip(d)).toBe("BC");
  });

  it("heavy_cruiser hull -> CA", () => {
    const d = makeDesign({
      hullType: "heavy_cruiser",
      normalizedDisplacementKg: SafeInt(10_000_000),
    });
    expect(classifyShip(d)).toBe("CA");
  });

  it("unregistered hullType -> InvalidShipType", () => {
    const d = makeDesign({ hullType: "flying_submarine" } as CompiledDesignVersion);
    expect(() => classifyShip(d)).toThrow(BluewaveError);
    expect(() => classifyShip(d)).toThrow(new RegExp(InvalidShipType));
  });

  it("below-family minimum displacement rejects loud", () => {
    const d = makeDesign({ normalizedDisplacementKg: SafeInt(3_000_000) });
    expect(() => classifyShip(d)).toThrow(new RegExp(InvalidShipType));
  });

  it("deterministic: identical design -> identical class, no state", () => {
    const d = makeDesign();
    expect(classifyShip(d)).toBe(classifyShip(d));
  });
});

describe("1880 opening-era armoured families (ADR-0228, ship_type_classifier_v2)", () => {
  const hull = (
    designVersionId: string,
    hullType: string,
    kg: number,
    armorUm: number,
    caliberUm: number,
    speedKnots: number,
  ): CompiledDesignVersion =>
    makeDesign({
      designVersionId,
      hullType,
      normalizedDisplacementKg: SafeInt(kg),
      normalizedArmorUm: SafeInt(armorUm),
      mainGunsCaliber: SafeInt(caliberUm),
      normalizedSpeedUms: SafeInt(speedKnots * 514_444),
    });

  it.each([
    ["des_usa_amphitrite", "monitor", 4_000_000, 229_000, 254_000, 6],
    ["des_jpn_fuso", "central_battery_ship", 3_720_000, 230_000, 240_000, 7],
    ["des_nld_schorpioen", "coast_defense_ship", 2_175_000, 152_000, 230_000, 6],
    ["des_nld_buffel", "coast_defense_ship", 2_130_000, 152_000, 230_000, 6],
    ["des_por_vasco_da_gama", "central_battery_ship", 3_017_000, 229_000, 260_000, 7],
    ["des_bra_brasil", "central_battery_ship", 1_516_000, 114_000, 203_000, 6],
    ["des_esp_numancia", "central_battery_ship", 7_017_000, 130_000, 203_000, 6],
  ] as const)(
    "%s (%s) -> B (ADR-0116 v2 opening band)",
    (id, hullType, kg, armorUm, caliberUm, speedKnots) => {
      expect(classifyShip(hull(id, hullType, kg, armorUm, caliberUm, speedKnots))).toBe("B");
    },
  );

  it("rejects an opening-era hull above the slow battle-line speed cap", () => {
    const fast = hull("des_fast_cb", "central_battery_ship", 3_000_000, 200_000, 203_000, 21);
    expect(() => classifyShip(fast)).toThrow(new RegExp(InvalidShipType));
  });

  it("leaves the modern pre-dreadnought B floor at 5,000,000 kg", () => {
    const small = hull("des_small_pd", "pre_dreadnought", 4_500_000, 200_000, 254_000, 10);
    expect(() => classifyShip(small)).toThrow(new RegExp(InvalidShipType));
  });
});
