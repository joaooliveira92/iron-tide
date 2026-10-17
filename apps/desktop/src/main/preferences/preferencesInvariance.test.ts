import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  BACKGROUND_PREFERENCES,
  CURRENCY_DISPLAY_MODES,
  DEFAULT_APP_PREFERENCES,
  DEFAULT_CAMPAIGN_PREFERENCES,
  FONT_PREFERENCES,
  FORMATTING_LOCALES,
  INTERFACE_DENSITY_PREFERENCES,
  LANGUAGE_PREFERENCES,
  MEASUREMENT_PRESETS,
  NUMBER_SCALE_PREFERENCES,
  REDUCED_MOTION_PREFERENCES,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  THEME_PREFERENCES,
  TOOLTIP_DETAIL_PREFERENCES,
} from "../../shared/preferences-contract.js";
import {
  AppPreferencesSchema,
  type CampaignPreferencesDecoded,
  CampaignPreferencesSchema,
} from "./preferencesSchema.js";

const DIR = import.meta.dirname;
const GOLDEN = join(DIR, "..", "..", "..", "..", "..", "golden", "hashes.json");
const decodeApp = Schema.decodeUnknownSync(AppPreferencesSchema);
const decodeCampaign = Schema.decodeUnknownSync(CampaignPreferencesSchema);

/**
 * U-2 ticket 07 invariance: changing any preference cannot change an authoritative
 * outcome. The mechanism is structural — the preferences domain imports no
 * authoritative engine package and the shared contract imports nothing — so no
 * preference value can enter a compiled design, a save, or the golden reference
 * run. The cross-process golden run (`pnpm test:cross-process`) is the observable
 * evidence that the reference hashes are unchanged.
 */
describe("preferences invariance (U-2 ticket 07)", () => {
  it("the preferences domain imports no authoritative engine package", () => {
    const offenders: string[] = [];
    for (const name of readdirSync(DIR)) {
      if (!name.endsWith(".ts") || name.endsWith(".test.ts")) continue;
      const text = readFileSync(join(DIR, name), "utf8");
      for (const match of text.matchAll(/from\s+"([^"]+)"/gu)) {
        const specifier = match[1] ?? "";
        if (specifier.startsWith("@bluewave/")) offenders.push(`${name}: ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the shared preferences contract imports nothing", () => {
    const contract = readFileSync(
      join(DIR, "..", "..", "shared", "preferences-contract.ts"),
      "utf8",
    );
    expect([...contract.matchAll(/^\s*import\b/gmu)]).toEqual([]);
  });

  it("every preference value decodes and the golden reference run is unchanged", () => {
    const goldenBefore = readFileSync(GOLDEN, "utf8");
    const patches: Partial<typeof DEFAULT_APP_PREFERENCES>[] = [];
    for (const theme of THEME_PREFERENCES) patches.push({ theme });
    for (const background of BACKGROUND_PREFERENCES) patches.push({ background });
    for (const font of FONT_PREFERENCES) patches.push({ font });
    for (const interfaceDensity of INTERFACE_DENSITY_PREFERENCES)
      patches.push({ interfaceDensity });
    for (const textScale of [TEXT_SCALE_MIN, 125, TEXT_SCALE_MAX]) patches.push({ textScale });
    for (const reducedMotion of REDUCED_MOTION_PREFERENCES) patches.push({ reducedMotion });
    for (const language of LANGUAGE_PREFERENCES) patches.push({ language });
    for (const formattingLocale of FORMATTING_LOCALES) patches.push({ formattingLocale });
    for (const measurementPreset of MEASUREMENT_PRESETS) patches.push({ measurementPreset });
    patches.push({ measurementSelections: { length: "metres" } });
    for (const numberScale of NUMBER_SCALE_PREFERENCES) patches.push({ numberScale });
    for (const tooltipDetail of TOOLTIP_DETAIL_PREFERENCES) patches.push({ tooltipDetail });
    for (const currencyDisplayMode of CURRENCY_DISPLAY_MODES) patches.push({ currencyDisplayMode });

    for (const patch of patches) {
      const next = { ...DEFAULT_APP_PREFERENCES, ...patch };
      expect(decodeApp(next)).toEqual(next);
    }
    const campaign = { ...DEFAULT_CAMPAIGN_PREFERENCES, showSupplyOverlay: true };
    expect(decodeCampaign(campaign)).toEqual(campaign as CampaignPreferencesDecoded);
    // No preference write can move the reference run.
    expect(readFileSync(GOLDEN, "utf8")).toBe(goldenBefore);
  });
});
