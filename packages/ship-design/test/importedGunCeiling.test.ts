/**
 * ADR-0114: the domestic gun-calibre ceiling and the largest obtainable imported calibre are separate.
 *
 * Before this change `hardCapabilities.maxGunCaliberUm` was enforced as an absolute cap for every family
 * (componentVariants.ts), so a nation could not obtain an imported gun above its domestic ceiling without
 * inflating that one field. These tests pin the split: an IMPORTED family may reach the import ceiling, a
 * DOMESTIC family is still capped by the domestic ceiling, and no domestic ceiling is widened.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, it, expect } from "vite-plus/test";
import { CANONICAL_RESEARCH_FIELD_IDS } from "@bluewave/content-schema";
import {
  catalogueForNation,
  validateNavalProfiles,
  type ComponentAccess,
  type NationNavalProfile,
} from "../src/index.js";
import { components, navalProfiles, plants } from "./helpers/earlyContext.js";

const root = join(__dirname, "..", "..", "..", "content", "production", "1880");
const load = (rel: string) =>
  parse(readFileSync(join(root, rel), "utf8")) as Record<string, unknown>;
const knownNationIds = new Set(navalProfiles.map((p) => p.nationId));
const knownComponentIds = new Set(components.map((c) => c.id));
const knownPlantIds = new Set(plants.map((p) => p.id));
const knownHullFormIds = new Set(
  (load("ship-building/hull-forms.yaml") as { hullForms: { id: string }[] }).hullForms.map(
    (f) => f.id,
  ),
);
const validationCtx = {
  knownNationIds,
  knownComponentIds,
  knownPlantIds,
  knownHullFormIds,
  knownResearchFields: new Set<string>(CANONICAL_RESEARCH_FIELD_IDS),
  release: true,
};

const MONTH = "1880-01";
const base = navalProfiles.find((p) => p.nationId === "netherlands")!;

/** A copy of the Netherlands profile with a small domestic ceiling and a chosen import ceiling. */
function profileWith(
  domesticUm: number,
  importedUm: number | undefined,
  access: Readonly<Record<string, ComponentAccess>>,
): NationNavalProfile {
  return {
    ...base,
    hardCapabilities: {
      ...base.hardCapabilities,
      maxGunCaliberUm: domesticUm,
      ...(importedUm !== undefined ? { maxImportedGunCaliberUm: importedUm } : {}),
    },
    componentAccess: access,
  };
}

const imported = (producer: string): ComponentAccess => ({ status: "IMPORTED", producer });
const domestic: ComponentAccess = { status: "DOMESTIC" };

const idsIn = (p: NationNavalProfile): string[] =>
  catalogueForNation(components, p, MONTH).catalogue.map((c) => c.id);

describe("domestic vs imported gun ceiling (ADR-0114)", () => {
  // The 279 mm Armstrong RML is the Netherlands' imported main gun; 203 mm is the domestic ceiling.
  const access = {
    gun_rml_11in_25ton: imported("Armstrong"),
    gun_rml_8in_9ton: imported("Krupp"),
  } as const;

  it("caps an imported family at the domestic ceiling when no import ceiling is set", () => {
    const ids = idsIn(profileWith(203000, undefined, access));
    expect(ids).toContain("gun_rml_8in_9ton");
    expect(ids).not.toContain("gun_rml_11in_25ton");
  });

  it("admits an imported family above the domestic ceiling up to the import ceiling", () => {
    const ids = idsIn(profileWith(203000, 305000, access));
    // This is the behavior the split adds; it fails against the pre-ADR-0114 single-ceiling logic.
    expect(ids).toContain("gun_rml_11in_25ton");
    expect(ids).toContain("gun_rml_8in_9ton");
  });

  it("still drops a DOMESTIC family above the domestic ceiling despite an import ceiling", () => {
    const ids = idsIn(
      profileWith(203000, 305000, {
        gun_rml_11in_25ton: domestic,
        gun_rml_8in_9ton: imported("Krupp"),
      }),
    );
    expect(ids).not.toContain("gun_rml_11in_25ton");
    expect(ids).toContain("gun_rml_8in_9ton");
  });

  it("does not change the domestic ceiling when an import ceiling is present", () => {
    const p = profileWith(203000, 305000, access);
    expect(p.hardCapabilities.maxGunCaliberUm).toBe(203000);
    expect(p.hardCapabilities.maxImportedGunCaliberUm).toBe(305000);
  });

  it("validates an import ceiling at or above the domestic ceiling", () => {
    for (const importedUm of [203000, 305000]) {
      const issues = validateNavalProfiles(
        [profileWith(203000, importedUm, access)],
        validationCtx,
      );
      expect(issues.map((i) => `${i.code}: ${i.message}`)).toEqual([]);
    }
  });

  it("rejects an import ceiling below the domestic ceiling (would restrict, not widen)", () => {
    const issues = validateNavalProfiles([profileWith(305000, 203000, access)], validationCtx);
    expect(issues.map((i) => i.code)).toContain("PROFILE_VALUE_RANGE");
  });

  it("rejects a non-positive import ceiling", () => {
    const issues = validateNavalProfiles([profileWith(203000, 0, access)], validationCtx);
    expect(issues.map((i) => i.code)).toContain("PROFILE_VALUE_RANGE");
  });
});
