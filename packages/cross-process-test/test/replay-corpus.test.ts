import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import { recordReplay, verifyReplay, type ReplayScenario } from "../src/replay-corpus/index.js";

const SCENARIO: ReplayScenario = { id: "test-two-months", seed: "replay-test", months: 2 };

function tamper(text: string, edit: (file: Record<string, any>) => void): string {
  const file = JSON.parse(text);
  edit(file);
  return JSON.stringify(file);
}

function verified(text: string) {
  const result = verifyReplay(text);
  if (Result.isFailure(result)) throw new Error(result.failure.message);
  return result.success;
}

describe("replay corpus record/verify", () => {
  const recorded = recordReplay(SCENARIO);

  it("records byte-identical files for the same scenario", () => {
    expect(recordReplay(SCENARIO)).toBe(recorded);
  });

  it("verifies an unmodified replay", () => {
    expect(verified(recorded)).toEqual({ ok: true, months: 2 });
  });

  it("fails a tampered snapshot checkpoint at its month", () => {
    const outcome = verified(
      tamper(recorded, (f) => {
        f.months[1].snapshotHash = "0".repeat(64);
      }),
    );
    expect(outcome).toMatchObject({ ok: false, divergence: { month: 2, where: "snapshot" } });
  });

  it("localises a tampered ledger entry to its ledger and index", () => {
    const outcome = verified(
      tamper(recorded, (f) => {
        f.months[0].ledgers.financial.entryHashes[3] = "f".repeat(64);
      }),
    );
    expect(outcome).toMatchObject({
      ok: false,
      divergence: { month: 1, where: "financial", entryIndex: 3 },
    });
  });

  it("rejects an unknown format version with a clear error", () => {
    const result = verifyReplay(tamper(recorded, (f) => (f.formatVersion = 99)));
    expect(Result.isFailure(result) && result.failure.message).toContain("format version 99");
  });

  it("rejects excess properties", () => {
    const result = verifyReplay(tamper(recorded, (f) => (f.surprise = true)));
    expect(Result.isFailure(result) && result.failure.message).toContain("surprise");
  });
});
