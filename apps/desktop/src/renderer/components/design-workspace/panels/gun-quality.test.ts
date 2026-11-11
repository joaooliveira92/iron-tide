import { describe, expect, it } from "vite-plus/test";
import { gunQualityLine } from "./gun-quality.js";

describe("gunQualityLine", () => {
  it("says the nation's gun industry sets quality per caliber band, not the design", () => {
    expect(gunQualityLine()).toBe(
      "Gun quality comes from your nation's gun industry for this caliber band, not from the design.",
    );
  });

  it("no longer claims quality is set by research", () => {
    expect(gunQualityLine()).not.toMatch(/research/i);
  });
});
