#!/usr/bin/env node
/**
 * National content scaffold. Generates a *draft* NationNavalProfile skeleton and a research-note stub for
 * a new nation, so adding a nation is a researched content task rather than a code task. The generated profile is
 * written OUTSIDE the release content (under `docs/nations/`) and every value is a PLACEHOLDER, so it can never reach
 * release — `validateNationCompleteness(..., { release: true })` rejects PLACEHOLDER values and missing provenance.
 *
 *   node scripts/new-nation.mjs <nationId>
 *
 * The draft is a complete per-nation TypeScript content module (ADR-0109 shape, ADR-0334 format) matching
 * `content/production/<scenario>/ship-building/naval-profiles/<nationId>.ts`, so it can be dropped straight in once
 * every PLACEHOLDER is replaced. Then: research the nation into `docs/research/<nationId>-naval-profile.md`, replace
 * every PLACEHOLDER with a sourced or explicitly classified value, author six classified opening starters under
 * `content/production/<scenario>/ship-building/reference-designs/<nationId>/starters.ts`, and run the completeness
 * validator.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/**
 * Build the draft `navalProfiles` catalogue YAML for a nation. Every value is a PLACEHOLDER, every required
 * provenance block is present, and the file shape matches the per-nation release layout.
 */
export function buildProfileRecord(nationId) {
  const due = {
    sourceStatus: "PLACEHOLDER",
    confidence: "LOW",
    kind: "balance_adjustment",
    sources: [],
  };
  return {
    nationId,
    activeFrom: "1880-01",
    activeUntil: null,
    strategicSituation: "PLACEHOLDER: one paragraph on the nation's 1880 strategic naval position.",
    hardCapabilities: {
      maxGunCaliberUm: 100000,
      maxArmourThicknessUm: 100000,
      domesticTorpedoDiameterUm: 100000,
      hullForms: [
        "torpedo_boat_form",
        "protected_cruiser_form",
        "coast_defence_form",
        "pre_dreadnought_form",
        "merchant_liner_form",
      ],
      domesticPlants: ["compound_cylindrical"],
      restrictedShipTypes: [],
      grants: [],
    },
    softPreferences: {
      speedOverArmourBp: 5000,
      secondaryBatteryWeightBp: 10000,
      enduranceWeightBp: 10000,
      riskToleranceBp: 5000,
      colonialServiceWeightBp: 10000,
      torpedoOnCruisersBp: 10000,
      accommodationStandard: "STANDARD",
    },
    industrialProfile: {
      buildTimeMultiplierBp: 10000,
      costMultiplierBp: 10000,
      machineryReliabilityBp: 9000,
      constructionQualityVarianceBp: 2500,
      maxPracticalDisplacementKg: [{ fromMonth: "1880-01", value: 8000000 }],
      heavyGunProduction: "UNAVAILABLE",
      armourPlateProduction: "UNAVAILABLE",
      provenance: { ...due },
    },
    dock: {
      maximumNewConstructionMassKg: 8000000,
      maximumMajorRepairMassKg: 8000000,
      maximumRebuildMassKg: 8000000,
      maximumConversionMassKg: 8000000,
      provenance: { ...due, kind: "game_conversion" },
    },
    doctrineProfile: {
      engagementRangeM: 2000,
      hePreferenceBp: 5000,
      postures: ["coastal_defence"],
      provenance: { ...due, kind: "historical_fact" },
    },
    researchPreferences: [{ field: "GUNNERY", priority: 2 }],
    componentAccess: {},
    gunModels: [],
    ammunitionPatterns: [],
    componentVariants: [],
    designWeights: Object.fromEntries(
      ["B", "CA", "CL", "DD", "KE", "AMC"].map((shipType) => [
        shipType,
        {
          firepowerBp: 10000,
          protectionBp: 10000,
          speedBp: 10000,
          enduranceBp: 10000,
          torpedoBp: 10000,
          reliabilityBp: 10000,
          colonialBp: 10000,
          costBp: 10000,
        },
      ]),
    ),
    procurementPolicy: {
      battleLineShareBp: 2500,
      cruiserShareBp: 2500,
      torpedoCraftShareBp: 2500,
      colonialShareBp: 2500,
      foreignProcurementAppetiteBp: 2000,
      unprovenTechAppetiteBp: 3000,
      buildOrder: ["B", "CA", "CL", "DD", "KE", "AMC"],
    },
    namingPolicy: {
      stems: Object.fromEntries(
        ["B", "CA", "CL", "DD", "KE", "AMC"].map((shipType) => [shipType, ["PLACEHOLDER"]]),
      ),
      convention: Object.fromEntries(
        ["B", "CA", "CL", "DD", "KE", "AMC"].map((shipType) => [shipType, "PLACEHOLDER"]),
      ),
    },
    sourceReferences: [{ sourceId: "PLACEHOLDER", title: "PLACEHOLDER" }],
    provenance: due,
  };
}

