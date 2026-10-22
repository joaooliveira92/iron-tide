import { describe, it, expect } from "vite-plus/test";
import { fingerprintDistance, profileFingerprint, type Provenance } from "../src/nationProfile.js";
import {
  validateAllNations,
  validateArmamentContent,
  validateNationCompleteness,
} from "../src/nationCompleteness.js";
import { type NationNavalProfile, type StarterDesign } from "../src/index.js";
import {
  components,
  navalProfiles,
  readReferenceDesignEntries,
  shipBuildingContent,
} from "./helpers/earlyContext.js";
import {
  armamentContent,
  armamentStarters,
  armamentTechnologies,
} from "./helpers/armamentContext.js";
import { REFERENCE_DESIGN_CLASSIFICATIONS } from "./helpers/referenceClassifications.js";

const starters = (readReferenceDesignEntries() as { starterFor?: string }[]).filter(
  (d) => d.starterFor !== undefined,
) as unknown as StarterDesign[];

const knownComponentIds = new Set(components.map((c) => c.id));

const CLASSIFICATIONS = REFERENCE_DESIGN_CLASSIFICATIONS;

const opts = {
  profiles: navalProfiles,
  starters,
  content: shipBuildingContent,
  openingMonth: "1880-01",
  standardBudgetUnits: 400,
  knownComponentIds,
  classifications: CLASSIFICATIONS,
  release: true,
  armament: {
    content: armamentContent,
    components,
    starters: armamentStarters,
    technologies: armamentTechnologies,
  },
};

const NATIONS = ["uk", "france", "germany"] as const;

describe("national content completeness (UK / France / Germany)", () => {
  it.each(NATIONS)("%s passes every completeness check at release", (nation) => {
    const issues = validateNationCompleteness(opts, nation);
    expect(issues.map((i) => `${i.code}: ${i.message}`)).toEqual([]);
  });
  it("validates every authored nation with no issues", () => {
    expect(validateAllNations(opts)).toEqual([]);
  });
  it("rejects a nation with no profile", () => {
    expect(validateNationCompleteness(opts, "atlantis").map((i) => i.code)).toContain(
      "NATION_NO_PROFILE",
    );
  });
  it("rejects an unclassified starter", () => {
    const { ["starter_gunboat_de_1880"]: _drop, ...without } = CLASSIFICATIONS;
    const issues = validateNationCompleteness({ ...opts, classifications: without }, "germany");
    expect(issues.map((i) => i.code)).toContain("NATION_STARTER_UNCLASSIFIED");
  });
  it("the three nations are measurably distinct without violating the rules", () => {
    const uk = profileFingerprint(navalProfiles.find((p) => p.nationId === "uk")!);
    const fr = profileFingerprint(navalProfiles.find((p) => p.nationId === "france")!);
    const de = profileFingerprint(navalProfiles.find((p) => p.nationId === "germany")!);
    expect(fingerprintDistance(uk, de)).toBeGreaterThanOrEqual(2);
    expect(fingerprintDistance(fr, de)).toBeGreaterThanOrEqual(2);
    expect(fingerprintDistance(uk, fr)).toBeGreaterThanOrEqual(2);
  });

  it("passes the integrated armament release gate with no issues", () => {
    expect(validateArmamentContent(opts)).toEqual([]);
    expect(validateAllNations(opts)).toEqual([]);
  });
});

const ukProfile = navalProfiles.find((p) => p.nationId === "uk")!;

const withUkProfile = (profile: NationNavalProfile) => ({
  ...opts,
  profiles: navalProfiles.map((p) => (p.nationId === "uk" ? profile : p)),
});
const asPlaceholder = (prov: Provenance): Provenance => ({ ...prov, sourceStatus: "PLACEHOLDER" });
const asEstimate = (prov: Provenance, withSources: boolean): Provenance => ({
  ...prov,
  sourceStatus: "ESTIMATE",
  ...(withSources ? {} : { sources: [] }),
});

