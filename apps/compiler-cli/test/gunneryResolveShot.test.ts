import { describe, it, expect, vi, beforeEach, afterEach } from "vite-plus/test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { neutralAccuracyFactors, type GunneryAccuracyFactors } from "@bluewave/combat/gunnery";
import { runGunneryResolveShot, type GunneryResolveShotCliOptions } from "../src/commands.js";
import { runCli } from "./runCli.js";

function stdoutSpy() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true as any);
}

const identity = { battleId: "b1", batteryId: "BAT-1", minute: 1, substep: 0 };

function scenario(
  accuracyFactors: GunneryAccuracyFactors,
  overrides: { count?: number; ammunition?: Record<string, number> } = {},
) {
  return {
    identity,
    accuracyFactors,
    salvo: {
      count: overrides.count ?? 1,
      ammunition: overrides.ammunition ?? {
        ARMOR_PIERCING: 10,
        COMMON: 5,
        HIGH_EXPLOSIVE: 0,
      },
      preferredType: "ARMOR_PIERCING",
    },
  };
}

function baseOptions(inputPath?: string): GunneryResolveShotCliOptions {
  return { outputMode: "human", inputPath, seed: "seed-1" };
}

describe("runGunneryResolveShot", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bwc-resolve-shot-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns usage-error when --input is not provided", async () => {
    expect(await runCli(runGunneryResolveShot(baseOptions()))).toBe("usage-error");
  });

  it("returns usage-error when the input file does not exist", async () => {
    expect(await runCli(runGunneryResolveShot(baseOptions(join(dir, "missing.json"))))).toBe(
      "usage-error",
    );
  });

  it("returns usage-error when the input file is not valid JSON", async () => {
    const inputPath = join(dir, "input.json");
    writeFileSync(inputPath, "not json", "utf8");
    expect(await runCli(runGunneryResolveShot(baseOptions(inputPath)))).toBe("usage-error");
  });

  it("resolves a guaranteed HIT (baseAccuracyBp 10_000, all-neutral factors) and consumes ammunition", async () => {
    const inputPath = join(dir, "input.json");
    writeFileSync(inputPath, JSON.stringify(scenario(neutralAccuracyFactors(10_000))), "utf8");
    const spy = stdoutSpy();
    const result = await runCli(runGunneryResolveShot(baseOptions(inputPath)));
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Final accuracy: 10000bp");
    expect(output).toContain("Result: HIT");
    expect(output).toContain("Ammunition: consumed 1 x ARMOR_PIERCING (10 -> 9)");
    spy.mockRestore();
  });

  it("resolves a guaranteed MISS (baseAccuracyBp 0, all-neutral factors)", async () => {
    const inputPath = join(dir, "input.json");
    writeFileSync(inputPath, JSON.stringify(scenario(neutralAccuracyFactors(0))), "utf8");
    const spy = stdoutSpy();
    const result = await runCli(runGunneryResolveShot(baseOptions(inputPath)));
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("Final accuracy: 0bp");
    expect(output).toContain("Result: MISS");
    spy.mockRestore();
  });

  it("emits structured JSON with the accuracy manifest, hit draw, and ammunition account", async () => {
    const inputPath = join(dir, "input.json");
    writeFileSync(inputPath, JSON.stringify(scenario(neutralAccuracyFactors(10_000))), "utf8");
    const spy = stdoutSpy();
    const result = await runCli(
      runGunneryResolveShot({ ...baseOptions(inputPath), outputMode: "json" }),
    );
    expect(result).toBe("success");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    const jsonLine = output.split("\n").find((line) => line.includes("finalAccuracyBp"));
    expect(jsonLine).toBeDefined();
    const parsed = JSON.parse(jsonLine!);
    expect(parsed.accuracy.finalAccuracyBp).toBe(10_000);
    expect(parsed.hit.isHit).toBe(true);
    expect(parsed.ammunition.account).toEqual({
      type: "ARMOR_PIERCING",
      count: 1,
      before: 10,
      after: 9,
    });
    spy.mockRestore();
  });

  it("is deterministic for the same seed", async () => {
    const inputPath = join(dir, "input.json");
    writeFileSync(inputPath, JSON.stringify(scenario(neutralAccuracyFactors(5_000))), "utf8");
    const spy1 = stdoutSpy();
    await runCli(runGunneryResolveShot({ ...baseOptions(inputPath), outputMode: "json" }));
    const out1 = spy1.mock.calls.map((c) => c[0]).join("");
    spy1.mockRestore();
    const spy2 = stdoutSpy();
    await runCli(runGunneryResolveShot({ ...baseOptions(inputPath), outputMode: "json" }));
    const out2 = spy2.mock.calls.map((c) => c[0]).join("");
    spy2.mockRestore();
    expect(out1).toBe(out2);
  });

  it("routes GUNNERY_ACCURACY_FACTOR_MISSING through the ticket-01 adapter as validation-error", async () => {
    const inputPath = join(dir, "input.json");
    const factors = neutralAccuracyFactors(5_000) as any;
    delete factors.range;
    writeFileSync(inputPath, JSON.stringify(scenario(factors)), "utf8");
    const spy = stdoutSpy();
    const result = await runCli(runGunneryResolveShot(baseOptions(inputPath)));
    expect(result).toBe("validation-error");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("GUNNERY_ACCURACY_FACTOR_MISSING");
    spy.mockRestore();
  });

  it("routes GUNNERY_AMMUNITION_UNAVAILABLE (insufficient rounds) through the adapter as validation-error", async () => {
    const inputPath = join(dir, "input.json");
    writeFileSync(
      inputPath,
      JSON.stringify(
        scenario(neutralAccuracyFactors(10_000), {
          count: 100,
          ammunition: { ARMOR_PIERCING: 1, COMMON: 0, HIGH_EXPLOSIVE: 0 },
        }),
      ),
      "utf8",
    );
    const spy = stdoutSpy();
    const result = await runCli(runGunneryResolveShot(baseOptions(inputPath)));
    expect(result).toBe("validation-error");
    const output = spy.mock.calls.map((c) => c[0]).join("");
    expect(output).toContain("GUNNERY_AMMUNITION_UNAVAILABLE");
    spy.mockRestore();
  });
});
