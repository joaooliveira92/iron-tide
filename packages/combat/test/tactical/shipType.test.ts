import { describe, it, expect } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  classifyShip,
  CANONICAL_SHIP_TYPES,
  SHIP_TYPE_CLASSIFIER_VERSION,
  InvalidShipType,
} from "../../src/tactical/shipType.js";
import type { CompiledDesignVersion } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import { makeDesign } from "../fixtures/unit-fixture.js";

describe("DESIGN-22 ship-type classifier (ship_type_classifier_v1)", () => {
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
    expect(SHIP_TYPE_CLASSIFIER_VERSION).toBe("ship_type_classifier_v1");
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
