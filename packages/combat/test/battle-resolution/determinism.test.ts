import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(
  thisDir,
  "..",
  "..",
  "dist",
  "simulation",
  "run-battle-resolution-child.js",
);

function runChild(): string {
  return execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 60_000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
}

describe("AC-10: two-process battle auto-resolution determinism", () => {
  it("two clean Node child processes emit byte-identical auto-resolution output", () => {
    const r1 = runChild();
    const r2 = runChild();
    expect(r1).toBe(r2);
  });

  it("the emitted result is complete and deterministic across processes", () => {
    const parsed = JSON.parse(runChild().trim()) as {
      resultHash: string;
      battleEndReason: string;
      elapsedMinutes: number;
      winnerId: string | null;
      loserId: string | null;
      eventLedgerHash: string;
      minuteHashes: string[];
      damageReport: Record<string, number>;
      survivorSunk: Record<string, string[]>;
    };
    expect(parsed.resultHash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.eventLedgerHash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.minuteHashes.length).toBe(parsed.elapsedMinutes);
    for (const h of parsed.minuteHashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    for (const loss of Object.values(parsed.damageReport)) {
      expect(loss).toBeGreaterThanOrEqual(0);
    }
    // survivor/sunk partition covers all 4 ships
    const all = [
      ...parsed.survivorSunk.attackerSurvivorIds,
      ...parsed.survivorSunk.defenderSurvivorIds,
      ...parsed.survivorSunk.attackerSunkIds,
      ...parsed.survivorSunk.defenderSunkIds,
    ].sort();
    expect(all).toEqual(["a1", "a2", "d1", "d2"]);
  });
});
