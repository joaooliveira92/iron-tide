import { describe, expect, it } from "vite-plus/test";
import {
  compileDesign,
  nationHasArmamentContent,
  toEngineDesign,
  type CompiledDesign,
  type EngineAdapterOptions,
  type StarterDesign,
} from "../src/index.js";
import { type EngineDesignFields } from "../src/engineAdapter.js";
import { armamentContent, nationalContext, shipBuildingContent } from "./helpers/earlyContext.js";

const OPENING_MONTH = "1880-01";

const profiledNations = shipBuildingContent.navalProfiles.map((p) => p.nationId);
const openingStarters: readonly StarterDesign[] = shipBuildingContent.starterDesigns.filter(
  (s) => s.month === OPENING_MONTH,
);

function engineOptions(id: string): EngineAdapterOptions {
  return {
    designVersionId: `dv_${id}`,
    designFamilyId: `fam_${id}`,
    className: id,
    hullType: "battleship",
    machineryType: "steam_triple_expansion",
    contentVersion: "test_v1",
    kgPerHitPoint: 4_000,
  };
}

function compileOnce(s: StarterDesign): () => CompiledDesign {
  let cached: CompiledDesign | undefined;
  return () => (cached ??= compileDesign(s.draft, nationalContext(s.month, s.draft.nationId)));
}

function adaptOnce(s: StarterDesign, compiled: CompiledDesign): () => EngineDesignFields {
  let cached: EngineDesignFields | undefined;
  return () => (cached ??= toEngineDesign(compiled, s.draft, engineOptions(s.id)));
}

function blockingIds(compiled: CompiledDesign): string {
  return compiled.findings
    .filter((f) => f.severity === "BLOCKING")
    .map((f) => f.id)
    .join(", ");
}

describe("opening-starter armament coverage (release gate)", () => {
  it("loads opening starters spanning every profiled production nation", () => {
    expect(
      profiledNations.length,
      "no production naval profiles loaded: the 1880 release scenario did not parse",
    ).toBeGreaterThan(0);
    expect(
      openingStarters.length,
      "no 1880-01 opening starters loaded: reference designs did not parse",
    ).toBeGreaterThan(0);

    const starterNations = new Set(openingStarters.map((s) => s.draft.nationId));
    for (const nationId of profiledNations) {
      expect(
        starterNations.has(nationId),
        `nation '${nationId}' has a naval profile but no 1880-01 opening starter`,
      ).toBe(true);
    }
    const profiled = new Set(profiledNations);
    for (const nationId of starterNations) {
      expect(
        profiled.has(nationId),
        `opening starters exist for '${nationId}', which has no production naval profile`,
      ).toBe(true);
    }
  });

  it("compiles and adapts every opening starter with no blocking finding", () => {
    expect(openingStarters.length, "no opening starters to verify").toBeGreaterThan(0);
    for (const s of openingStarters) {
      const context = `${s.id} (${s.draft.nationId})`;
      const compile = compileOnce(s);
      expect(compile, `${context}: compileDesign must not throw`).not.toThrow();
      const compiled = compile();
      expect(
        compiled.findings.some((f) => f.severity === "BLOCKING"),
        `${context}: blocking finding(s): ${blockingIds(compiled)}`,
      ).toBe(false);
      expect(compiled.valid, `${context}: a blocking finding made the design invalid`).toBe(true);

      const adapt = adaptOnce(s, compiled);
      expect(adapt, `${context}: toEngineDesign must not throw`).not.toThrow();
      const engine = adapt();
      expect(engine.compiledHash, context).toBe(compiled.hash);
    }
  });

  it("uses the authored armament path where present and the legacy compatibility path elsewhere", () => {
    expect(openingStarters.length, "no opening starters to verify").toBeGreaterThan(0);
    let authoredStarters = 0;
    let legacyStarters = 0;
    for (const s of openingStarters) {
      const context = `${s.id} (${s.draft.nationId})`;
      const compiled = compileOnce(s)();
      const authored = nationHasArmamentContent(armamentContent, s.draft.nationId);
      const gunners = compiled.components.filter((c) => c.armament !== undefined);
      if (authored) {
        authoredStarters++;
        expect(
          gunners.length,
          `${context}: nation has authored armament but no compiled component carried it`,
        ).toBeGreaterThan(0);
        expect(adaptOnce(s, compiled)().armament, context).toBeDefined();
      } else {
        legacyStarters++;
        expect(
          compiled.components.every((c) => c.armament === undefined),
          `${context}: nation has no authored armament, so every component must take the legacy path`,
        ).toBe(true);
        expect(adaptOnce(s, compiled)().armament, context).toBeUndefined();
      }
    }
    expect(
      authoredStarters,
      "no opening starter exercised the authored armament path",
    ).toBeGreaterThan(0);
    expect(
      legacyStarters,
      "no opening starter exercised the legacy compatibility path",
    ).toBeGreaterThan(0);
  });
});
