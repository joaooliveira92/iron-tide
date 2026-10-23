import { appendFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";

import { compileProductionCampaign, PRODUCTION_PACK_DIR } from "../src/production-pack.js";

const FIXTURE_TECH_ID = "e1_fixture_post_1939";
const FIXTURE_TECH = `- id: "${FIXTURE_TECH_ID}"
  name: "Fixture post-1939 technology"
  category: "MID_CENTURY"
  researchFieldId: "SUBMARINES"
  prerequisites:
    - { techId: "sub_fleet_ocean_boat" }
  cost: 500
  discoveryWeight: 15000
  year: 1955
`;

describe("the authored horizon is 1970 (ADR-0282)", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it("compiles a post-1939 technology beside the production pack without diagnostics", () => {
    const dir = mkdtempSync(join(tmpdir(), "bw-post-1939-"));
    dirs.push(dir);
    cpSync(PRODUCTION_PACK_DIR, dir, { recursive: true });
    appendFileSync(join(dir, "technologies.yaml"), FIXTURE_TECH);

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
