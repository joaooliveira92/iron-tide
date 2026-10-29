// Tests for scripts/new-nation.mjs — the ADR-0092 nation-authoring scaffold.
//
// The generated draft must match the per-nation layout (ADR-0109:
// `collection("navalProfiles", …)`) and the NationNavalProfile schema's required
// provenance shape (packages/content-schema/src/naval-profile.ts). `pnpm test:scripts`
// runs before `pnpm build` (quality.yml / gates.yml), so this test validates the draft
// *record* and the rendered module text directly against the schema's required fields,
// vocabularies and provenance rules instead of importing the built schema.
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildProfileModule,
  buildProfileRecord,
  buildResearchNote,
  scaffoldNation,
} from "../new-nation.mjs";

const NATION = "testland";

const draftProfile = () => buildProfileRecord(NATION);

void test("draft is a per-nation navalProfiles catalogue with the schema's required fields", () => {
  const profile = draftProfile();
  assert.equal(profile.nationId, NATION);
  const requiredTopLevel = [
    "nationId",
    "activeFrom",
    "activeUntil",
    "strategicSituation",
    "hardCapabilities",
    "softPreferences",
    "industrialProfile",
    "doctrineProfile",
    "researchPreferences",
    "componentAccess",
    "gunModels",
    "ammunitionPatterns",
    "componentVariants",
    "designWeights",
    "procurementPolicy",
    "namingPolicy",
    "sourceReferences",
    "provenance",
  ];
  for (const key of requiredTopLevel) {
    assert.ok(Object.hasOwn(profile, key), `profile.${key} is present`);
  }
  // Hard capability only ever restricts; the scaffold must not invent grants.
  assert.deepEqual(profile.hardCapabilities.grants, []);
  assert.deepEqual(profile.hardCapabilities.restrictedShipTypes, []);
});

void test("draft declares every required provenance block, honestly marked PLACEHOLDER", () => {
  const profile = draftProfile();
  const blocks = {
    provenance: profile.provenance,
    "industrialProfile.provenance": profile.industrialProfile.provenance,
    "doctrineProfile.provenance": profile.doctrineProfile.provenance,
  };
  for (const [label, block] of Object.entries(blocks)) {
    assert.ok(block, `${label} is present`);
    assert.equal(block.sourceStatus, "PLACEHOLDER", `${label} does not overclaim certainty`);
    assert.ok(
      ["HIGH", "MEDIUM", "LOW"].includes(block.confidence),
      `${label}.confidence is in the vocabulary`,
    );
    assert.ok(
      ["historical_fact", "game_conversion", "balance_adjustment"].includes(block.kind),
      `${label}.kind is in the vocabulary`,
    );
    assert.ok(Array.isArray(block.sources), `${label}.sources is an array`);
  }
  // Only the required blocks exist, and none claims VERIFIED while the draft is unsourced.
  for (const key of ["gunModels", "ammunitionPatterns", "componentVariants"]) {
    for (const entry of profile[key]) {
      assert.ok(entry.provenance, `${key} entry carries its own provenance`);
    }
  }
  assert.ok(
    !JSON.stringify(profile).includes("VERIFIED"),
    "an unsourced draft never marks any value VERIFIED",
  );
});

void test("no generated provenance claims VERIFIED without a source", () => {
  const offenders = [];
  const walk = (node, path) => {
    if (Array.isArray(node)) {
      node.forEach((child, index) => walk(child, `${path}[${index}]`));
      return;
    }
    if (node === null || typeof node !== "object") return;
    if (
      node.sourceStatus === "VERIFIED" &&
      !(Array.isArray(node.sources) && node.sources.length > 0)
    ) {
      offenders.push(path);
    }
    for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`);
  };
  walk(draftProfile(), "profile");
  assert.deepEqual(offenders, []);
});

void test("industrial component-access values are schema vocabulary members", () => {
  const profile = draftProfile();
  const accessStatuses = [
    "DOMESTIC",
    "LICENSE_BUILT",
    "IMPORTED",
    "CAPTURED_OR_STUDIED",
    "UNAVAILABLE",
  ];
  for (const key of ["heavyGunProduction", "armourPlateProduction"]) {
    assert.ok(
      accessStatuses.includes(profile.industrialProfile[key]),
      `industrialProfile.${key} must be a component-access status (was ${profile.industrialProfile[key]})`,
    );
  }
});

void test("scaffoldNation writes the draft and note under the output root, deterministically", () => {
  const dir = mkdtempSync(join(tmpdir(), "bluewave-nation-"));
  try {
    const first = scaffoldNation(NATION, { rootDir: dir });
    assert.equal(first.profilePath, join(dir, "docs", "nations", `${NATION}-profile-draft.ts`));
    assert.equal(first.notePath, join(dir, "docs", "research", `${NATION}-naval-profile.md`));
    assert.equal(readFileSync(first.profilePath, "utf8"), buildProfileModule(NATION));
    assert.ok(readFileSync(first.notePath, "utf8").includes("national naval profile"));

    // Deterministic: repeat builds are byte-identical (no clock, no randomness).
    assert.equal(buildProfileModule(NATION), buildProfileModule(NATION));
    assert.equal(buildResearchNote(NATION), buildResearchNote(NATION));

    // Refuses to overwrite an existing draft rather than clobbering research.
    assert.throws(() => scaffoldNation(NATION, { rootDir: dir }), /refusing to overwrite/u);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

void test("the draft module is a TypeScript content module, not YAML", () => {
  const module = buildProfileModule(NATION);
  assert.ok(module.includes('from "@bluewave/content-authoring"'), "imports the authoring API");
  assert.ok(
    module.includes('collection("navalProfiles", NationNavalProfileSchema, ['),
    "declares the per-nation navalProfiles collection under the strict schema",
  );
  assert.ok(module.includes("export default collection("), "default-exports the document");
  assert.ok(!/^navalProfiles:/mu.test(module), "emits no YAML mapping");
  assert.ok(!module.includes(".yaml"), "names no YAML path");
});

void test("doc and generator agree on the canonical per-nation paths (ADR-0109)", () => {
  const script = readFileSync(new URL("../new-nation.mjs", import.meta.url), "utf8");
  const doc = readFileSync(
    new URL("../../docs/agents/adding-a-nation.md", import.meta.url),
    "utf8",
  );
  const canonical = ["naval-profiles/<nationId>.ts", "reference-designs/<nationId>/starters.ts"];
  for (const token of canonical) {
    assert.ok(script.includes(token), `new-nation.mjs names ${token}`);
    assert.ok(doc.includes(token), `adding-a-nation.md names ${token}`);
  }
  // The pre-ADR-0109 monoliths must not reappear in either file.
  for (const [name, text] of [
    ["new-nation.mjs", script],
    ["adding-a-nation.md", doc],
  ]) {
    for (const retired of ["naval-profiles.yaml", "reference-designs.yaml"]) {
      assert.ok(!text.includes(retired), `${name} must not name the retired ${retired}`);
    }
  }
});
