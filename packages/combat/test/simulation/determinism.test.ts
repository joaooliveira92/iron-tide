import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "..", "dist-harness", "harness", "run-minutes-child.js");

function runChild(): string {
  return execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 30000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
}

describe("AC-13 cross-process determinism (two separate child processes)", () => {
  it("two clean Node child processes emit byte-identical simulation output", () => {
    const r1 = runChild();
    const r2 = runChild();
    expect(r1).toBe(r2);
  });

  it("per-minute hashes are lowercase 64-hex and reproducible across processes", () => {
    const r = runChild();
    const parsed = JSON.parse(r.trim()) as {
      hashes: string[];
      eventCount: number;
      contactIds: string[];
    };
    expect(parsed.hashes).toHaveLength(3);
    for (const h of parsed.hashes) expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.eventCount).toBeGreaterThan(0);
    expect(parsed.contactIds.sort()).toEqual(
      ["b2-determinism:a1", "b2-determinism:a2", "b2-determinism:d1", "b2-determinism:d2"].sort(),
    );
  });
});
