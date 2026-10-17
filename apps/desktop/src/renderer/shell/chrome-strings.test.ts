import { describe, expect, it } from "vite-plus/test";

import { EN_US_MESSAGES, translate } from "../lib/strings.js";
import { CAMPAIGN_NAVIGATION_SECTIONS } from "./campaign-navigation.js";
import { CAMPAIGN_SCREEN_REGISTRY } from "./campaign-screen-registry.js";

describe("shell chrome string catalogue (U-4 ticket 06)", () => {
  it("resolves every registered screen's label and short label from the catalogue", () => {
    for (const screen of CAMPAIGN_SCREEN_REGISTRY) {
      const labelKey = `nav.screen.${screen.id}.label`;
      const shortKey = `nav.screen.${screen.id}.short`;
      expect(translate(labelKey)).toBe(screen.label);
      expect(translate(shortKey)).toBe(screen.shortLabel);
      expect(screen.label).not.toBe(labelKey);
      expect(screen.shortLabel).not.toBe(shortKey);
    }
  });

  it("resolves every navigation section heading from the catalogue", () => {
    for (const section of CAMPAIGN_NAVIGATION_SECTIONS) {
      const key = `nav.section.${section.id}`;
      expect(translate(key)).not.toBe("");
      expect(translate(key)).not.toBe(key);
      expect(section.label).toBe(translate(key));
    }
  });

  it("never stores a raw key as its own en-US message", () => {
    for (const [key, value] of Object.entries(EN_US_MESSAGES)) {
      expect(value.length).toBeGreaterThan(0);
      expect(value).not.toBe(key);
    }
  });
});
