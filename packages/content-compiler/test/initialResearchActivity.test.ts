import { DiagnosticCollector } from "@bluewave/diagnostics";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

import type { ContentBundle } from "../src/index.js";
import { Compiler } from "../src/index.js";
import { buildFullSurfaceInput } from "../src/fullSurface.js";

/**
 * 1880 research activity (N-1 ticket 09): no funded nation starts idle. Every
 * nation with a research budget above zero opens with an active project whose
 * prerequisites are met, so turn 1 already has research movement.
 */

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

describe("1880 research activity (N-1 ticket 09)", () => {
  const bundle = buildProductionBundle();
  const prerequisites = new Map(
    bundle.technologies.map((tech) => [
      tech.id,
      (tech.prerequisites ?? []).map((prerequisite) => prerequisite.techId),
    ]),
  );
  const research = bundle.campaign?.research ?? [];

  it("assigns every funded nation a legally-prerequisite'd opening project", () => {
    const funded = research.filter((entry) => entry.researchBudget > 0);
    expect(funded.length).toBeGreaterThan(0);

    for (const entry of funded) {
      const project = entry.currentProjectTechId;
      expect(
        project,
        `funded nation '${entry.nationId}' starts with no active project`,
      ).toBeDefined();
      expect(
        project?.length ?? 0,
        `funded nation '${entry.nationId}' has an empty project`,
      ).toBeGreaterThan(0);
      expect(
        prerequisites.has(project!),
        `nation '${entry.nationId}' project '${project}' is unknown`,
      ).toBe(true);

      const completed = new Set(
        entry.technologies.filter((tech) => tech.completed).map((tech) => tech.techId),
      );
      for (const prerequisite of prerequisites.get(project!) ?? []) {
        expect(
          completed.has(prerequisite),
          `nation '${entry.nationId}' project '${project}' needs unmet prerequisite '${prerequisite}'`,
        ).toBe(true);
      }
    }
  });
});
