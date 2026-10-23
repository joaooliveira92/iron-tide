import { describe, it, expect } from "vite-plus/test";
import {
  RandomEngine,
  RandomLedger,
  drawUniform,
  drawBoolean,
  splitSeed,
  drawFromSeed,
} from "../src/index.js";
import { SafeInt } from "@bluewave/contracts";

describe("seeded-prng", () => {
  it("splitSeed produces different results for different domains", () => {
    const seed = "master-seed-123";
    const a = splitSeed(seed, "domain:alpha");
    const b = splitSeed(seed, "domain:beta");
    expect(a).not.toBe(b);
  });

  it("splitSeed is deterministic", () => {
    const seed = "deterministic-test";
    const a = splitSeed(seed, "same-domain");
    const b = splitSeed(seed, "same-domain");
    expect(a).toBe(b);
  });

  it("drawFromSeed returns a float in [0, 1)", () => {
    const seeds = ["a", "b", "c", "d", "e"];
    for (const s of seeds) {
      const val = drawFromSeed(s);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(1);
    }
  });

  it("drawFromSeed is deterministic", () => {
    const a = drawFromSeed("fixed-seed");
    const b = drawFromSeed("fixed-seed");
    expect(a).toBe(b);
  });
});

describe("RandomEngine", () => {
  it("produces domain-separated sequences", () => {
    const engine = new RandomEngine("test-seed");
    const streamA = engine.stream("nation:GBR:research");
    const streamB = engine.stream("nation:FRA:research");

    const seqA = [streamA.next(), streamA.next(), streamA.next()];
    const seqB = [streamB.next(), streamB.next(), streamB.next()];

    expect(seqA).not.toEqual(seqB);
  });

  it("is deterministic: same seed + domain produces same sequence", () => {
    const engine1 = new RandomEngine("deterministic-seed");
    const stream1 = engine1.stream("battle:resolve");

    const engine2 = new RandomEngine("deterministic-seed");
    const stream2 = engine2.stream("battle:resolve");

    const seq1 = [stream1.next(), stream1.next(), stream1.next()];
    const seq2 = [stream2.next(), stream2.next(), stream2.next()];

    expect(seq1).toEqual(seq2);
  });

  it("different master seeds produce different sequences for same domain", () => {
    const engine1 = new RandomEngine("seed-one");
    const engine2 = new RandomEngine("seed-two");

    const stream1 = engine1.stream("same:domain");
    const stream2 = engine2.stream("same:domain");

    const seq1 = [stream1.next(), stream1.next()];
    const seq2 = [stream2.next(), stream2.next()];

    expect(seq1).not.toEqual(seq2);
  });
});

describe("RandomLedger", () => {
  it("accumulates decisions and provides them via all", () => {
    const ledger = new RandomLedger();
    expect(ledger.all).toHaveLength(0);

    ledger.record({
      streamId: "nation:GBR:research",
      entityKey: "GBR",
      phase: "research",
      rulesetVersion: "1.0.0",
      inputHash: "abc123",
      draw: 0.42,
      outcome: "success",
      reasonCode: "ROLL_ABOVE_THRESHOLD",
    });

    expect(ledger.all).toHaveLength(1);
    expect(ledger.all[0]!.streamId).toBe("nation:GBR:research");
  });

  it("hash is deterministic for same decisions", () => {
    const ledger1 = new RandomLedger();
    ledger1.record({
      streamId: "test",
      entityKey: "e1",
      phase: "p1",
      rulesetVersion: "1.0.0",
      inputHash: "hash1",
      draw: 0.5,
      outcome: "yes",
      reasonCode: "TEST",
    });

    const ledger2 = new RandomLedger();
    ledger2.record({
      streamId: "test",
      entityKey: "e1",
      phase: "p1",
      rulesetVersion: "1.0.0",
      inputHash: "hash1",
      draw: 0.5,
      outcome: "yes",
      reasonCode: "TEST",
    });

    expect(ledger1.hash()).toBe(ledger2.hash());
  });

  it("different decisions produce different hashes", () => {
    const ledger1 = new RandomLedger();
    ledger1.record({
      streamId: "test",
      entityKey: "e1",
      phase: "p1",
      rulesetVersion: "1.0.0",
      inputHash: "hash1",
      draw: 0.5,
      outcome: "yes",
      reasonCode: "TEST",
    });

    const ledger2 = new RandomLedger();
    ledger2.record({
      streamId: "test",
      entityKey: "e1",
      phase: "p1",
      rulesetVersion: "1.0.0",
      inputHash: "hash2",
      draw: 0.5,
      outcome: "yes",
      reasonCode: "TEST",
    });

    expect(ledger1.hash()).not.toBe(ledger2.hash());
  });

  it("toJSON produces a string", () => {
    const ledger = new RandomLedger();
    ledger.record({
      streamId: "test",
      entityKey: "e1",
      phase: "p1",
      rulesetVersion: "1.0.0",
      inputHash: "h",
      draw: 0.1,
      outcome: "ok",
      reasonCode: "R",
    });

    const json = ledger.toJSON();
    expect(typeof json).toBe("string");
    expect(json).toContain("streamId");
  });
});