describe("provenance completeness across every provenance-bearing field", () => {
  it("a fully-provenanced profile has no provenance findings", () => {
    const issues = validateNationCompleteness(opts, "uk");
    expect(
      issues.filter(
        (i) => i.code === "PROFILE_PLACEHOLDER" || i.code === "PROFILE_PROVENANCE_MISSING",
      ),
    ).toEqual([]);
  });

  it("rejects a PLACEHOLDER profile provenance at release, naming the field path", () => {
    const profile = { ...ukProfile, provenance: asPlaceholder(ukProfile.provenance) };
    expect(validateNationCompleteness(withUkProfile(profile), "uk")).toContainEqual(
      expect.objectContaining({
        nationId: "uk",
        code: "PROFILE_PLACEHOLDER",
        path: "profile.provenance",
      }),
    );
  });

  it("rejects PLACEHOLDER industrialProfile and doctrineProfile provenance at release", () => {
    const industrial = {
      ...ukProfile,
      industrialProfile: {
        ...ukProfile.industrialProfile,
        provenance: asPlaceholder(ukProfile.industrialProfile.provenance),
      },
    };
    const doctrine = {
      ...ukProfile,
      doctrineProfile: {
        ...ukProfile.doctrineProfile,
        provenance: asPlaceholder(ukProfile.doctrineProfile.provenance),
      },
    };
    expect(validateNationCompleteness(withUkProfile(industrial), "uk")).toContainEqual(
      expect.objectContaining({
        nationId: "uk",
        code: "PROFILE_PLACEHOLDER",
        path: "industrialProfile.provenance",
      }),
    );
    expect(validateNationCompleteness(withUkProfile(doctrine), "uk")).toContainEqual(
      expect.objectContaining({
        nationId: "uk",
        code: "PROFILE_PLACEHOLDER",
        path: "doctrineProfile.provenance",
      }),
    );
  });

  it("rejects a per-gun PLACEHOLDER at release with the gun id in the path", () => {
    const gun = ukProfile.gunModels[0]!;
    const profile = {
      ...ukProfile,
      gunModels: [
        { ...gun, provenance: asPlaceholder(gun.provenance) },
        ...ukProfile.gunModels.slice(1),
      ],
    };
    expect(validateNationCompleteness(withUkProfile(profile), "uk")).toContainEqual(
      expect.objectContaining({
        nationId: "uk",
        code: "PROFILE_PLACEHOLDER",
        path: `gunModels.${gun.id}.provenance`,
      }),
    );
  });

  it("allows an ESTIMATE that cites sources but rejects one without", () => {
    const withSources = {
      ...ukProfile,
      industrialProfile: {
        ...ukProfile.industrialProfile,
        provenance: asEstimate(ukProfile.industrialProfile.provenance, true),
      },
    };
    const withoutSources = {
      ...ukProfile,
      industrialProfile: {
        ...ukProfile.industrialProfile,
        provenance: asEstimate(ukProfile.industrialProfile.provenance, false),
      },
    };
    expect(validateNationCompleteness(withUkProfile(withSources), "uk")).not.toContainEqual(
      expect.objectContaining({
        path: "industrialProfile.provenance",
        code: "PROFILE_PROVENANCE_MISSING",
      }),
    );
    expect(validateNationCompleteness(withUkProfile(withoutSources), "uk")).toContainEqual(
      expect.objectContaining({
        nationId: "uk",
        code: "PROFILE_PROVENANCE_MISSING",
        path: "industrialProfile.provenance",
      }),
    );
  });

  it("reports a nested placeholder uniformly (PROFILE_PLACEHOLDER with a path, not VARIANT_PLACEHOLDER)", () => {
    const gun = ukProfile.gunModels[0]!;
    const profile = {
      ...ukProfile,
      gunModels: [
        { ...gun, provenance: asPlaceholder(gun.provenance) },
        ...ukProfile.gunModels.slice(1),
      ],
    };
    const issues = validateNationCompleteness(withUkProfile(profile), "uk");
    expect(issues.some((i) => i.code === "VARIANT_PLACEHOLDER")).toBe(false);
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "PROFILE_PLACEHOLDER",
        path: `gunModels.${gun.id}.provenance`,
      }),
    );
  });

  it("REGRESSION: a nested release placeholder cannot pass completeness validation", () => {
    const profile = {
      ...ukProfile,
      doctrineProfile: {
        ...ukProfile.doctrineProfile,
        provenance: asPlaceholder(ukProfile.doctrineProfile.provenance),
      },
    };
    const issues = validateNationCompleteness(withUkProfile(profile), "uk");
    expect(issues.length).toBeGreaterThan(0);
    expect(
      issues.some(
        (i) => i.code === "PROFILE_PLACEHOLDER" && i.path === "doctrineProfile.provenance",
      ),
    ).toBe(true);
  });
});
