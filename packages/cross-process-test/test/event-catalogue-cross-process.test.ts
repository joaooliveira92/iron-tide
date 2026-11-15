import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";

const childScript = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "dist",
  "run-event-catalogue-child.js",
);

const DEFAULT_ANSWER_AFTER_MONTHS = 3;
const MONTHS = 60;

const RunSchema = Schema.Struct({
  months: Schema.Array(
    Schema.Struct({
      month: Schema.Number,
      snapshotHash: Schema.String,
      randomLedgerHash: Schema.String,
      eventDraws: Schema.Number,
      pending: Schema.Array(Schema.String),
      oldestPendingAge: Schema.Number,
    }),
  ),
  fired: Schema.Array(
    Schema.Struct({
      nationId: Schema.String,
      eventId: Schema.String,
      month: Schema.String,
      answerId: Schema.String,
      resolvedBy: Schema.String,
    }),
  ),
  contentHash: Schema.String,
  catalogueSize: Schema.Number,
  nationIds: Schema.Array(Schema.String),
  careerEndedMonth: Schema.NullOr(Schema.Number),
});

const ChildOutput = Schema.Union([
  Schema.Struct({ success: Schema.Literal(true), run: RunSchema }),
  Schema.Struct({ success: Schema.Literal(false), error: Schema.String }),
]);

function runChild() {
  const stdout = execFileSync(process.execPath, [childScript], {
    encoding: "utf8",
    timeout: 540_000,
    env: { ...process.env, NODE_OPTIONS: "" },
  });
  const lines = stdout.trim().split("\n");
  const decoded = Schema.decodeUnknownSync(ChildOutput)(JSON.parse(lines[lines.length - 1]!));
  if (!decoded.success) throw new Error(decoded.error);
  return decoded.run;
}

describe("Production event catalogue, unattended run (S-4 slice 6)", () => {
  it("is hash-identical across two clean processes and never reaches a dead state", () => {
    const first = runChild();
    const second = runChild();
    expect(second).toEqual(first);
    expect(first.careerEndedMonth).toBeNull();
    expect(first.months).toHaveLength(MONTHS);
    expect(new Set(first.months.map((m) => m.snapshotHash)).size).toBe(MONTHS);
    expect(first.catalogueSize).toBeGreaterThanOrEqual(12);
    expect(first.fired.length).toBeGreaterThan(0);
    for (const month of first.months) {
      expect(month.eventDraws, `month ${month.month} draws`).toBeGreaterThan(0);
      expect(month.oldestPendingAge, `month ${month.month} pending age`).toBeLessThanOrEqual(
        DEFAULT_ANSWER_AFTER_MONTHS,
      );
    }
  }, 600_000);
});
