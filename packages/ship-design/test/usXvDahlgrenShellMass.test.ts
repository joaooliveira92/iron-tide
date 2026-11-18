import { join } from "node:path";
import { FlattenedPartSchema, decodeStrict, type FlattenedPart } from "@bluewave/content-schema";
import { readAuthoredFile } from "@bluewave/test-support";
import { describe, expect, it } from "vite-plus/test";
import { armamentContent } from "./helpers/armamentContext.js";
import { components, navalProfiles } from "./helpers/earlyContext.js";

const GRAMS_PER_POUND = 453.59237;
const FILLED_AND_SABOTTED_LB = 352;
const SHELL_MASS_G = 159700;
const SERVICE_CHARGE_LB = 50;
const CHARGE_BP = 1420;

const partsDir = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "content",
  "production",
  "1880",
  "ship-building",
  "parts",
);
const gunParts: readonly FlattenedPart[] = (
  readAuthoredFile(join(partsDir, "gun.ts")) as { parts: unknown[] }
).parts.map((record) => decodeStrict(FlattenedPartSchema, record));
const xvParts = gunParts.filter(
  (p) => p.family === "gun" && p.spec.gunFamily === "gun_sb_15in_dahlgren",
);

describe("US XV-inch Dahlgren shell mass (issue #915)", () => {
  it("authors the 352 lb filled-and-sabotted round, not the 330 lb empty casting", () => {
    expect(Math.round((FILLED_AND_SABOTTED_LB * GRAMS_PER_POUND) / 100) * 100).toBe(SHELL_MASS_G);
    const shell = armamentContent.ammunition.find((a) => a.id === "us_shell_15in_dahlgren");
    expect(shell?.shellMassG).toBe(SHELL_MASS_G);
    const model = armamentContent.gunModels.find((g) => g.id === "us_dahlgren_15in");
    expect(model?.shellMassG).toBe(SHELL_MASS_G);
  });

  it("keeps the 50 lb service charge in pounds by rescaling the charge ratio to the heavier round", () => {
    const model = armamentContent.gunModels.find((g) => g.id === "us_dahlgren_15in");
    expect(model?.propellantChargeBp).toBe(CHARGE_BP);
    const chargeG = (SHELL_MASS_G * CHARGE_BP) / 10000;
    expect(chargeG / GRAMS_PER_POUND).toBeGreaterThan(SERVICE_CHARGE_LB - 0.3);
    expect(chargeG / GRAMS_PER_POUND).toBeLessThan(SERVICE_CHARGE_LB + 0.3);
  });

  it("carries the same mass and charge in the component, the profile overlay and both gun parts", () => {
    const component = components.find((c) => c.id === "gun_sb_15in_dahlgren");
    expect(Number(component?.attributes?.shellMassG)).toBe(SHELL_MASS_G);
    expect(Number(component?.attributes?.chargeBp)).toBe(CHARGE_BP);
    const usa = navalProfiles.find((p) => p.nationId === "usa");
    const overlay = usa?.gunModels.find((g) => g.id === "us_dahlgren_15in");
    expect(overlay?.overrides?.["attributes.shellMassG"]).toBe(String(SHELL_MASS_G));
    expect(xvParts.length).toBeGreaterThan(0);
    for (const part of xvParts) {
      if (part.family !== "gun") continue;
      expect(part.spec.shellMassG, part.id).toBe(SHELL_MASS_G);
      expect(part.spec.propellantChargeBp, part.id).toBe(CHARGE_BP);
    }
  });
});
