import { describe, expect, it } from "vite-plus/test";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { planFromLegacy } from "../src/index.js";
import { components, legacySource } from "./helpers/production.js";
import type { LegacySource } from "../src/types.js";

const planOnce = () => {
  const result = planFromLegacy(legacySource);
  if (!result.ok) throw new Error(JSON.stringify(result.failures));
  return result.value;
};

const permute = (seed: number): LegacySource => {
  const rotate = <T>(list: readonly T[]): T[] => {
    if (list.length === 0) return [];
    const n = seed % list.length;
    return [...list.slice(n), ...list.slice(0, n)];
  };
  return {
    ...legacySource,
    components: rotate([...components].reverse()),
    profiles: rotate([...legacySource.profiles]),
    designs: rotate([...legacySource.designs].reverse()),
    hullForms: rotate([...legacySource.hullForms]),
    armament: {
      gunFamilies: rotate([...legacySource.armament.gunFamilies]),
      gunModels: rotate([...legacySource.armament.gunModels].reverse()),
      gunMounts: rotate([...legacySource.armament.gunMounts]),
      ammunition: rotate([...legacySource.armament.ammunition].reverse()),
    },
  };
};

describe("content codemod determinism (ticket 11c)", () => {
  it("is byte-identical across runs in one process", () => {
    const a = planOnce();
    const b = planOnce();
    expect(a.contentHash).toBe(b.contentHash);
    expect(canonicalSerialize(a.files)).toBe(canonicalSerialize(b.files));
  });

  it("is unaffected by input enumeration order (property: several permutations)", () => {
    const base = planOnce();
    for (const seed of [1, 3, 5, 7, 11]) {
      const shuffled = planFromLegacy(permute(seed));
      expect(shuffled.ok, `permutation ${String(seed)}`).toBe(true);
      if (shuffled.ok) {
        expect(shuffled.value.contentHash, `permutation ${String(seed)}`).toBe(base.contentHash);
        expect(canonicalSerialize(shuffled.value.files)).toBe(canonicalSerialize(base.files));
      }
    }
  });

  it(`has a stable tree hash for cross-process comparison (CODEMOD_TREE_SHA256 ${sha256Hex(
    canonicalSerialize(planOnce().manifest.content),
  )})`, () => {
    const plan = planOnce();
    const digest = sha256Hex(canonicalSerialize(plan.manifest.content));
    console.log(`CODEMOD_TREE_SHA256 ${digest}`);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
  });
});
