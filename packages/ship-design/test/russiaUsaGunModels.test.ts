import { describe, it, expect } from "vite-plus/test";
import { armamentContentLintOk, lintArmamentContent } from "../src/armamentContent.js";
import { armamentContent, armamentCoverageInput } from "./helpers/armamentContext.js";

const PROMOTED: Readonly<Record<string, { readonly nationId: string; readonly familyId: string }>> =
  {
    ru_12in30_obr1877: { nationId: "russia", familyId: "gun_bl_12in_25" },
    ru_11in_obr1867: { nationId: "russia", familyId: "gun_rml_11in_25ton" },
    ru_8in_obr1867: { nationId: "russia", familyId: "gun_rml_8in_9ton" },
    us_dahlgren_15in: { nationId: "usa", familyId: "gun_sb_15in_dahlgren" },
    us_parrott_100pdr: { nationId: "usa", familyId: "gun_rml_64in_parrott" },
  };

const UNSOURCED = ["ru_6in_obr1867", "us_parrott_300pdr", "us_dahlgren_8in"] as const;

describe("Russian and US 1880s gun models (issue #880)", () => {
  const findings = lintArmamentContent(armamentCoverageInput);

  it("has no blocking finding at release", () => {
    expect(armamentContentLintOk(findings)).toBe(true);
  });

  for (const [id, expected] of Object.entries(PROMOTED)) {
    describe(id, () => {
      it("is a first-class gun model on its profile family", () => {
        const model = armamentContent.gunModels.find((m) => m.id === id);
        expect(model?.nationId).toBe(expected.nationId);
        expect(model?.familyId).toBe(expected.familyId);
      });

      it("has no missing first-class counterpart advisory", () => {
        const missing = findings.filter(
          (f) => f.code === "ARMAMENT_REFERENCE_MISSING" && JSON.stringify(f).includes(`"${id}"`),
        );
        expect(missing).toEqual([]);
      });
    });
  }

  for (const id of UNSOURCED) {
    it(`leaves ${id} unpromoted because no source was found`, () => {
      expect(armamentContent.gunModels.some((m) => m.id === id)).toBe(false);
    });
  }
});
