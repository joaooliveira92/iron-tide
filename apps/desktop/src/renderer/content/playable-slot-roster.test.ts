import { describe, expect, it } from "vite-plus/test";
import { PLAYABLE_SLOT_COUNTRY_IDS } from "./nationAssetManifest.js";

// Manual p.18 gives the base nine (Great Britain, Germany, France,
// Austria-Hungary, Russia, Italy, Japan, China, Spain); DR-014 / ADR-0214
// promotes the USA from AI-only to a playable slot.
const PLAYABLE_TEN = ["gb", "de", "us", "jp", "fr", "it", "ru", "ah", "es", "qing"] as const;

describe("playable-slot roster (DR-014 / ADR-0214)", () => {
  it("offers exactly the ten playable nations", () => {
    expect([...PLAYABLE_SLOT_COUNTRY_IDS]).toEqual([...PLAYABLE_TEN]);
  });

  it("offers the USA as a playable slot", () => {
    expect(PLAYABLE_TEN).toHaveLength(10);
    expect(PLAYABLE_SLOT_COUNTRY_IDS as readonly string[]).toContain("us");
  });
});
