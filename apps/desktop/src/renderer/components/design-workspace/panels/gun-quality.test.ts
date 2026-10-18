import { describe, expect, it } from "vite-plus/test";
import { gunQualityLine, NEUTRAL_GUN_QUALITY } from "./gun-quality.js";

describe("gunQualityLine", () => {
  it("is read-only wording that says the design does not set quality", () => {
    expect(gunQualityLine(NEUTRAL_GUN_QUALITY)).toBe(
      "Gun quality 0 (neutral, no research bonus yet). Set by research, not by the design.",
    );
    expect(gunQualityLine(2)).toMatch(/^Gun quality \+2 \(from research\)/);
    expect(gunQualityLine(-1)).toMatch(/^Gun quality -1 \(from research\)/);
  });
});
