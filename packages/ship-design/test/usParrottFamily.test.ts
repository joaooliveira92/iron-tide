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

const PARROTT_FAMILY = "gun_rml_64in_parrott";
const SHARED_FAMILY = "gun_rml_64pdr_71cwt";

const US_STARTER_HASHES: Readonly<Record<string, string>> = {
  canonicus_1879: "2a3a6165c733b9065edcece1bedbd20730ef4c19740c8bda5183db571466e221",
  starter_ca_usa_1880: "1fda42bce66a928770a694b323c28c7d8e17d492c59eae3ea18218e71fe3df9b",
  starter_cl_usa_1880: "e8f2e98910f566ad9ae349ec174b737eb5a26acaca51a153d266fda503580901",
  starter_dd_usa_1880: "8c035544b2740f162ad3bbf0f615d8fa0bdc47dc285003be48a6594e187ea016",
  starter_ke_usa_1880: "871d3792ae02a1259176347ac18bb6a6c92f1413aa27625d3de004239ac6942a",
  starter_amc_usa_1880: "581eb1fd854c183311995d391dc157c69041531d67e8d0ce591d47d02c55e78d",
  starter_dd_usa_1945: "56435426f07b4607f725eb538491003c63c4119714375a037c2094dbc663f2ae",
  starter_cl_usa_1948: "ff3fe16d259523e2c11c114566b1450e8abb6b7af40f7f5ba477d8d1bdb25ae2",
  starter_ca_usa_1948: "501b6b2a90d679a92bac19859d032e5003500ee4a7c9bfb0a02d1f18d2176500",
  starter_dd_usa_1955: "f825f3a0485830d2fbd5758437b9f373a836ee66098eb753d5d629f7008f5d13",
  starter_bb_usa_1945: "c093a3a1b4093bccc7059514ad3456d4fec6f590222e9d8d71f0646c0c042190",
};

describe("US Parrott 6.4-inch dedicated family (issue #895)", () => {
  const model = armamentContent.gunModels.find((m) => m.id === "us_parrott_100pdr");
  const family = armamentContent.gunFamilies.find((f) => f.id === PARROTT_FAMILY);
  const component = components.find((c) => c.id === PARROTT_FAMILY);

  it("authors the dedicated family with the sourced 1866 Ordnance Instructions numbers", () => {
    expect(family?.category).toBe("SECONDARY_GUN");
    expect(model?.familyId).toBe(PARROTT_FAMILY);
    expect(model?.nationId).toBe("usa");
    expect(model?.shellMassG).toBe(36300);
    expect(model?.gunMassKg).toBe(4400);
    expect(model?.propellantChargeBp).toBe(1000);
    expect(model?.caliberUm).toBe(162560);
    expect([...(model?.supportedMountTypes ?? [])].sort()).toEqual([
      "BROADSIDE_BATTERY",
      "DECK_OPEN",
    ]);
    expect(component?.constants.gun_kg).toBe(4400);
  });

  it("scopes the 70 lb solid shot to the model", () => {
    const shot = armamentContent.ammunition.find((a) => a.id === "us_solid_shot_64in_parrott");
    expect(shot?.shellType).toBe("AP");
    expect(shot?.shellMassG).toBe(31800);
    expect(shot?.compatibleGunModelIds).toEqual(["us_parrott_100pdr"]);
    expect(shot?.compatibleGunFamilies).toBeUndefined();
  });

  it("grants the family domestically and leaves the shared family access alone", () => {
    const usa = navalProfiles.find((p) => p.nationId === "usa");
    expect(usa?.componentAccess[PARROTT_FAMILY]?.status).toBe("DOMESTIC");
    expect(usa?.componentAccess[SHARED_FAMILY]?.status).toBe("DOMESTIC");
    expect(usa?.gunModels.find((g) => g.id === "us_parrott_100pdr")?.familyId).toBe(PARROTT_FAMILY);
  });

  it("resolves the nation default ammunition for the new family", () => {
    expect(armamentAmmunitionFor(armamentContent, "usa", PARROTT_FAMILY, "1880-01")?.id).toBe(
      "us_common_shell",
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

  it("keeps every US starter design hash identical to the pre-change baseline", () => {
    const designs = readReferenceDesignEntries() as {
      id: string;
      month: string;
      draft: DesignDraft;
    }[];
    const usa = designs.filter((d) => d.draft.nationId === "usa");
    expect(usa.map((d) => d.id).sort()).toEqual(Object.keys(US_STARTER_HASHES).sort());
    for (const d of usa) {
      const { ctx } = shipBuildingContent.environmentFor(d.month, "usa");
      const result = compileDesign(d.draft, ctx);
      expect(result.valid, d.id).toBe(true);
      expect(result.hash, d.id).toBe(US_STARTER_HASHES[d.id]);
    }
  });

  it("lints clean with no drift and no missing counterpart for the Parrott", () => {
    const findings = lintArmamentContent(armamentCoverageInput);
    expect(armamentContentLintOk(findings)).toBe(true);
    const parrott = findings.filter((f) => JSON.stringify(f).includes("us_parrott_100pdr"));
    expect(parrott).toEqual([]);
  });
});
