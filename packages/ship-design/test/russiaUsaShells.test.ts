import { describe, it, expect } from "vite-plus/test";
import { armamentAmmunitionFor } from "../src/armamentAmmunition.js";
import { armamentContent } from "./helpers/armamentContext.js";

interface ExpectedShell {
  readonly shellType: string;
  readonly shellMassG: number;
  readonly explosiveFillerG: number;
  readonly penetrationBiasBp: number;
  readonly ammunitionCostMicro: number;
  readonly modelId: string;
}

const SHELLS: Readonly<Record<string, ExpectedShell>> = {
  ru_cast_iron_11in: {
    shellType: "HE",
    shellMassG: 222000,
    explosiveFillerG: 7450,
    penetrationBiasBp: 2500,
    ammunitionCostMicro: 2004660,
    modelId: "ru_11in_obr1867",
  },
  ru_chilled_iron_11in: {
    shellType: "AP",
    shellMassG: 225200,
    explosiveFillerG: 3280,
    penetrationBiasBp: 9000,
    ammunitionCostMicro: 2033556,
    modelId: "ru_11in_obr1867",
  },
  ru_cast_iron_8in: {
    shellType: "HE",
    shellMassG: 73700,
    explosiveFillerG: 2640,
    penetrationBiasBp: 2500,
    ammunitionCostMicro: 665511,
    modelId: "ru_8in_obr1867",
  },
  ru_chilled_iron_8in: {
    shellType: "AP",
    shellMassG: 84800,
    explosiveFillerG: 550,
    penetrationBiasBp: 9000,
    ammunitionCostMicro: 765744,
    modelId: "ru_8in_obr1867",
  },
  us_shell_15in_dahlgren: {
    shellType: "HE",
    shellMassG: 149700,
    explosiveFillerG: 5900,
    penetrationBiasBp: 2500,
    ammunitionCostMicro: 1351791,
    modelId: "us_dahlgren_15in",
  },
  us_cored_shot_15in_dahlgren: {
    shellType: "AP",
    shellMassG: 181400,
    explosiveFillerG: 0,
    penetrationBiasBp: 9000,
    ammunitionCostMicro: 1102368,
    modelId: "us_dahlgren_15in",
  },
};

describe("Russian obr.1867 and US XV-inch shell patterns (issues #880, #898)", () => {
  for (const [id, expected] of Object.entries(SHELLS)) {
    it(`authors ${id} with mass, filler, penetration bias and cost, scoped to ${expected.modelId}`, () => {
      const pattern = armamentContent.ammunition.find((a) => a.id === id);
      expect(pattern?.shellType).toBe(expected.shellType);
      expect(pattern?.shellMassG).toBe(expected.shellMassG);
      expect(pattern?.explosiveFillerG).toBe(expected.explosiveFillerG);
      expect(pattern?.penetrationBiasBp).toBe(expected.penetrationBiasBp);
      expect(pattern?.ammunitionCostMicro).toBe(expected.ammunitionCostMicro);
      expect(pattern?.compatibleGunModelIds).toEqual([expected.modelId]);
      expect(pattern?.compatibleGunFamilies).toBeUndefined();
    });
  }

  it("labels every derived value BALANCE_TARGET so the owner review list stays visible", () => {
    for (const id of Object.keys(SHELLS)) {
      const pattern = armamentContent.ammunition.find((a) => a.id === id);
      expect(pattern?.provenance.sourceStatus, id).toBe("BALANCE_TARGET");
    }
  });

  it("keeps the nation default patterns for the families starters place", () => {
    expect(
      armamentAmmunitionFor(armamentContent, "usa", "gun_sb_15in_dahlgren", "1880-01")?.id,
    ).toBe("us_common_shell");
    expect(
      armamentAmmunitionFor(armamentContent, "russia", "gun_rml_11in_25ton", "1880-01")?.id,
    ).toBe("ru_ap_steel");
  });
});
