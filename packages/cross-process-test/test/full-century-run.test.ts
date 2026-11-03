import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "dist", "run-child.js");

interface FullCenturyOutput {
  readonly mode: string;
  readonly months: number;
  readonly inProcessRepeatMatches: boolean;
  readonly success: boolean;
  readonly initialSnapshotHash: string;
  readonly yearlyCheckpoints: readonly {
    readonly year: number;
    readonly month: string;
    readonly snapshotHash: string;
  }[];
  readonly monthlyHashes: readonly string[];
  readonly monthlySuccess: readonly boolean[];
  readonly closingSnapshotHash: string;
  readonly diagnostics: readonly {
    readonly month: number;
    readonly nationId: string | null;
    readonly code: string;
    readonly message: string;
  }[];
  readonly firstShortfallMonth: Readonly<Record<string, number>>;
  readonly firstDeficitMonth: Readonly<Record<string, number>>;
  readonly ledgerIdentityBreaks: readonly string[];
  readonly hullCounts: Readonly<Record<string, number>>;
}

function runFullCenturyChild(): { readonly output: FullCenturyOutput; readonly stdout: string } {
  const stdout = execFileSync(process.execPath, [childScript, "production-full-century"], {
    encoding: "utf8",
    timeout: 600_000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  return { output: JSON.parse(lines[lines.length - 1]!) as FullCenturyOutput, stdout };
}

describe("E-1 1880-1970 unattended run", () => {
  it("runs 1080 command-free months with yearly checkpoints, byte-identical across processes", () => {
    const first = runFullCenturyChild();
    const second = runFullCenturyChild();

    expect(first.stdout).toBe(second.stdout);
    expect(first.output.mode).toBe("production-full-century");
    expect(first.output.inProcessRepeatMatches).toBe(true);
    expect(first.output.months).toBe(1080);
    expect(first.output.monthlyHashes).toHaveLength(1080);
    expect(first.output.monthlySuccess).toHaveLength(1080);

    const expectedYears: number[] = [];
    for (let y = 1880; y <= 1969; y++) expectedYears.push(y);
    expect(first.output.yearlyCheckpoints.map((c) => c.year)).toEqual(expectedYears);

    expect(first.output.initialSnapshotHash).toHaveLength(64);
    first.output.yearlyCheckpoints.forEach((c, i) => {
      expect(c.month).toBe(`${String(c.year)}-01`);
      expect(c.snapshotHash).toHaveLength(64);
      if (i === 0) expect(c.snapshotHash).toBe(first.output.initialSnapshotHash);
    });
    expect(new Set(first.output.yearlyCheckpoints.map((c) => c.snapshotHash)).size).toBe(90);
    expect(first.output.closingSnapshotHash).toHaveLength(64);
    expect(first.output.closingSnapshotHash).toBe(second.output.closingSnapshotHash);

    expect(Object.keys(first.output.hullCounts)).toHaveLength(14);
    for (const [nationId, hulls] of Object.entries(first.output.hullCounts)) {
      expect(hulls, `nation '${nationId}' fields no hulls after 1080 months`).toBeGreaterThan(0);
    }

    expect(first.output.monthlySuccess.every(Boolean)).toBe(true);
    expect(first.output.diagnostics).toEqual([]);
    expect(first.output.ledgerIdentityBreaks).toEqual([]);
    expect(Object.keys(first.output.firstShortfallMonth).length).toBeLessThanOrEqual(
      Object.keys(first.output.hullCounts).length,
    );
    for (const [nationId, shortfall] of Object.entries(first.output.firstShortfallMonth)) {
      const deficit = first.output.firstDeficitMonth[nationId];
      expect(
        deficit,
        `nation '${nationId}' fell short without ever running a deficit`,
      ).toBeDefined();
      expect(shortfall).toBeGreaterThan(deficit!);
    }
    expect(first.output.firstShortfallMonth).toEqual(second.output.firstShortfallMonth);
    expect(first.output.diagnostics).toEqual(second.output.diagnostics);
  }, 1_200_000);
});