/**
 * Build the draft naval-profiles content module for a nation. Every value is a PLACEHOLDER, every
 * required provenance block is present, and the module decodes with `NationNavalProfileSchema`
 *: it can be dropped into the pack once the placeholders are replaced.
 */
export function buildProfileModule(nationId) {
  const items = JSON.stringify([buildProfileRecord(nationId)], null, 2)
    .split("\n")
    .slice(1, -1)
    .join("\n");
  return `// DRAFT naval-profiles catalogue for '${nationId}' (one nation per file, ADR-0109).
// Every value below is a PLACEHOLDER. Do not move this file into content/production until every PLACEHOLDER is
// replaced with a sourced (VERIFIED/DERIVED/ESTIMATE) or explicitly classified (BALANCE_TARGET) value that carries a
// provenance block, and the completeness validator passes. See docs/agents/adding-a-nation.md.
import { NationNavalProfileSchema, collection } from "@bluewave/content-authoring";

export default collection("navalProfiles", NationNavalProfileSchema, [
${items}
]);
`;
}

/** Build the research-note stub for a nation. */
export function buildResearchNote(nationId) {
  return `# Research: national naval profile — ${nationId} (1880–1899)

**Question.** Ground the date-banded NationNavalProfile for '${nationId}' (hard capability, soft doctrine, industry,
research, component access, gun models, procurement, naming). Method and confidence labels as in
\`docs/research/national-naval-profiles-uk-france.md\` (VERIFIED / SINGLE-SOURCE / ESTIMATE / UNVERIFIED; Wikipedia is
not a source).

## Required figures
- strategic posture (battle-fleet concentration / colonial presence / commerce raiding / torpedo warfare / coastal defence);
- industrial capability (build-time & cost modifiers within ±15%, displacement ceiling, gun/armour production, reliability, variance);
- gunnery, protection, propulsion and torpedo doctrine; global obligations; risk tolerance; research preferences;
- ~8–15 national component variants (shared family → national model) with sourced parameters;
- six 1880 opening designs (B, CA, CL, DD, KE, AMC), each classified HISTORICAL_RECONSTRUCTION / HISTORICALLY_INSPIRED / DOCTRINE_TEMPLATE / BALANCE_TEMPLATE;
- naming conventions and published 1880s name stems.

## Deferred / low-confidence
- (list every figure that could not be grounded)
`;
}

/**
 * Write the draft catalogue and research-note stub under `rootDir` (the repo root by default). Refuses to overwrite an
 * existing draft. Returns the written paths so callers (and tests) can assert them.
 */
export function scaffoldNation(nationId, { rootDir = root } = {}) {
  const nationsDir = join(rootDir, "docs", "nations");
  mkdirSync(nationsDir, { recursive: true });
  mkdirSync(join(rootDir, "docs", "research"), { recursive: true });
  const profilePath = join(nationsDir, `${nationId}-profile-draft.ts`);
  const notePath = join(rootDir, "docs", "research", `${nationId}-naval-profile.md`);
  if (existsSync(profilePath)) {
    throw new Error(`refusing to overwrite ${profilePath}`);
  }
  writeFileSync(profilePath, buildProfileModule(nationId));
  if (!existsSync(notePath)) writeFileSync(notePath, buildResearchNote(nationId));
  return { profilePath, notePath };
}

function main() {
  const nationId = process.argv[2];
  if (!nationId || !/^[a-z][a-z0-9_]*$/.test(nationId)) {
    console.error("usage: node scripts/new-nation.mjs <lower_snake_nation_id>");
    process.exit(2);
  }

  let paths;
  try {
    paths = scaffoldNation(nationId);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  console.log(`draft profile -> ${paths.profilePath}`);
  console.log(`research note -> ${paths.notePath}`);
  console.log("");
  console.log("Next steps (see docs/agents/adding-a-nation.md):");
  console.log(
    `  1. Research ${nationId} into the note; replace every PLACEHOLDER with a sourced/classified value.`,
  );
  console.log(
    "  2. Copy the draft catalogue to content/production/1880/ship-building/naval-profiles/<nationId>.ts.",
  );
  console.log(
    "  3. Author six classified opening starters in content/production/1880/ship-building/reference-designs/<nationId>/starters.ts.",
  );
  console.log(
    "  4. Run the completeness validator: pnpm --filter @bluewave/ship-design exec vp test run nationCompleteness.",
  );
  console.log("  5. Run the full gate: pnpm check (plus packaged smoke).");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
