import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

import {
  DecisionProbeError,
  assertDecisionProbes,
  probeDecisions,
  type DecisionProbeResult,
  type ProbeReferenceDesign,
} from "../src/decision-probes.js";
import { compileProductionCampaign, probeReferenceDesigns } from "../src/production-pack.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
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
    const { state, bundle } = compileProductionCampaign();
    const snapshot = state.snapshot;
    const slot = snapshot.slots.find((candidate) => candidate.type === "playable");
    if (slot === undefined) throw new Error("production pack has no playable slot");
    const references: readonly ProbeReferenceDesign[] = probeReferenceDesigns(bundle);
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
    expect(() => assertDecisionProbes(1885, restricted)).toThrow(DecisionProbeError);
    expect(() => assertDecisionProbes(1885, restricted)).toThrow(
      /1885 (research|construction|design)/,
    );
  }, 300_000);
});
