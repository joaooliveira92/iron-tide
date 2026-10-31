import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

const childScript = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "run-event-draw-child.js",
);

const MonthRecord = Schema.Struct({
  month: Schema.Number,
  snapshotHash: Schema.String,
  randomLedgerHash: Schema.String,
  eventDraws: Schema.Number,
  playerPending: Schema.NullOr(Schema.String),
  playerFired: Schema.String,
  aiFired: Schema.Number,
});

const ChildOutput = Schema.Union([
  Schema.Struct({ success: Schema.Literal(true), months: Schema.Array(MonthRecord) }),
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
  return decoded.months;
}

describe("Event draw cross-process determinism (S-4 slice 3)", () => {
  it("two clean processes produce identical hashes across the draw and the default", () => {
    const first = runChild();
    const second = runChild();
    expect(second).toEqual(first);
    expect(first).toHaveLength(6);
    expect(new Set(first.map((m) => m.snapshotHash)).size).toBe(first.length);
  });

  it("draws the player dilemma in month 1 and defaults it only after 3 elapsed months", () => {
    const months = runChild();
    expect(months[0]!.playerPending).toBe("cross_process_incident");
    expect(months[0]!.playerFired).toBe("");
    expect(months[1]!.playerPending).toBe("cross_process_incident");
    expect(months[2]!.playerPending).toBe("cross_process_incident");
    expect(months[3]!.playerPending).toBeNull();
    expect(months[3]!.playerFired).toMatch(/^\d{4}-\d{2}:protest:DEFAULT$/);
  });

  it("resolves the AI nations in the same pass", () => {
    const months = runChild();
    expect(months[0]!.aiFired).toBeGreaterThan(0);
    expect(months[0]!.eventDraws).toBeGreaterThan(1);
  });
});
