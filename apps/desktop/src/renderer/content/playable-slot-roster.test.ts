import { describe, expect, it } from "vite-plus/test";
import { PLAYABLE_SLOT_COUNTRY_IDS } from "./nationAssetManifest.js";

// Manual p.18: the nine playable nations are Great Britain, Germany, France,
// Austria-Hungary, Russia, Italy, Japan, China, and Spain. The USA is an AI
// opponent and must not be offered as a playable slot (DR-005 / ADR-0205).
const MANUAL_NINE = ["gb", "de", "jp", "fr", "it", "ru", "ah", "es", "qing"] as const;

describe("playable-slot roster (DR-005 / ADR-0205)", () => {
  it("offers exactly the manual's nine playable nations", () => {
    expect([...PLAYABLE_SLOT_COUNTRY_IDS]).toEqual([...MANUAL_NINE]);
  });

  it("does not offer the USA as a playable slot", () => {
    expect(MANUAL_NINE).toHaveLength(9);
    expect(PLAYABLE_SLOT_COUNTRY_IDS as readonly string[]).not.toContain("us");
  });
});
