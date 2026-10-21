import { readFileSync } from "node:fs";

import { canonicalSerialize } from "@bluewave/deterministic";
import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";

import {
  decodeReplayFile,
  formatDivergence,
  recordReplay,
  verifyReplay,
  type ReplayScenario,
} from "../src/replay-corpus/index.js";

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

function divergenceOf(text: string) {
  const outcome = verified(text);
  if (outcome.ok) throw new Error("expected a divergence");
  return outcome.divergence;
}

describe("replay corpus first-divergence report", () => {
  const recorded = recordReplay(SCENARIO);
  const tampered = tamper(recorded, (f) => {
    f.months[0].ledgers.event.entryHashes[2] = "a".repeat(64);
  });

  it("shows expected and actual hashes and the actual entry value", () => {
    const d = divergenceOf(tampered);
    expect(d).toMatchObject({
      month: 1,
      where: "event",
      entryIndex: 2,
      expected: "a".repeat(64),
      expectedCount: 84,
      actualCount: 84,
    });
    expect(d.actual).toMatch(/^[0-9a-f]{64}$/);
    expect(d.actual).not.toBe(d.expected);
    expect(() => JSON.parse(d.actualEntry ?? "")).not.toThrow();
  });

  it("reports a ledger that grew or shrank at the first missing entry", () => {
    const d = divergenceOf(
      tamper(recorded, (f) => {
        const l = f.months[0].ledgers.event;
        l.entryHashes.pop();
        l.count -= 1;
      }),
    );
    expect(d).toMatchObject({ where: "event", entryIndex: 83, actual: expect.any(String) });
    expect(d.expected).toBe("(missing)");
    expect(d.expectedCount).toBe(83);
    expect(d.actualCount).toBe(84);
  });

  it("formats a stable, platform-independent report", () => {
    const report = formatDivergence(divergenceOf(tampered));
    expect(report).toBe(formatDivergence(divergenceOf(tampered)));
    expect(report).not.toContain("\r");
    expect(report).toContain("month 1");
    expect(report).toContain("event entry 2");
    expect(report).toContain("expected " + "a".repeat(64));
    expect(report).toContain("ledger length expected 84, actual 84");
    expect(report).toContain("actual entry ");
  });
});

describe("replay file format parity", () => {
  const fixture = readFileSync(
    new URL("../../../golden/replays/production-1880-12m.replay.json", import.meta.url),
    "utf8",
  );

  it("decodes the checked-in replay and re-encodes it byte-identically", () => {
    const decoded = decodeReplayFile(fixture);
    if (Result.isFailure(decoded)) throw new Error(decoded.failure.message);
    expect(`${canonicalSerialize(decoded.success)}\n`).toBe(fixture);
  });

  it("rejects a ledger whose count disagrees with its entry hashes", () => {
    const result = decodeReplayFile(
      tamper(fixture, (f) => {
        f.months[0].ledgers.event.count += 1;
      }),
    );
    expect(Result.isFailure(result) && result.failure.message).toContain("count");
  });
});
