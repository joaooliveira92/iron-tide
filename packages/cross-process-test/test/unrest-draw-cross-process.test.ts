import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

const childScript = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "run-unrest-draw-child.js",
);

const SeedRecord = Schema.Struct({
  seed: Schema.String,
  snapshotHash: Schema.String,
  randomLedgerHash: Schema.String,
  draws: Schema.Array(Schema.String),
  careerResult: Schema.String,
  endedWars: Schema.Number,
  consequences: Schema.Array(Schema.String),
});

const ChildOutput = Schema.Union([
  Schema.Struct({ success: Schema.Literal(true), seeds: Schema.Array(SeedRecord) }),
  Schema.Struct({ success: Schema.Literal(false), error: Schema.String }),
]);

function runChild() {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 180_000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  const decoded = Schema.decodeUnknownSync(ChildOutput)(JSON.parse(lines[lines.length - 1]!));
  if (!decoded.success) throw new Error(decoded.error);
  return decoded.seeds;
}

describe("Unrest revolution draw cross-process determinism (#996)", () => {
  it("two clean processes draw the same revolution outcomes and reach the same hashes", () => {
    const first = runChild();
    const second = runChild();
    expect(second).toEqual(first);
    expect(first).toHaveLength(12);
  });

  it("draws once per nation at war until a revolution ends it, keeping both outcomes in play", () => {
    const seeds = runChild();
    for (const record of seeds) {
      const rivalRevolted = record.draws[0]?.endsWith(":REVOLUTION") === true;
      expect(record.draws).toHaveLength(rivalRevolted ? 1 : 2);
      expect(record.endedWars).toBe(rivalRevolted ? 1 : 0);
      expect(
        record.draws.every((draw) => /^[a-z_]+\/\d{4}-\d{2}:(REVOLUTION|QUIET)$/.test(draw)),
      ).toBe(true);
    }
    const outcomes = new Set(seeds.flatMap((record) => record.draws.map((d) => d.split(":")[1])));
    expect(outcomes).toEqual(new Set(["REVOLUTION", "QUIET"]));
    const revolted = seeds.filter((record) => record.careerResult === "REVOLUTION");
    expect(revolted.length).toBeGreaterThan(0);
    expect(revolted.length).toBeLessThan(seeds.length);
    expect(new Set(seeds.map((record) => record.snapshotHash)).size).toBeGreaterThan(1);
  });
});
