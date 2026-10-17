import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { CampaignSnapshot } from "@bluewave/campaign";
import { CampaignCompiler } from "@bluewave/campaign/compiler";
import { buildContentBundleArtifact, buildFullSurfaceInput } from "@bluewave/content-compiler";
import {
  ContentBundleSchema,
  validateAgainstSchema,
  type CompiledContentBundle,
} from "@bluewave/content-schema";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CURRENT_COMPATIBILITY_VERSION } from "@bluewave/persistence";

import {
  DecisionProbeError,
  assertDecisionProbes,
  probeDecisions,
  type DecisionProbeResult,
  type ProbeReferenceDesign,
} from "../src/decision-probes.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(thisDir, "..", "..", "..");
const PRODUCTION_PACK = resolve(REPO_ROOT, "content", "production", "1880");
const childScript = resolve(thisDir, "..", "dist", "run-child.js");

interface ProbeOutput {
  readonly mode: string;
  readonly years: readonly {
    readonly year: number;
    readonly probes: readonly DecisionProbeResult[];
  }[];
  readonly closingSnapshotHash: string;
}

function runProbeChild(): { readonly output: ProbeOutput; readonly stdout: string } {
  const stdout = execFileSync(process.execPath, [childScript, "production-probes"], {
    encoding: "utf8",
    timeout: 300_000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  return { output: JSON.parse(lines[lines.length - 1]!) as ProbeOutput, stdout };
}

function compileProduction(): { snapshot: CampaignSnapshot; bundle: CompiledContentBundle } {
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
  const bundle = validateAgainstSchema(
    artifact.bundle,
    ContentBundleSchema,
    "ContentBundle",
    "content-artifact.json",
    collector,
  );
  if (bundle === undefined) {
    throw new Error(
      `Production pack bundle is invalid: ${collector.all.map((d) => d.message).join("; ")}`,
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
  return { snapshot: output.state.snapshot, bundle };
}

describe("N-3 qualifying-decision probes at each January", () => {
  it("accepts one command per family in every year 1880–1889, deterministically", () => {
    const first = runProbeChild();
    const second = runProbeChild();
    expect(first.stdout).toBe(second.stdout);
    expect(first.output.mode).toBe("production-probes");
    expect(first.output.years.map((entry) => entry.year)).toEqual([
      1880, 1881, 1882, 1883, 1884, 1885, 1886, 1887, 1888, 1889,
    ]);
    for (const year of first.output.years) {
      expect(year.probes.map((probe) => probe.family).sort()).toEqual([
        "construction",
        "design",
        "research",
      ]);
      expect(
        year.probes.filter((probe) => probe.accepted),
        `year ${String(year.year)} has a rejected decision family`,
      ).toHaveLength(3);
      expect(assertDecisionProbes(year.year, year.probes)).toBeUndefined();
    }
  }, 600_000);

  it("leaves the snapshot hash unchanged and names year and family on a restricted fixture", () => {
    const { snapshot, bundle } = compileProduction();
    const slot = snapshot.slots.find((candidate) => candidate.type === "playable");
    if (slot === undefined) throw new Error("production pack has no playable slot");
    const references: readonly ProbeReferenceDesign[] = (
      bundle.shipBuilding?.referenceDesigns ?? []
    ).map((reference) => ({
      id: reference.id,
      month: reference.month,
      draft: { ...reference.draft },
    }));
    const before = sha256Hex(canonicalSerialize(snapshot));
    const accepted = probeDecisions(snapshot, slot, 1885, references);
    expect(sha256Hex(canonicalSerialize(snapshot))).toBe(before);
    expect(assertDecisionProbes(1885, accepted)).toBeUndefined();

    const restricted = probeDecisions(
      snapshot,
      { ...slot, nationId: "nonexistent" },
      1885,
      references,
    );
    let thrown: unknown;
    try {
      assertDecisionProbes(1885, restricted);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(DecisionProbeError);
    expect((thrown as DecisionProbeError).year).toBe(1885);
    expect((thrown as DecisionProbeError).message).toContain("1885");
  }, 300_000);
});
