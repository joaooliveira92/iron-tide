import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// N-3 acceptance (#47 R5): a command-free run over the fourteen committed
// nations from the compiled 1880 pack through 120 months to 1890-01, with a
// checkpoint as each calendar year opens. Two fresh processes must agree on
// every checkpoint and the closing hash. The known S-1 Portugal/Netherlands
// treasury baseline is the only allowlisted failure; anything else is a stop
// condition, never a new allowlist entry.

const thisDir = dirname(fileURLToPath(import.meta.url));
const childScript = resolve(thisDir, "..", "dist", "run-child.js");

interface TenYearDiagnostic {
  readonly month: number;
  readonly nationId: string | null;
  readonly code: string;
  readonly message: string;
}

interface YearlyCheckpoint {
  readonly year: number;
  readonly month: string;
  readonly snapshotHash: string;
}

interface TenYearOutput {
  readonly mode: string;
  readonly months: number;
  readonly inProcessRepeatMatches: boolean;
  readonly success: boolean;
  readonly yearlyCheckpoints: readonly YearlyCheckpoint[];
  readonly monthlyHashes: readonly string[];
  readonly monthlySuccess: readonly boolean[];
  readonly closingSnapshotHash: string;
  readonly diagnostics: readonly TenYearDiagnostic[];
  readonly hullCounts: Readonly<Record<string, number>>;
}

function runTenYearChild(): { readonly output: TenYearOutput; readonly stdout: string } {
  const stdout = execFileSync(process.execPath, [childScript, "production-ten-year"], {
    encoding: "utf8",
    timeout: 300_000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  return { output: JSON.parse(lines[lines.length - 1]!) as TenYearOutput, stdout };
}

describe("N-3 ten-year progression run", () => {
  it("runs 120 command-free months with yearly checkpoints, byte-identical across processes", () => {
    const first = runTenYearChild();
    const second = runTenYearChild();

    expect(first.stdout).toBe(second.stdout);
    expect(first.output.mode).toBe("production-ten-year");
    expect(first.output.inProcessRepeatMatches).toBe(true);
    expect(first.output.months).toBe(120);
    expect(first.output.monthlyHashes).toHaveLength(120);
    expect(first.output.monthlySuccess).toHaveLength(120);

    expect(first.output.yearlyCheckpoints.map((checkpoint) => checkpoint.year)).toEqual([
      1880, 1881, 1882, 1883, 1884, 1885, 1886, 1887, 1888, 1889,
    ]);
    first.output.yearlyCheckpoints.forEach((checkpoint, index) => {
      expect(checkpoint.month).toBe(`${String(checkpoint.year)}-01`);
      const expected =
        index === 0 ? first.output.monthlyHashes[0] : first.output.monthlyHashes[index * 12 - 1]!;
      expect(checkpoint.snapshotHash).toHaveLength(64);
      if (index > 0) expect(checkpoint.snapshotHash).toBe(expected);
    });
    expect(first.output.closingSnapshotHash).toHaveLength(64);
    expect(first.output.closingSnapshotHash).toBe(second.output.closingSnapshotHash);

    // Every nation still fields hulls at 1890-01.
    expect(Object.keys(first.output.hullCounts)).toHaveLength(14);
    for (const [nationId, hulls] of Object.entries(first.output.hullCounts)) {
      expect(hulls, `nation '${nationId}' fields no hulls after 120 months`).toBeGreaterThan(0);
    }

    // Owner decision 0014-A: a command-free decade is expected to exhaust every
    // nation's treasury, so NEGATIVE_TREASURY_OBLIGATION is the only tolerated
    // code. A new diagnostic code fails the gate; the economy fix is a separate
    // milestone ticket, not part of N-3.
    for (const diagnostic of first.output.diagnostics) {
      expect(
        diagnostic.code,
        `unexpected month-${String(diagnostic.month)} diagnostic ${diagnostic.nationId ?? "<unknown>"}|${diagnostic.code}: ${diagnostic.message}`,
      ).toBe("NEGATIVE_TREASURY_OBLIGATION");
    }
    expect(new Set(first.output.diagnostics.map((diagnostic) => diagnostic.nationId))).toEqual(
      new Set(Object.keys(first.output.hullCounts)),
    );
    expect(first.output.diagnostics).toEqual(second.output.diagnostics);
  }, 600_000);
});
