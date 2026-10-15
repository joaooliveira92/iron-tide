import { describe, expect, it } from "vite-plus/test";
import {
  STRATEGIC_DESTINATION_SECTIONS,
  type StrategicDestination,
} from "./strategic-destination.js";

// Type-level contract (spec §5 "Deep-link destinations"): the union accepts
// the renamed screen, carries the focus fields unvalidated, and rejects the
// legacy literal.
const diplomacy: StrategicDestination = {
  section: "diplomacy",
  focusNationId: "nation_germany",
};
const overview: StrategicDestination = { section: "overview" };
// @ts-expect-error — INC-14 renames "foreign-relations" to "diplomacy" to
// match the shipped Diplomacy & War screen; the legacy literal must not
// survive in the union.
const legacy: StrategicDestination = { section: "foreign-relations" };

describe("StrategicDestination (spec §5 deep-link destinations)", () => {
  it("maps to the five real navigable screens, with the renamed diplomacy screen", () => {
    expect(STRATEGIC_DESTINATION_SECTIONS).toEqual([
      "overview",
      "construction",
      "fleet",
      "research",
      "diplomacy",
    ]);
  });

  it("no longer contains the legacy foreign-relations literal", () => {
    expect(STRATEGIC_DESTINATION_SECTIONS).not.toContain("foreign-relations");
  });

  it("has no treasury destination — only the stub nav slot exists (cash priorities point at overview)", () => {
    expect(STRATEGIC_DESTINATION_SECTIONS).not.toContain("treasury");
  });

  it("accepts the renamed diplomacy destination with its unvalidated focus field", () => {
    expect(diplomacy.section).toBe("diplomacy");
    expect(diplomacy.focusNationId).toBe("nation_germany");
    expect(overview.section).toBe("overview");
    // The focus* fields are carried unvalidated (no target validation here —
    // their real targets are produced by later tickets).
    expect("focusNationId" in diplomacy).toBe(true);
  });

  it("rejects the legacy literal at the type level", () => {
    // `legacy` only type-checks because of the @ts-expect-error above; at
    // runtime the canonical section list never contains the legacy value.
    expect(legacy).toBeDefined();
  });
});
