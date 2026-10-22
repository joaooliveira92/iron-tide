import { describe, expect, it } from "vite-plus/test";
import { SafeInt } from "@bluewave/contracts";
import {
  coastalArtilleryEffectivenessBp,
  type CoastalArtilleryEffectivenessInput,
} from "@bluewave/combat/coastal-defense";

function baseInput(
  overrides: Partial<CoastalArtilleryEffectivenessInput> = {},
): CoastalArtilleryEffectivenessInput {
  return {
    caliberMm: SafeInt(305),
    hasAA: false,
    targetType: "COASTAL_BATTERY",
    damageMultiplierBp: SafeInt(10_000),
    seaStateMultiplierBp: SafeInt(10_000),
    ...overrides,
  };
}

describe("coastalArtilleryEffectivenessBp", () => {
  it("returns positive bp for default input", () => {
    const result = coastalArtilleryEffectivenessBp(baseInput());
    expect(result.valueOf()).toBeGreaterThan(0);
  });

  it("is deterministic for same inputs", () => {
    const a = coastalArtilleryEffectivenessBp(baseInput());
    const b = coastalArtilleryEffectivenessBp(baseInput());
    expect(a.valueOf()).toBe(b.valueOf());
  });

  it("responds to caliber changes", () => {
    const small = coastalArtilleryEffectivenessBp(baseInput({ caliberMm: SafeInt(100) }));
    const large = coastalArtilleryEffectivenessBp(baseInput({ caliberMm: SafeInt(400) }));
    expect(large.valueOf()).toBeGreaterThan(small.valueOf());
  });

  it("responds to damage multiplier changes", () => {
    const full = coastalArtilleryEffectivenessBp(
      baseInput({ damageMultiplierBp: SafeInt(10_000) }),
    );
    const half = coastalArtilleryEffectivenessBp(baseInput({ damageMultiplierBp: SafeInt(5_000) }));
    expect(full.valueOf()).toBeGreaterThan(half.valueOf());
  });

  it("responds to sea state multiplier changes", () => {
    const calm = coastalArtilleryEffectivenessBp(
      baseInput({ seaStateMultiplierBp: SafeInt(10_000) }),
    );
    const rough = coastalArtilleryEffectivenessBp(
      baseInput({ seaStateMultiplierBp: SafeInt(5_000) }),
    );
    expect(calm.valueOf()).toBeGreaterThan(rough.valueOf());
  });

  it("different target types produce different results", () => {
    const battery = coastalArtilleryEffectivenessBp(baseInput({ targetType: "COASTAL_BATTERY" }));
    const transport = coastalArtilleryEffectivenessBp(
      baseInput({ targetType: "TRANSPORT_CONCENTRATION" }),
    );
    expect(battery.valueOf()).not.toBe(transport.valueOf());
  });

  it("floors the result (integer division)", () => {
    const low = coastalArtilleryEffectivenessBp(
      baseInput({
        caliberMm: SafeInt(75),
        targetType: "TRANSPORT_CONCENTRATION",
        damageMultiplierBp: SafeInt(5_000),
        seaStateMultiplierBp: SafeInt(5_000),
      }),
    );
    expect(Number.isInteger(low.valueOf())).toBe(true);
  });
});
