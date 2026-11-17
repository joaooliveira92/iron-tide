import { describe, it, expect } from "vite-plus/test";
import { armamentAmmunitionFor } from "../src/armamentAmmunition.js";
import { armamentContent } from "./helpers/armamentContext.js";

interface ExpectedShell {
  readonly shellType: string;
  readonly shellMassG: number;
  readonly explosiveFillerG?: number;
  readonly modelId: string;
}

const SHELLS: Readonly<Record<string, ExpectedShell>> = {
  ru_cast_iron_11in: {
    shellType: "HE",
    shellMassG: 222000,
    explosiveFillerG: 7450,
    modelId: "ru_11in_obr1867",
  },
  ru_chilled_iron_11in: {
    shellType: "AP",
    shellMassG: 225200,
    explosiveFillerG: 3280,
    modelId: "ru_11in_obr1867",
  },
  ru_cast_iron_8in: {
    shellType: "HE",
    shellMassG: 73700,
    explosiveFillerG: 2640,
    modelId: "ru_8in_obr1867",
  },
  ru_chilled_iron_8in: { shellType: "AP", shellMassG: 84800, modelId: "ru_8in_obr1867" },
  us_shell_15in_dahlgren: { shellType: "HE", shellMassG: 149700, modelId: "us_dahlgren_15in" },
  us_cored_shot_15in_dahlgren: {
    shellType: "AP",
    shellMassG: 181400,
    modelId: "us_dahlgren_15in",
  },
};

describe("Russian obr.1867 and US XV-inch shell patterns (issue #880)", () => {
  for (const [id, expected] of Object.entries(SHELLS)) {
    it(`authors ${id} with the sourced mass, scoped to ${expected.modelId}`, () => {
      const pattern = armamentContent.ammunition.find((a) => a.id === id);
      expect(pattern?.shellType).toBe(expected.shellType);
      expect(pattern?.shellMassG).toBe(expected.shellMassG);
      expect(pattern?.explosiveFillerG).toBe(expected.explosiveFillerG);
      expect(pattern?.compatibleGunModelIds).toEqual([expected.modelId]);
      expect(pattern?.compatibleGunFamilies).toBeUndefined();
      expect(pattern?.penetrationBiasBp).toBeUndefined();
    });
  }

  it("keeps the nation default patterns for the families starters place", () => {
    expect(
      armamentAmmunitionFor(armamentContent, "usa", "gun_sb_15in_dahlgren", "1880-01")?.id,
    ).toBe("us_common_shell");
    expect(
      armamentAmmunitionFor(armamentContent, "russia", "gun_rml_11in_25ton", "1880-01")?.id,
    ).toBe("ru_ap_steel");
  });
});
