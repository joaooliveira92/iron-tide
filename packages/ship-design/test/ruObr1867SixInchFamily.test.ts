import { describe, it, expect } from "vite-plus/test";
import { armamentAmmunitionFor } from "../src/armamentAmmunition.js";
import { armamentContentLintOk, lintArmamentContent } from "../src/armamentContent.js";
import { compileDesign, type DesignDraft } from "../src/index.js";
import { armamentContent, armamentCoverageInput } from "./helpers/armamentContext.js";
import {
  components,
  navalProfiles,
  readReferenceDesignEntries,
  shipBuildingContent,
} from "./helpers/earlyContext.js";

const FAMILY = "gun_bl_6in_obr1867";
const SHARED_FAMILY = "gun_rml_64pdr_71cwt";

const RU_STARTER_HASHES: Readonly<Record<string, string>> = {
  petr_velikiy_1876: "5e4c29a6592c0ff02aedb8cf4b5366220e2280eff3439141846c677590ca4440",
  starter_ca_russia_1880: "d04cc6a2a11a54bb31715d59522267913d1b596cf88f2b1e82f970f844ed623e",
  starter_cl_russia_1880: "2d412370dfe61918d3c0a440dd2d15626f6e4d2ff4534a3323c44f7e08a52416",
  starter_dd_russia_1880: "78c4ceb5ee5dfbfe22168376253c52cb3b1b91f1f0f4e0b86f1e5a00e156ef45",
  starter_ke_russia_1880: "b61c9c72b1c4434fa60feed7e52f7ba34ea25250e53b3230a93bbf1dd832e3aa",
  starter_amc_russia_1880: "b3db515da67df95b34275dde2e4758abe7fb89aa36ffc3aff384d8593a395901",
  kotlin_class_dd_1954: "c51be8261b4bf57bba9219a86789cb6855816e07e85ac7ba962d3eca63c6478d",
};

describe("Russian 6-inch obr.1867 dedicated family (issue #892)", () => {
  const model = armamentContent.gunModels.find((m) => m.id === "ru_6in_obr1867");
  const family = armamentContent.gunFamilies.find((f) => f.id === FAMILY);
  const component = components.find((c) => c.id === FAMILY);

  it("authors the dedicated family with the navy.su numbers", () => {
    expect(family?.category).toBe("SECONDARY_GUN");
    expect(model?.familyId).toBe(FAMILY);
    expect(model?.nationId).toBe("russia");
    expect(model?.caliberUm).toBe(152400);
    expect(model?.gunMassKg).toBe(4259);
    expect(model?.shellMassG).toBe(33370);
    expect(model?.propellantChargeBp).toBe(2457);
    expect([...(model?.supportedMountTypes ?? [])].sort()).toEqual(["CASEMATE", "DECK_OPEN"]);
    expect(component?.constants.gun_kg).toBe(4259);
  });

  it("scopes the common and chilled shells to the model", () => {
    const common = armamentContent.ammunition.find((a) => a.id === "ru_cast_iron_6in");
    const chilled = armamentContent.ammunition.find((a) => a.id === "ru_chilled_iron_6in");
    expect(common?.shellType).toBe("HE");
    expect(common?.shellMassG).toBe(33370);
    expect(common?.explosiveFillerG).toBe(1950);
    expect(chilled?.shellType).toBe("AP");
    expect(chilled?.shellMassG).toBe(38080);
    for (const p of [common, chilled]) {
      expect(p?.nationId).toBe("russia");
      expect(p?.compatibleGunModelIds).toEqual(["ru_6in_obr1867"]);
      expect(p?.compatibleGunFamilies).toBeUndefined();
    }
  });

  it("grants the family domestically and leaves the shared family access alone", () => {
    const russia = navalProfiles.find((p) => p.nationId === "russia");
    expect(russia?.componentAccess[FAMILY]?.status).toBe("DOMESTIC");
    expect(russia?.componentAccess[SHARED_FAMILY]?.status).toBe("DOMESTIC");
    expect(russia?.gunModels.find((g) => g.id === "ru_6in_obr1867")?.familyId).toBe(FAMILY);
  });

  it("resolves the nation default ammunition for the new family", () => {
    expect(armamentAmmunitionFor(armamentContent, "russia", FAMILY, "1880-01")?.id).toBe(
      "ru_ap_steel",
    );
  });

  it("leaves the shared 64-pdr family and its models untouched", () => {
    const shared = components.find((c) => c.id === SHARED_FAMILY);
    expect(shared?.constants.gun_kg).toBe(3582);
    expect(Number(shared?.attributes?.shellMassG)).toBe(29000);
    for (const id of ["uk_rml_64pdr_71cwt", "fr_rml_64pdr_71cwt"]) {
      const m = armamentContent.gunModels.find((g) => g.id === id);
      expect(m?.shellMassG).toBe(29000);
      expect(m?.gunMassKg).toBe(3582);
    }
  });

  it("keeps every Russian starter design hash identical to the pre-change baseline", () => {
    const designs = readReferenceDesignEntries() as {
      id: string;
      month: string;
      draft: DesignDraft;
    }[];
    const russia = designs.filter((d) => d.draft.nationId === "russia");
    expect(russia.map((d) => d.id).sort()).toEqual(Object.keys(RU_STARTER_HASHES).sort());
    for (const d of russia) {
      const { ctx } = shipBuildingContent.environmentFor(d.month, "russia");
      const result = compileDesign(d.draft, ctx);
      expect(result.valid, d.id).toBe(true);
      expect(result.hash, d.id).toBe(RU_STARTER_HASHES[d.id]);
    }
  });

  it("lints clean with no drift and no missing counterpart for the 6-inch", () => {
    const findings = lintArmamentContent(armamentCoverageInput);
    expect(armamentContentLintOk(findings)).toBe(true);
    const six = findings.filter((f) => JSON.stringify(f).includes("ru_6in_obr1867"));
    expect(six).toEqual([]);
  });
});
