import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";
import { researchOf, technologiesOf } from "./helpers/campaignRecords.js";

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "..", "..", "..");
const contentDir = resolve(repoRoot, "content", "production", "1880");

function buildProductionBundle(): ContentBundle {
  const collector = new DiagnosticCollector();
  const input = buildFullSurfaceInput(resolve(contentDir, "pack.json"), contentDir, collector);
  const output = new Compiler().compile(input!, new AbortController().signal, collector);
  expect(collector.hasErrors).toBe(false);
  expect(output).toBeDefined();
  return output!.bundle;
}

describe("1880 research seed coherence (N-1 ticket 04)", () => {
  const bundle = buildProductionBundle();
  const prerequisites = new Map(
    technologiesOf(bundle).map((tech) => [
      tech.id,
      (tech.prerequisites ?? []).map((prerequisite) => prerequisite.techId),
    ]),
  );
  const research = researchOf(bundle);

  const completedBy = (nation: (typeof research)[number]): Set<string> =>
    new Set(nation.technologies.filter((tech) => tech.completed).map((tech) => tech.techId));

  it("seeds research for every nation", () => {
    expect(research.length).toBeGreaterThan(0);
  });

  it("completes every prerequisite of a completed technology", () => {
    for (const nation of research) {
      const completed = completedBy(nation);
      for (const tech of nation.technologies) {
        if (!tech.completed) continue;
        for (const prerequisite of prerequisites.get(tech.techId) ?? []) {
          expect(
            completed.has(prerequisite),
            `${nation.nationId}: '${tech.techId}' is completed but prerequisite '${prerequisite}' is not`,
          ).toBe(true);
        }
      }
    }
  });

  it("requires every active project to have met prerequisites", () => {
    for (const nation of research) {
      const project = nation.currentProjectTechId;
      if (project === undefined || project === "") continue;
      expect(prerequisites.has(project), `${nation.nationId}: unknown project '${project}'`).toBe(
        true,
      );
      const completed = completedBy(nation);
      for (const prerequisite of prerequisites.get(project) ?? []) {
        expect(
          completed.has(prerequisite),
          `${nation.nationId}: active project '${project}' needs unmet prerequisite '${prerequisite}'`,
        ).toBe(true);
      }
    }
  });
});
