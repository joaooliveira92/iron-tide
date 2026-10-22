import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { AI_ENVELOPE_VERSION, AiCommandGenerator } from "../src/aiCommandGenerator";

const ctx = {
  campaignId: "camp-1",
  turnNumber: SafeInt(42) as SafeInt,
  expectedSnapshotHash: sha256Hex(canonicalSerialize({ a: 1 })),
};

describe("AiCommandGenerator determinism", () => {
  it("same input => byte-identical envelope", () => {
    const g1 = new AiCommandGenerator(ctx);
    const g2 = new AiCommandGenerator(ctx);
    const e1 = g1.buildBudgetCommand("usa", "proj-1", SafeInt(10) as SafeInt);
    const e2 = g2.buildBudgetCommand("usa", "proj-1", SafeInt(10) as SafeInt);
    expect(e1).toEqual(e2);
    expect(e1.commandId).toBe(e2.commandId);
    expect(e1.idempotencyKey).toBe(e2.idempotencyKey);
    expect(e1.timestamp).toBe(e2.timestamp);
  });

  it("different command types => different keys/ids", () => {
    const g = new AiCommandGenerator(ctx);
    const b = g.buildBudgetCommand("usa", "p1", SafeInt(1) as SafeInt);
    const r = g.buildResearchPriorityCommand("usa", { a: SafeInt(1) as SafeInt });
    expect(b.idempotencyKey).not.toBe(r.idempotencyKey);
    expect(b.commandId).not.toBe(r.commandId);
  });

  it("encodes '/' and ':' in ids", () => {
    const g = new AiCommandGenerator({ ...ctx, campaignId: "a/b" });
    const e = g.buildBudgetCommand("n:a/b", "p", SafeInt(1) as SafeInt);
    expect(e.idempotencyKey).toContain(encodeURIComponent("a/b"));
    expect(e.idempotencyKey).toContain(encodeURIComponent("n:a/b"));
    expect(e.idempotencyKey.split("/").length).toBe(4);
  });

  it("timestamp deterministic and handles negative turn", () => {
    const gNeg = new AiCommandGenerator({ ...ctx, turnNumber: SafeInt(-1) as SafeInt });
    const gPos = new AiCommandGenerator({ ...ctx, turnNumber: SafeInt(364) as SafeInt });
    expect(gNeg.buildBudgetCommand("usa", "p", SafeInt(1) as SafeInt).timestamp).toBe(
      new Date(Date.UTC(1910, 0, 1) + 364 * 86400000).toISOString(),
    );
    expect(gPos.buildBudgetCommand("usa", "p", SafeInt(1) as SafeInt).timestamp).toBe(
      new Date(Date.UTC(1910, 0, 1) + 364 * 86400000).toISOString(),
    );
  });

  it("envelope is frozen", () => {
    const g = new AiCommandGenerator(ctx);
    const e = g.buildBudgetCommand("usa", "p", SafeInt(1) as SafeInt);
    expect(Object.isFrozen(e)).toBe(true);
  });

  it("fail-closed on bad hash", () => {
    expect(() => new AiCommandGenerator({ ...ctx, expectedSnapshotHash: "bad" })).toThrow();
  });

  it("version pinned", () => {
    const g = new AiCommandGenerator(ctx);
    expect(g.buildBudgetCommand("usa", "p", SafeInt(1) as SafeInt).version).toBe(
      AI_ENVELOPE_VERSION,
    );
  });
});
