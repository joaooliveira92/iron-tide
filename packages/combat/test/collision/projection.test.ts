import { describe, expect, it } from "vite-plus/test";
import {
  PROVISIONAL_COLLISION_RULES,
  collisionRadiusM,
  projectShipCollisionContext,
} from "@bluewave/combat/collision";

describe("projecting design hull dimensions into the collision context", () => {
  it("converts millimetre hull dimensions to metres in sorted asset order", () => {
    const context = projectShipCollisionContext(PROVISIONAL_COLLISION_RULES, {
      b: { lengthMm: 90_000, beamMm: 9_000 },
      a: { lengthMm: 120_999, beamMm: 12_500 },
    });
    expect(Object.keys(context.ships)).toEqual(["a", "b"]);
    expect(context.ships["a"]).toEqual({ lengthM: 120, beamM: 12 });
    expect(context.rules).toBe(PROVISIONAL_COLLISION_RULES);
  });

  it("derives a larger radius for a longer, broader hull", () => {
    const context = projectShipCollisionContext(PROVISIONAL_COLLISION_RULES, {
      small: { lengthMm: 60_000, beamMm: 6_000 },
      large: { lengthMm: 150_000, beamMm: 18_000 },
    });
    const small = collisionRadiusM(context.rules, context.ships["small"]!);
    const large = collisionRadiusM(context.rules, context.ships["large"]!);
    expect(small).toBe(19);
    expect(large).toBe(48);
  });

  it("rejects a non-integer millimetre dimension", () => {
    expect(() =>
      projectShipCollisionContext(PROVISIONAL_COLLISION_RULES, {
        a: { lengthMm: 90_000.5, beamMm: 9_000 },
      }),
    ).toThrow();
  });
});
