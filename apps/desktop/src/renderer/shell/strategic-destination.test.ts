import { describe, expect, it } from "vite-plus/test";
import {
  STRATEGIC_DESTINATION_SECTIONS,
  type StrategicDestination,
} from "./strategic-destination.js";

const diplomacy: StrategicDestination = {
  section: "diplomacy",
  focusNationId: "nation_germany",
};
const overview: StrategicDestination = { section: "overview" };
// @ts-expect-error — INC-14 renames "foreign-relations" to "diplomacy" to
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
    expect("focusNationId" in diplomacy).toBe(true);
  });

  it("rejects the legacy literal at the type level", () => {
    expect(legacy).toBeDefined();
  });
});
