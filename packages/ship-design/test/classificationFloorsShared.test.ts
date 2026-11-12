import { describe, expect, it } from "vite-plus/test";
import { DESIGN_22_CLASS_FLOORS } from "@bluewave/contracts";
import { DESIGN_22_EARLY } from "../src/index.js";

describe("DESIGN_22_EARLY class floors", () => {
  it("are the shared contracts class floors, one source", () => {
    for (const key of Object.keys(
      DESIGN_22_CLASS_FLOORS,
    ) as (keyof typeof DESIGN_22_CLASS_FLOORS)[]) {
      expect(DESIGN_22_EARLY[key], key).toBe(DESIGN_22_CLASS_FLOORS[key]);
    }
  });
});
