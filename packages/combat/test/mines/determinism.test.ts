import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vite-plus/test";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "..", "dist-harness", "harness", "run-mines-child.js");

function runChild(): string {
  return execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
}

interface ChildOutput {
  childId: string;
  openingRecordHashes: string[];
  reinforcedHashes: string[];
  sweptPressure0: number;
  sweptPressure1: number;
  routeRiskBp: number;
  standoffLevel: string | number;
  classificationOutcome: string;
  classificationDraw: number;
  reportHash: string;
  clearedEmittedCode: string | null;
  decayedPressure: number;
  resolutionRecordHash: string;
  rngHash: string;
}

describe("AC-23 cross-process mine-warfare determinism (two child processes)", () => {
  it("the built child script exists (a prior gate compiled dist)", () => {
    expect(existsSync(childScript)).toBe(true);
  });

  it("two clean Node child processes emit byte-identical output", () => {
    const r1 = runChild();
    const r2 = runChild();
    expect(r1).toBe(r2);
  });

  it("the resolution + pressure record hashes are 64-hex and deterministic", () => {
    const parsed = JSON.parse(runChild().trim()) as ChildOutput;
    expect(parsed.childId).toBe("run-mines-child");
    expect(parsed.resolutionRecordHash).toMatch(/^[0-9a-f]{64}$/);
    for (const h of parsed.openingRecordHashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    for (const h of parsed.reinforcedHashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.reportHash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.rngHash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.classificationDraw).toBeGreaterThanOrEqual(0);
  });

  it("the full resolution chain was exercised (sweep, decay, standoff, clearance)", () => {
    const parsed = JSON.parse(runChild().trim()) as ChildOutput;
    expect(parsed.sweptPressure0).toBeGreaterThan(0);
    expect(parsed.decayedPressure).toBeGreaterThan(0);
    expect(parsed.standoffLevel).not.toBe("none");
    expect(parsed.routeRiskBp).toBeGreaterThan(0);
    expect(parsed.clearedEmittedCode).toBe("MINEFIELD_CLEARED");
    expect(parsed.classificationOutcome.length).toBeGreaterThan(0);
  });
});
