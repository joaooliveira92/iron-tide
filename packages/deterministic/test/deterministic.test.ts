import { describe, it, expect } from "vite-plus/test";
import {
  canonicalSerialize,
  sha256Hex,
  createEnvelope,
  verifyEnvelope,
  hashWithContext,
  compareCodePoints,
} from "../src/index.js";

describe("canonicalSerialize", () => {
  it("serializes simple objects with sorted keys", () => {
    const result = canonicalSerialize({ b: 2, a: 1, c: 3 });
    expect(result).toBe('{"a":1,"b":2,"c":3}');
  });

  it("serializes nested objects with sorted keys", () => {
    const result = canonicalSerialize({ z: { b: 2, a: 1 }, y: 0 });
    expect(result).toBe('{"y":0,"z":{"a":1,"b":2}}');
  });

  it("produces deterministic output regardless of input key order", () => {
    const a = canonicalSerialize({ b: 1, a: 2 });
    const b = canonicalSerialize({ a: 2, b: 1 });
    expect(a).toBe(b);
  });

  it("serializes arrays maintaining element order", () => {
    const result = canonicalSerialize([3, 1, 2]);
    expect(result).toBe("[3,1,2]");
  });
});

describe("sha256Hex", () => {
  it("produces a 64-character hex string", () => {
    const hash = sha256Hex("test");
    expect(hash).toHaveLength(64);
    expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
  });

  it("is deterministic", () => {
    expect(sha256Hex("hello")).toBe(sha256Hex("hello"));
  });

  it("differs for different inputs", () => {
    expect(sha256Hex("hello")).not.toBe(sha256Hex("world"));
  });
});

describe("createEnvelope", () => {
  it("creates envelope with correct structure", () => {
    const envelope = createEnvelope("test-pack", "1.0", { data: "hello" });
    expect(envelope.algorithm).toBe("sha256");
    expect(envelope.artifactKind).toBe("test-pack");
    expect(envelope.compatibilityVersion).toBe("1.0");
    expect(envelope.bodyHash).toHaveLength(64);
    expect(envelope.bodyLength).toBeGreaterThan(0);
  });
});

describe("verifyEnvelope", () => {
  it("verifies valid envelope", () => {
    const body = { data: "hello" };
    const envelope = createEnvelope("test-pack", "1.0", body);
    expect(verifyEnvelope(envelope, body)).toBe(true);
  });

  it("rejects envelope with modified body", () => {
    const envelope = createEnvelope("test-pack", "1.0", { data: "hello" });
    expect(verifyEnvelope(envelope, { data: "world" })).toBe(false);
  });
});

describe("hashWithContext", () => {
  it("produces domain-separated hashes", () => {
    const a = hashWithContext("data", "domain-a");
    const b = hashWithContext("data", "domain-b");
    expect(a).not.toBe(b);
  });
});

describe("compareCodePoints", () => {
  it("orders by codepoint, not by the host locale", () => {
    expect(compareCodePoints("Z", "a")).toBeLessThan(0);
    expect(["Z", "a", "A", "z"].sort(compareCodePoints)).toEqual(["A", "Z", "a", "z"]);
  });

  it("returns 0 for equal strings and breaks ties by length", () => {
    expect(compareCodePoints("abc", "abc")).toBe(0);
    expect(compareCodePoints("ab", "abc")).toBeLessThan(0);
    expect(compareCodePoints("abc", "ab")).toBeGreaterThan(0);
  });
});
