import { describe, it, expect } from "vite-plus/test";
import { compileDesign, nationHasArmamentContent } from "../src/index.js";
import { resolvableWeaponFamilies } from "../src/armamentCompile.js";
import { shipBuildingContent } from "./helpers/earlyContext.js";
import { armamentAmmunitionFor } from "../src/armamentAmmunition.js";
import { armamentContent } from "./helpers/armamentContext.js";
import { components, earlyContext } from "./helpers/earlyContext.js";
import { designs, gunPartModel, gunPlacements, resolveRow, where } from "./helpers/gunReadPath.js";
import { renderExplanation } from "./helpers/explanation.js";

const EXPECTED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  russia: {
    gun_rml_12in_25ton: "ru_ap_steel",
    gun_rml_10in_18ton: "ru_ap_steel",
    gun_rml_64pdr_71cwt: "ru_ap_steel",
    gun_nordenfelt_1in: "ru_ap_steel",
    gun_130mm_50_twin: "ru_he_130mm_50",
  },
  usa: {
    gun_rml_11in_25ton: "us_common_shell",
    gun_rml_7in_7ton: "us_common_shell",
    gun_rml_64pdr_71cwt: "us_common_shell",
    gun_nordenfelt_1in: "us_common_shell",
    gun_sb_15in_dahlgren: "us_common_shell",
    gun_dp_5in_38_twin: "us_he_5in_38",
    gun_dp_6in_47_twin: "us_ap_6in_47",
    gun_ap_8in_55_triple: "us_ap_8in_55",
    gun_ap_16in_50_triple: "us_ap_16in_50",
    gun_dp_5in_54_single: "us_he_5in_54",
  },
};

const NATIONS = ["russia", "usa"] as const;

describe("Russian and US per-era ammunition patterns (issue #867, builds on #856)", () => {
  for (const nation of NATIONS) {
    describe(nation, () => {
      const rows = gunPlacements.filter((r) => r.design.draft.nationId === nation);
      const expected = EXPECTED[nation] ?? {};

      it("has first-class armament content", () => {
        expect(nationHasArmamentContent(armamentContent, nation)).toBe(true);
      });

      it("resolves every starter gun family to its own era pattern at the starter month", () => {
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
          const pattern = armamentAmmunitionFor(
            armamentContent,
            nation,
            row.familyId,
            row.design.month,
          );
          expect(String(pattern?.id), where(row)).toBe(expected[row.familyId]);
        }
      });

      it("authors a pattern for every gun family its starters place", () => {
        const placed = new Set(rows.map((r) => r.familyId));
        expect([...placed].sort()).toEqual(Object.keys(expected).sort());
      });

      it("reads no starter placement on the legacy compatibility path", () => {
        for (const row of rows) {
          const got = resolveRow(row);
          expect(got.unresolved?.code, where(row)).not.toBe(
            "PART_READ_PATH_NO_FIRST_CLASS_ARMAMENT",
          );
          expect(got.unresolved?.code, where(row)).not.toBe("PART_READ_PATH_NO_AMMUNITION");
        }
      });

      it("compiles every starter with no blocking finding", () => {
        for (const d of designs.filter((x) => x.draft.nationId === nation)) {
          const r = compileDesign(d.draft, earlyContext(d.month));
          const blocking = r.findings.filter(
            (f) => f.severity === "BLOCKING" || f.severity === "CRITICAL",
          );
          expect(
            blocking.map((f) => `${f.id}: ${renderExplanation(f.what)}`),
            d.id,
          ).toEqual([]);
        }
      });
    });
  }

  it.each(NATIONS)(
    "%s: every domestic or licence-built gun family in service resolves, so the legacy path is not the only way to place it",
    (nation) => {
      const unresolved: string[] = [];
      for (let year = 1880; year <= 1990; year++) {
        const month = `${String(year)}-01`;
        const ctx = shipBuildingContent.environmentFor(month, nation).ctx;
        const resolvable = resolvableWeaponFamilies(ctx, nation);
        expect(resolvable, `${nation} ${month}`).not.toBeNull();
        for (const [familyId, entry] of Object.entries(ctx.navalProfile?.componentAccess ?? {})) {
          if (entry.status !== "DOMESTIC" && entry.status !== "LICENSE_BUILT") continue;
          const component = ctx.catalogue.find((c) => c.id === familyId);
          if (
            component === undefined ||
            !armamentContent.gunFamilies.some((f) => f.id === familyId) ||
            component.introduction.fromMonth > month ||
            !component.requires.every((t) => ctx.unlockedTechs.has(t))
          )
            continue;
          if (!resolvable!.has(familyId)) unresolved.push(`${month} ${familyId}`);
        }
      }
      expect([...new Set(unresolved.map((u) => u.split(" ")[1]))].sort()).toEqual([]);
    },
  );

  it("carries the navweaps shell masses that agree with the placed components", () => {
    const masses: Readonly<Record<string, number>> = {
      us_he_5in_38: 25000,
      us_ap_6in_47: 59000,
      us_ap_8in_55: 152000,
      us_ap_16in_50: 1225000,
      us_he_5in_54: 31450,
    };
    for (const [id, grams] of Object.entries(masses)) {
      const pattern = armamentContent.ammunition.find((a) => a.id === id);
      expect(pattern?.shellMassG, id).toBe(grams);
      expect(pattern?.compatibleGunFamilies?.length, id).toBe(1);
      const family = pattern?.compatibleGunFamilies?.[0];
      expect(
        components.some((c) => c.id === family),
        id,
      ).toBe(true);
    }
  });

  describe("Kotlin 130 mm shell (issue #879)", () => {
    const pattern = armamentContent.ammunition.find((a) => a.id === "ru_he_130mm_50");
    const component = components.find((c) => c.id === "gun_130mm_50_twin");
    const part = gunPartModel.parts.find((p) => p.id === "standard_gun_130mm_50_twin");

    it("carries the 33.0 kg OF-42 HE-FRAG shell of the 130 mm/58 SM-2-1 on pattern, component and part", () => {
      expect(pattern?.shellMassG).toBe(33000);
      expect(Number(component?.attributes?.shellMassG)).toBe(33000);
      expect(part?.spec.shellMassG).toBe(33000);
    });

    it("derives the charge from the 15.3 kg navweaps propellant over that shell", () => {
      expect(Number(component?.attributes?.chargeBp)).toBe(4636);
      expect(part?.spec.propellantChargeBp).toBe(4636);
    });

    it("keeps shell plus charge below the 61.4 kg navweaps complete round", () => {
      const grams = Number(component?.attributes?.shellMassG);
      const bp = Number(component?.attributes?.chargeBp);
      expect(grams + Math.round((grams * bp) / 10000)).toBeLessThanOrEqual(61400);
    });
  });

  it("keeps the 1880 Russian and US patterns on the profile values they were promoted from", () => {
    const ru = armamentContent.ammunition.find((a) => a.id === "ru_ap_steel");
    const us = armamentContent.ammunition.find((a) => a.id === "us_common_shell");
    expect([ru?.shellType, ru?.penetrationBiasBp]).toEqual(["AP", 6500]);
    expect([us?.shellType, us?.penetrationBiasBp]).toEqual(["AP", 5000]);
  });
});
