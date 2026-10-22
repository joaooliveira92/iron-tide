import { describe, expect, it } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FLOAT_UNIT } from "../../src/battleResolution/constants.js";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "..", "dist", "simulation", "run-torpedo-child.js");

function runChild(): string {
  return execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
}

interface ChildOutput {
  hashes: string[];
  torpedoEventCounts: number[];
  recordIds: string[];
  trackCounts: number[];
  lastDamageStates: {
    shipId: string;
    structuralIntegrity: number;
    flotationReserve: number;
    terminalStatus: string;
    floodingRecords: number;
  }[];
}

describe("AC-23 cross-process torpedo determinism (two child processes)", () => {
  it("two clean Node child processes emit byte-identical output", () => {
    const r1 = runChild();
    const r2 = runChild();
    expect(r1).toBe(r2);
  });

  it("identical per-minute hashes are 64-hex and torpedo events were emitted", () => {
    const parsed = JSON.parse(runChild().trim()) as ChildOutput;
    expect(parsed.hashes).toHaveLength(3);
    for (const h of parsed.hashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.torpedoEventCounts[0]).toBeGreaterThanOrEqual(6);
    expect(parsed.recordIds.length).toBeGreaterThan(0);
    expect(parsed.recordIds.every((id) => id.startsWith("b7-torpedo-determinism:"))).toBe(true);
  });

  it("the full chain is exercised (torpedo damage reached the target state)", () => {
    const parsed = JSON.parse(runChild().trim()) as ChildOutput;
    const damaged = parsed.lastDamageStates.find((s) => s.shipId === "d1");
    expect(damaged).toBeDefined();
    expect(damaged!.structuralIntegrity).toBeLessThan(100_000);
    expect(damaged!.flotationReserve).toBeLessThan(FLOAT_UNIT);
    expect(damaged!.floodingRecords).toBeGreaterThan(0);
  });
});