describe("drawUniform", () => {
  it("produces values in [min, max] inclusive", () => {
    const engine = new RandomEngine("uniform-test");
    const stream = engine.stream("test:uniform");

    const min = SafeInt(1);
    const max = SafeInt(100);

    for (let i = 0; i < 100; i++) {
      const val = drawUniform(stream, min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it("when min equals max, always returns that value", () => {
    const engine = new RandomEngine("uniform-const");
    const stream = engine.stream("test:const");

    const min = SafeInt(42);
    const max = SafeInt(42);

    for (let i = 0; i < 20; i++) {
      expect(drawUniform(stream, min, max)).toBe(42 as SafeInt);
    }
  });

  it("produces both min and max over many draws", () => {
    const engine = new RandomEngine("uniform-range");
    const stream = engine.stream("test:range");

    const min = SafeInt(0);
    const max = SafeInt(5);

    const results = new Set<number>();
    for (let i = 0; i < 200; i++) {
      results.add(drawUniform(stream, min, max) as number);
    }

    expect(results.has(0)).toBe(true);
    expect(results.has(5)).toBe(true);
  });
});

describe("drawBoolean", () => {
  it("returns true or false", () => {
    const engine = new RandomEngine("bool-test");
    const stream = engine.stream("test:boolean");

    for (let i = 0; i < 100; i++) {
      const val = drawBoolean(stream);
      expect(typeof val).toBe("boolean");
    }
  });

  it("produces both true and false over many draws", () => {
    const engine = new RandomEngine("bool-variety");
    const stream = engine.stream("test:bools");

    const results = new Set<boolean>();
    for (let i = 0; i < 200; i++) {
      results.add(drawBoolean(stream));
    }

    expect(results.has(true)).toBe(true);
    expect(results.has(false)).toBe(true);
  });
});

describe("stream isolation", () => {
  const take = (stream: { next(): number }, count: number): number[] =>
    Array.from({ length: count }, () => stream.next());

  it("leaves an authoritative stream unchanged by draws from a cosmetic stream", () => {
    const alone = take(new RandomEngine("iso").stream("combat:encounter-1"), 6);

    const engine = new RandomEngine("iso");
    const combat = engine.stream("combat:encounter-1");
    const cosmetic = engine.stream("cosmetic:wake-foam");
    const interleaved: number[] = [];
    for (let i = 0; i < 6; i++) {
      take(cosmetic, i + 1);
      interleaved.push(combat.next());
    }

    expect(interleaved).toEqual(alone);
  });

  it("does not depend on the order streams are created", () => {
    const first = new RandomEngine("order");
    const a1 = first.stream("a");
    const b1 = first.stream("b");
    const second = new RandomEngine("order");
    const b2 = second.stream("b");
    const a2 = second.stream("a");

    expect([take(a1, 4), take(b1, 4)]).toEqual([take(a2, 4), take(b2, 4)]);
  });

  it("gives a cosmetic stream values distinct from an authoritative one", () => {
    const engine = new RandomEngine("distinct");
    expect(take(engine.stream("cosmetic:x"), 4)).not.toEqual(take(engine.stream("combat:x"), 4));
  });

  it("discards a cosmetic stream without touching the ledger hash", () => {
    const ledger = new RandomLedger();
    const before = ledger.hash();
    take(new RandomEngine("ledger").stream("cosmetic:x"), 10);
    expect(ledger.hash()).toBe(before);
  });
});
