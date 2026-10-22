import { describe, expect, it } from "vite-plus/test";
import { generateCandidates } from "../src/index.js";
import { resolvableWeaponFamilies } from "../src/armamentCompile.js";
import { WEAPON_CATEGORIES } from "../src/compileShared.js";
import { shipBuildingContent } from "./helpers/earlyContext.js";

const ukStarter = shipBuildingContent.starterDesigns.find(
  (s) => s.draft.nationId === "uk" && s.month === "1880-01",
)!;

describe("candidate generation selects only resolvable armament (ADR-0093 Step 3)", () => {
  it("never installs a gun whose family does not resolve for the nation", () => {
    const env = shipBuildingContent.aiEnvironmentFor("1880-01", "uk");
    const resolvable = resolvableWeaponFamilies(env.ctx, "uk");
    expect(resolvable).not.toBeNull();
    const result = generateCandidates(env, {
      base: ukStarter.draft,
      seed: "armament-candidates",
      nationKey: "uk",
      candidates: 4,
      compilesPerArchetype: 60,
    });
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const c of result.candidates) {
      expect(c.compiled.valid).toBe(true);
      for (const comp of c.compiled.components) {
        if (!WEAPON_CATEGORIES.includes(comp.category)) continue;
        expect(resolvable!.has(comp.componentId), `${c.compiled.hash}:${comp.componentId}`).toBe(
          true,
        );
        expect(comp.armament).toBeDefined();
      }
    }
  });

  it("is deterministic for the same seed", () => {
    const env = shipBuildingContent.aiEnvironmentFor("1880-01", "uk");
    const run = () =>
      generateCandidates(env, {
        base: ukStarter.draft,
        seed: "armament-determinism",
        nationKey: "uk",
        candidates: 3,
        compilesPerArchetype: 40,
      });
    const a = run();
    const b = run();
    expect(a.candidates.map((c) => c.compiled.hash)).toEqual(
      b.candidates.map((c) => c.compiled.hash),
    );
  });
});
