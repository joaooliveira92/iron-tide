import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { AiCommandGenerator, AiError } from "../src/index.js";
import type { AiCommandContext } from "../src/index.js";

const validHash = sha256Hex(canonicalSerialize({ ai: "error-fixture" }));

function makeGenerator(overrides: Partial<AiCommandContext> = {}): AiCommandGenerator {
  return new AiCommandGenerator({
    campaignId: "camp-1",
    turnNumber: SafeInt(42),
    expectedSnapshotHash: validHash,
    ...overrides,
  });
}

function isAiError(value: unknown): value is AiError {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { readonly _tag?: unknown })._tag === "AiError"
  );
}

function capture(fn: () => unknown): AiError {
  try {
    fn();
  } catch (error) {
    if (isAiError(error)) return error;
    throw error;
  }
  throw new Error("expected an AiError");
}

describe("AiError", () => {
  it("is a Data.TaggedError with the verbatim message", () => {
    const gen = makeGenerator();
    const error = capture(() => gen.buildBudgetCommand("GBR", "p1", SafeInt(0)));
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe("budget amount must be >=1");
    expect(error).toBeInstanceOf(Error);
  });

  it("rejects an empty campaignId with the verbatim message", () => {
    const error = capture(() => makeGenerator({ campaignId: "" }));
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe("campaignId must be non-empty string");
  });

  it("rejects an empty expectedSnapshotHash before the hex check", () => {
    const error = capture(() => makeGenerator({ expectedSnapshotHash: "" }));
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe("expectedSnapshotHash must be non-empty string");
  });

  it("rejects a non-64-hex expectedSnapshotHash", () => {
    const error = capture(() => makeGenerator({ expectedSnapshotHash: "not-a-hash" }));
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe("expectedSnapshotHash must be 64 hex chars");
  });

  it("rejects an empty nationId with the verbatim message", () => {
    const gen = makeGenerator();
    const error = capture(() => gen.buildBudgetCommand("", "p1", SafeInt(1)));
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe("nationId must be non-empty string");
  });

  it("rejects a non-object fieldPriorities map", () => {
    const gen = makeGenerator();
    const error = capture(() => gen.buildResearchPriorityCommand("GBR", null as never));
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe("fieldPriorities must be object");
  });

  it("rejects an empty fieldPriorities key", () => {
    const gen = makeGenerator();
    const error = capture(() => gen.buildResearchPriorityCommand("GBR", { "": SafeInt(1) }));
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe("fieldPriorities key must be non-empty string");
  });
});

describe("AiError SafeInt reuse", () => {
  it("rejects a non-integer turnNumber via SafeInt with the verbatim message", () => {
    const error = capture(
      () =>
        new AiCommandGenerator({
          campaignId: "camp-1",
          turnNumber: 1.5 as SafeInt,
          expectedSnapshotHash: validHash,
        }),
    );
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe("turnNumber must be SafeInt (safe integer), got 1.5");
  });

  it("rejects NaN turnNumber via SafeInt", () => {
    const error = capture(
      () =>
        new AiCommandGenerator({
          campaignId: "camp-1",
          turnNumber: Number.NaN as SafeInt,
          expectedSnapshotHash: validHash,
        }),
    );
    expect(error.message).toBe("turnNumber must be SafeInt (safe integer), got NaN");
  });

  it("rejects an unsafe integer amount (MAX_SAFE_INTEGER + 1) via SafeInt", () => {
    const gen = makeGenerator();
    const tooBig = (Number.MAX_SAFE_INTEGER + 1) as SafeInt;
    const error = capture(() => gen.buildBudgetCommand("GBR", "p1", tooBig));
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe(
      `amount must be SafeInt (safe integer), got ${String(Number.MAX_SAFE_INTEGER + 1)}`,
    );
  });

  it("rejects a non-integer research priority via SafeInt", () => {
    const gen = makeGenerator();
    const error = capture(() =>
      gen.buildResearchPriorityCommand("GBR", { GUNNERY: 1.5 as SafeInt }),
    );
    expect(error._tag).toBe("AiError");
    expect(error.message).toBe("fieldPriorities[GUNNERY] must be SafeInt (safe integer), got 1.5");
  });

  it("accepts the safe-integer boundary at MAX_SAFE_INTEGER", () => {
    const gen = makeGenerator();
    expect(() =>
      gen.buildBudgetCommand("GBR", "p1", SafeInt(Number.MAX_SAFE_INTEGER)),
    ).not.toThrow();
  });

  it("keeps the deterministic envelope for safe-integer inputs", () => {
    const gen = makeGenerator();
    const a = gen.buildBudgetCommand("GBR", "p1", SafeInt(50));
    const b = makeGenerator().buildBudgetCommand("GBR", "p1", SafeInt(50));
    expect(a.commandId).toBe(b.commandId);
    expect(a.idempotencyKey).toBe(b.idempotencyKey);
    expect(a.timestamp).toBe(b.timestamp);
  });
});
