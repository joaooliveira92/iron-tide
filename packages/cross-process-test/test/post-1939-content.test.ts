import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign, PRODUCTION_PACK_DIR } from "../src/production-pack.js";

const FIXTURE_TECH_ID = "e1_fixture_post_1939";
const FIXTURE_TECH = `import {
  TechnologyPrerequisiteChainSchema,
  list,
} from "@bluewave/content-authoring";

export default list(TechnologyPrerequisiteChainSchema, [
  {
    id: "${FIXTURE_TECH_ID}",
    name: "Fixture post-1939 technology",
    category: "MID_CENTURY",
    researchFieldId: "SUBMARINES",
    prerequisites: [{ techId: "sub_fleet_ocean_boat" }],
    cost: 500,
    discoveryWeight: 15000,
    year: 1955,
  },
]);
`;

const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");

describe("the authored horizon is 1970", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("compiles a post-1939 technology beside the production pack without diagnostics", () => {
    mkdirSync(join(REPO_ROOT, ".tmp"), { recursive: true });
    const dir = mkdtempSync(join(REPO_ROOT, ".tmp", "post-1939-"));
    dirs.push(dir);
    cpSync(PRODUCTION_PACK_DIR, dir, { recursive: true });
    writeFileSync(join(dir, "post-1939.ts"), FIXTURE_TECH);
    const manifestPath = join(dir, "pack.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      files: { technologies: string[] };
    };
    manifest.files.technologies = [...manifest.files.technologies, "post-1939.ts"];
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

    const { state, bundle } = compileProductionCampaign(dir);

    const compiled = bundle.technologies?.find((tech) => tech.id === FIXTURE_TECH_ID);
    expect(compiled?.year).toBe(1955);
    const catalogued = state.snapshot.world.technologies?.find(
      (tech) => tech.techId === FIXTURE_TECH_ID,
    );
    expect(catalogued?.availabilityMonth).toBe((1955 - 1880) * 12);
  });

  it("leaves the production pack free of the fixture technology", () => {
    const { bundle } = compileProductionCampaign();
    expect(bundle.technologies?.some((tech) => tech.id === FIXTURE_TECH_ID)).toBe(false);
  });
});
