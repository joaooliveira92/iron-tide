import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "..", "dist-harness", "harness", "run-gunnery-child.js");

function runChild(): string {
  return execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
}

describe("AC-13 two-process gunnery determinism (two separate child processes)", () => {
  it("two clean Node child processes emit byte-identical gunnery advance output", () => {
    const r1 = runChild();
    const r2 = runChild();
    expect(r1).toBe(r2);
  });

  it("a gunnery-bearing minute advance emits reproducible minute hashes + salvo event hashes", () => {
    const parsed = JSON.parse(runChild().trim()) as {
      hashes: string[];
      gunneryEventCount: number;
      gunneryEventHashes: string[];
      lastGunneryStates: { id: string; ammunition: Record<string, number> }[];
    };
    expect(parsed.hashes).toHaveLength(3);
    for (const h of parsed.hashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.gunneryEventCount).toBeGreaterThan(0);
    for (const h of parsed.gunneryEventHashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.lastGunneryStates[0]!.ammunition.ARMOR_PIERCING).toBeLessThan(120);
  });
});
