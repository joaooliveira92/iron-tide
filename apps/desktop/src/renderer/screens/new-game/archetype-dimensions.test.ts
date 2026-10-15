import { ARCHETYPE_DIMENSIONS } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import {
  ARCHETYPE_DIMENSION_DESCRIPTORS,
  archetypeDimensionDescriptor,
  archetypeDimensionLabel,
} from "./archetype-dimensions.js";

describe("archetype dimension descriptors", () => {
  it("covers exactly the engine's dimensions, in the engine's canonical order", () => {
    expect(ARCHETYPE_DIMENSION_DESCRIPTORS.map((descriptor) => descriptor.dimension)).toEqual([
      ...ARCHETYPE_DIMENSIONS,
    ]);
  });

  it("gives every dimension a complete presentation descriptor", () => {
    for (const descriptor of ARCHETYPE_DIMENSION_DESCRIPTORS) {
      expect(descriptor.label).not.toHaveLength(0);
      expect(descriptor.hint).not.toHaveLength(0);
      expect(descriptor.icon).toBeDefined();
      expect(descriptor.accentClassName).not.toHaveLength(0);
      expect(descriptor.barClassName).not.toHaveLength(0);
    }
  });

  it("looks up a descriptor by dimension", () => {
    for (const dimension of ARCHETYPE_DIMENSIONS) {
      expect(archetypeDimensionDescriptor(dimension).dimension).toBe(dimension);
      expect(archetypeDimensionLabel(dimension)).toBe(
        archetypeDimensionDescriptor(dimension).label,
      );
    }
  });
});
