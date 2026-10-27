import { describe, expect, it } from "vite-plus/test";

import { decodeGunneryRules } from "../src/gunnery-rules.js";

const provenance = {
  sourceStatus: "BALANCE_TARGET",
  confidence: "LOW",
  kind: "balance_adjustment",
  sources: [{ title: "Rule the Waves 3 manual", page: "121, 127" }],
  note: "test",
};

const section = {
  sectionVersion: 1,
  radar: {
    accuracyBpByFireControlLevel: [10500, 11000, 12000],
    blindFireMinLevel: 3,
    airDefenseSaturationBpBySearchLevel: [10000, 11000, 12000],
  },
  provenance,
};

describe("gunnery rules section (#292)", () => {
  it("decodes the three-level radar table", () => {
    const decoded = decodeGunneryRules(section);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.radar.accuracyBpByFireControlLevel).toEqual([10500, 11000, 12000]);
      expect(decoded.value.radar.blindFireMinLevel).toBe(3);
    }
  });

  it("rejects an unknown key at the boundary", () => {
    const decoded = decodeGunneryRules({ ...section, extra: true });
    expect(decoded.ok).toBe(false);
  });

  it("rejects a blind-fire level outside 1-3", () => {
    const decoded = decodeGunneryRules({
      ...section,
      radar: { ...section.radar, blindFireMinLevel: 4 },
    });
    expect(decoded.ok).toBe(false);
  });

  it("rejects a table with the wrong length", () => {
    const decoded = decodeGunneryRules({
      ...section,
      radar: { ...section.radar, accuracyBpByFireControlLevel: [10000, 11000] },
    });
    expect(decoded.ok).toBe(false);
  });
});
