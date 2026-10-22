import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CampaignCompiler } from "@bluewave/campaign/compiler";
import type { CampaignSnapshot } from "@bluewave/campaign";
import {
  buildConstructionDesignCatalog,
  designFamilyYear,
  isDesignBuildableByYear,
} from "@bluewave/campaign-engine";
import { classifyShip } from "@bluewave/combat/tactical";
import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";

const thisDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(thisDir, "..", "..", "..");
const PRODUCTION_PACK = resolve(REPO_ROOT, "content", "production", "1880");
const childScript = resolve(thisDir, "..", "dist", "run-child.js");

function compileProductionPack(): CampaignSnapshot {
  const collector = new DiagnosticCollector();
  const signal = new AbortController().signal;
  const input = buildFullSurfaceInput(
    resolve(PRODUCTION_PACK, "pack.json"),
    PRODUCTION_PACK,
    collector,
  );
  const artifact = input ? buildContentBundleArtifact(input, signal, collector) : undefined;
  if (!artifact || collector.hasErrors) {
    throw new Error(
      `Production pack compilation failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  const output = new CampaignCompiler().compile(
    {
      contentBundle: artifact.bundle,
      contentHash: artifact.envelope.bodyHash,
      rulesetVersion: "1.0",
      compatibilityVersion: CURRENT_COMPATIBILITY_VERSION,
    },
    signal,
    collector,
  );
  if (!output || collector.hasErrors) {
    throw new Error(
      `Production pack compilation failed: ${collector.all.map((d) => d.message).join("; ")}`,
    );
  }
  return output.state.snapshot;
}

interface SmokeDiagnostic {
  readonly month: number;
  readonly nationId: string | null;
  readonly code: string;
  readonly message: string;
}

interface SmokeOutput {
  readonly mode: string;
  readonly months: number;
  readonly inProcessRepeatMatches: boolean;
  readonly success: boolean;
  readonly monthlyHashes: readonly string[];
  readonly monthlySuccess: readonly boolean[];
  readonly closingSnapshotHash: string;
  readonly diagnostics: readonly SmokeDiagnostic[];
  readonly hullCounts: Readonly<Record<string, number>>;
}

function runSmokeChild(): { readonly output: SmokeOutput; readonly stdout: string } {
  const stdout = execFileSync(process.execPath, [childScript, "production-ten-nation"], {
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  return { output: JSON.parse(lines[lines.length - 1]!) as SmokeOutput, stdout };
}

describe("N-2 static viability gate: ten playable, legal, classifiable, 1880-only", () => {
  const snapshot = compileProductionPack();

  it("fields legal starting ships that all classify without INVALID_SHIP_TYPE", () => {
    const failures: string[] = [];
    for (const nation of snapshot.nations.values()) {
      for (const fleet of nation.fleets) {
        for (const ship of fleet.ships) {
          const designVersionId = ship.designVersionId;
          if (designVersionId === undefined) {
            failures.push(`ship '${ship.id}' carries no designVersionId`);
            continue;
          }
          const design = snapshot.designs.get(designVersionId);
          if (design === undefined) {
            failures.push(`ship '${ship.id}' references unknown design '${designVersionId}'`);
            continue;
          }
          try {
            classifyShip(design);
          } catch {
            failures.push(`ship '${ship.id}' design '${designVersionId}' is INVALID_SHIP_TYPE`);
          }
        }
      }
    }
    expect(failures).toEqual([]);
  });

  it("marks every post-1880 design unavailable at campaign year 1880", () => {
    const campaignYear = 1880;
    const post1880 = [...snapshot.designs.values()].filter((design) => {
      const family =
        design.designFamilyId !== ""
          ? snapshot.designFamilies.get(design.designFamilyId)
          : undefined;
      return designFamilyYear(family?.familyCreationMonth) > campaignYear;
    });
    expect(post1880.length).toBeGreaterThan(0);

    const failures: string[] = [];
    for (const design of post1880) {
      if (!/^des_(pw|iw)_/.test(design.designVersionId)) {
        failures.push(`post-1880 design '${design.designVersionId}' is not a horizon design`);
      }
      const family =
        design.designFamilyId !== ""
          ? snapshot.designFamilies.get(design.designFamilyId)
          : undefined;
      const year = designFamilyYear(family?.familyCreationMonth);
      const entry = buildConstructionDesignCatalog(snapshot, design.nationId, campaignYear).find(
        (candidate) => candidate.designId === design.designVersionId,
      );
      if (entry === undefined) {
        failures.push(`post-1880 design '${design.designVersionId}' is missing from its catalogue`);
        continue;
      }
      if (entry.available !== isDesignBuildableByYear(year, campaignYear)) {
        failures.push(
          `design '${design.designVersionId}' availability disagrees with isDesignBuildableByYear`,
        );
      }
      if (entry.available) {
        failures.push(`post-1880 design '${design.designVersionId}' is available at 1880`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("N-2 deterministic ten-nation smoke run", () => {
  it("advances twelve command-free months over fourteen nations, deterministically", () => {
    const first = runSmokeChild();
    const second = runSmokeChild();

    expect(first.stdout).toBe(second.stdout);
    expect(first.output.inProcessRepeatMatches).toBe(true);
    expect(first.output.months).toBe(12);
    expect(first.output.monthlyHashes).toHaveLength(12);
    expect(first.output.monthlySuccess).toHaveLength(12);
    expect(first.output.closingSnapshotHash).toHaveLength(64);

    expect(Object.keys(first.output.hullCounts)).toHaveLength(14);
    for (const [nationId, hulls] of Object.entries(first.output.hullCounts)) {
      expect(hulls, `nation '${nationId}' fields no hulls after 12 months`).toBeGreaterThan(0);
    }

    expect(first.output.diagnostics).toEqual([]);
    expect(first.output.monthlySuccess.every(Boolean)).toBe(true);
    expect(first.output.success).toBe(first.output.monthlySuccess.every(Boolean));
  }, 300_000);
});
