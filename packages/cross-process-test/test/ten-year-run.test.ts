import { describe, it, expect } from "vite-plus/test";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// N-3 acceptance (#47 R5): a command-free run over the fourteen committed
// nations from the compiled 1880 pack through 120 months to 1890-01, with a
// checkpoint as each calendar year opens. Two fresh processes must agree on
// every checkpoint and the closing hash. Economy gates are model-derived (#138):
// no allowlist, no tolerated diagnostic.

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
  readonly initialSnapshotHash: string;
  readonly yearlyCheckpoints: readonly YearlyCheckpoint[];
  readonly monthlyHashes: readonly string[];
  readonly monthlySuccess: readonly boolean[];
  readonly closingSnapshotHash: string;
  readonly diagnostics: readonly TenYearDiagnostic[];
  readonly firstShortfallMonth: Readonly<Record<string, number>>;
  readonly firstDeficitMonth: Readonly<Record<string, number>>;
  readonly ledgerIdentityBreaks: readonly string[];
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
    expect(first.output.initialSnapshotHash).toHaveLength(64);
    first.output.yearlyCheckpoints.forEach((checkpoint, index) => {
      expect(checkpoint.month).toBe(`${String(checkpoint.year)}-01`);
      expect(checkpoint.snapshotHash).toHaveLength(64);
      if (index === 0) expect(checkpoint.snapshotHash).toBe(first.output.initialSnapshotHash);
    });
    expect(
      new Set(first.output.yearlyCheckpoints.map((checkpoint) => checkpoint.snapshotHash)).size,
    ).toBe(10);
    expect(first.output.closingSnapshotHash).toHaveLength(64);
    expect(first.output.closingSnapshotHash).toBe(second.output.closingSnapshotHash);

    // Every nation still fields hulls at 1890-01.
    expect(Object.keys(first.output.hullCounts)).toHaveLength(14);
    for (const [nationId, hulls] of Object.entries(first.output.hullCounts)) {
      expect(hulls, `nation '${nationId}' fields no hulls after 120 months`).toBeGreaterThan(0);
    }

    // Economy spec #138 gates (replacing the decade-insolvency tolerance of decision 0014-A, now superseded): no error
    // diagnostic, the ledger identity closes every month, and insolvency is not the uniform state of the pack.
    expect(first.output.diagnostics).toEqual([]);
    expect(first.output.ledgerIdentityBreaks).toEqual([]);
    expect(first.output.monthlySuccess.every(Boolean)).toBe(true);
    expect(Object.keys(first.output.firstShortfallMonth).length).toBeLessThan(
      Object.keys(first.output.hullCounts).length,
    );
    // Solvency implication: a shortfall only ever follows a month whose requested flows ran a deficit before
    // construction, so no solvent nation falls short. Portugal runs a structural deficit from month 1 (net -1 a month),
    // so its opening treasury is exhausted at the closed-form month 41 (spec #138 G8). Qing starts solvent: completing its
    // seeded Dingyuan commissions a hull whose maintenance turns the net negative at month 71, and the treasury lasts to
    // month 104 — an emergent, recorded deficit, not a modelling defect.
    for (const [nationId, shortfall] of Object.entries(first.output.firstShortfallMonth)) {
      const deficit = first.output.firstDeficitMonth[nationId];
      expect(
        deficit,
        `nation '${nationId}' fell short without ever running a deficit`,
      ).toBeDefined();
      expect(shortfall).toBeGreaterThan(deficit!);
    }
    expect(first.output.firstDeficitMonth["portugal"]).toBe(1);
    expect(first.output.firstShortfallMonth["portugal"]).toBe(41);
    expect(first.output.firstShortfallMonth).toEqual({ portugal: 41, qing: 104 });
    expect(first.output.firstShortfallMonth).toEqual(second.output.firstShortfallMonth);
    expect(first.output.diagnostics).toEqual(second.output.diagnostics);
  }, 600_000);
});
