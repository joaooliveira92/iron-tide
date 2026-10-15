import { sha256 } from "@noble/hashes/sha2.js";

export interface CanonicalEnvelope {
  algorithm: string;
  artifactKind: string;
  compatibilityVersion: string;
  bodyHash: string;
  bodyLength: number;
}

/**
 * Codepoint string comparison — the repository's determinism rule for canonical
 * ordering (never `localeCompare`, which depends on the host locale). Equivalent
 * to the `byId`/`compareStrings` comparators used across the combat and campaign
 * orderings, hoisted so the rule has one home. Compares by UTF-16 code unit via
 * the `<`/`>` operators.
 */
export function compareCodePoints(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function canonicalSerialize(value: unknown): string {
  return JSON.stringify(value, stableKeySort, 0);
}

function stableKeySort(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value).sort();
    const sorted: Record<string, unknown> = {};
    for (const k of keys) {
      sorted[k] = (value as Record<string, unknown>)[k as keyof Record<string, unknown>];
    }
    return sorted;
  }
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        const keys = Object.keys(item as Record<string, unknown>).sort();
        const sorted: Record<string, unknown> = {};
        for (const k of keys) {
          sorted[k] = (item as Record<string, unknown>)[k as keyof Record<string, unknown>];
        }
        return sorted;
      }
      return item;
    });
  }
  return value;
}

function bytes(data: string): Uint8Array {
  return new TextEncoder().encode(data);
}

function hex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += b.toString(16).padStart(2, "0");
  }
  return out;
}

export function sha256Hex(data: string): string {
  return hex(sha256(bytes(data)));
}

export function createEnvelope(
  artifactKind: string,
  compatibilityVersion: string,
  body: unknown,
): CanonicalEnvelope {
  const bodyJson = canonicalSerialize(body);
  const bodyHash = sha256Hex(bodyJson);
  return {
    algorithm: "sha256",
    artifactKind,
    compatibilityVersion,
    bodyHash,
    bodyLength: bytes(bodyJson).length,
  };
}

export function verifyEnvelope(envelope: CanonicalEnvelope, body: unknown): boolean {
  const bodyJson = canonicalSerialize(body);
  const computedHash = sha256Hex(bodyJson);
  return computedHash === envelope.bodyHash && bytes(bodyJson).length === envelope.bodyLength;
}

export function hashWithContext(data: string, context: string): string {
  const ctx = new TextEncoder().encode(context + "\0" + data);
  return hex(sha256(ctx));
}

export { integerRoot, powRational } from "./fixedMath.js";
