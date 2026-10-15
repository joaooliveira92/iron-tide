// AC-4: platform compatibility (DESIGN-40 §4) — every predicate (diameter,
// mass, propulsion/safety, fire control, platform tech/adoption, inventory,
// treaty/scenario); install only when all pass; a supply/administrative action
// MUST NOT bypass mechanical compatibility (fails closed with
// TORPEDO_MODEL_INCOMPATIBLE); a heavier newer model beyond mass/handling
// limits requires a DESIGN-23 refit (recorded as deferred — surfaced via
// verdict.requiresRefit, never fabricated).
import { describe, expect, it } from "vite-plus/test";
import { BluewaveError } from "@bluewave/contracts";
import {
  administrativeInstall,
  assertMechanicalCompatibility,
  canInstallTorpedo,
  diameterFitsLauncher,
  evaluateInstallCompatibility,
  fireControlSupportsModel,
  inventoryAvailable,
  launcherFamilyMatches,
  massWithinLimits,
  platformTechnologyAndAdoption,
  propulsionAndSafetySupported,
  TORPEDO_MODEL_INCOMPATIBLE,
  treatyOrScenarioPermits,
  type TorpedoLauncherDefinition,
  type TorpedoPlatformCapabilities,
} from "../../src/torpedoes/index.js";
import { compiledTorpedoOf, withCompiledTorpedo } from "../fixtures/compiledTorpedoes.js";

const G7A = "ger_533mm_g7a_1934";
const G7E = "ger_533mm_g7e_1936";

function launcher533(
  overrides: Partial<TorpedoLauncherDefinition> = {},
): TorpedoLauncherDefinition {
  return {
    launcherFamilyId: "533mm_underwater_trainable",
    mountType: "UNDERWATER_TRAINABLE",
    tubeCount: 4,
    boreDiameterMm: 533,
    handlingMassLimitKg: 1_600,
    supportedPropulsionTypes: ["WET_HEATER", "ELECTRIC"],
    fireControlSupportedGuidance: ["gyro"],
    underwaterLaunchCapability: true,
    requiredReloadTimeMs: 120_000,
    aboveWaterMaxLaunchSpeedKnots: null,
    ...overrides,
  };
}

function platform(
  overrides: Partial<TorpedoPlatformCapabilities> = {},
): TorpedoPlatformCapabilities {
  return {
    technologyPrerequisiteIds: ["wet_heater_engine", "electric_propulsion"],
    adoptedModelIds: [G7A, G7E],
    treatyOrScenarioRestrictedModelIds: [],
    availableInventoryModelIds: [G7A, G7E],
    ...overrides,
  };
}

function heavyG7a(massKg: number) {
  return withCompiledTorpedo(compiledTorpedoOf(G7A), { massKg });
}

describe("AC-4: §4 predicates evaluate individually", () => {
  it("diameter fits only when the model diameter does not exceed the bore", () => {
    const type93 = compiledTorpedoOf("jpn_61cm_type93_1935"); // 610 mm
    const l = launcher533({
      boreDiameterMm: 533,
      handlingMassLimitKg: 3_000,
      supportedPropulsionTypes: ["WET_HEATER", "ELECTRIC", "OXYGEN"],
      fireControlSupportedGuidance: ["gyro"],
    });
    const p = platform({
      technologyPrerequisiteIds: ["wet_heater_engine", "electric_propulsion", "oxygen_propulsion"],
      adoptedModelIds: [G7A, G7E, "jpn_61cm_type93_1935"],
      availableInventoryModelIds: [G7A, G7E, "jpn_61cm_type93_1935"],
    });
    expect(diameterFitsLauncher(type93, l)).toBe(false);
    expect(diameterFitsLauncher(compiledTorpedoOf(G7A), l)).toBe(true);
    const verdict = evaluateInstallCompatibility(type93, l, p);
    expect(verdict.compatible).toBe(false);
    expect(verdict.predicateResults.diameter).toBe(false);
    expect(verdict.predicateResults.mass).toBe(true);
  });

  it("mass fails when the model exceeds launcher + handling limits (requires refit)", () => {
    const overMass = heavyG7a(2_000); // handling limit is 1_600 kg
    const l = launcher533();
    expect(massWithinLimits(overMass, l)).toBe(false);
    const verdict = evaluateInstallCompatibility(overMass, l, platform());
    expect(verdict.compatible).toBe(false);
    expect(verdict.predicateResults.mass).toBe(false);
    // DESIGN-23 refit required — recorded as deferred, surfaced not fabricated
    expect(verdict.requiresRefit).toBe(true);
  });

  it("propulsion/safety fails when the launcher does not support the propulsion type", () => {
    const g7e = compiledTorpedoOf(G7E); // ELECTRIC
    const l = launcher533({ supportedPropulsionTypes: ["WET_HEATER"] });
    expect(propulsionAndSafetySupported(g7e, l)).toBe(false);
    expect(propulsionAndSafetySupported(compiledTorpedoOf(G7A), l)).toBe(true);
    expect(
      evaluateInstallCompatibility(g7e, l, platform()).predicateResults.propulsionAndSafety,
    ).toBe(false);
  });

  it("fire control fails when it does not support the model's guidance capability", () => {
    const g7a = compiledTorpedoOf(G7A);
    const l = launcher533({ fireControlSupportedGuidance: ["gyro"] });
    expect(fireControlSupportsModel(g7a, l)).toBe(true);
    const acoustic = withCompiledTorpedo(g7a, {
      partId: "ger_533mm_g7a_acoustic",
      guidanceCapability: "acoustic",
    });
    expect(fireControlSupportsModel(acoustic, l)).toBe(false);
  });

  it("platform technology + adoption fails on an unsatisfied prerequisite or non-adopted model", () => {
    const g7a = compiledTorpedoOf(G7A); // requires wet_heater_engine
    expect(platformTechnologyAndAdoption(g7a, platform())).toBe(true);
    expect(
      platformTechnologyAndAdoption(
        g7a,
        platform({ technologyPrerequisiteIds: ["electric_propulsion"] }),
      ),
    ).toBe(false);
    expect(platformTechnologyAndAdoption(g7a, platform({ adoptedModelIds: [G7E] }))).toBe(false);
  });

  it("inventory + treaty predicates gate installation", () => {
    const g7a = compiledTorpedoOf(G7A);
    expect(inventoryAvailable(g7a, platform())).toBe(true);
    expect(inventoryAvailable(g7a, platform({ availableInventoryModelIds: [G7E] }))).toBe(false);
    expect(treatyOrScenarioPermits(g7a, platform())).toBe(true);
    expect(
      treatyOrScenarioPermits(g7a, platform({ treatyOrScenarioRestrictedModelIds: [G7A] })),
    ).toBe(false);
  });
});

describe("F2: launcher-family membership is enforced (launcherFamilyId must be declared compatible by the model)", () => {
  it("rejects a G7e install into a 533mm_underwater_trainable launcher the model never declares (TORPEDO_MODEL_INCOMPATIBLE)", () => {
    const g7e = compiledTorpedoOf(G7E); // families: 533mm_above_water_trainable, 533mm_submarine_internal
    const l = launcher533({
      launcherFamilyId: "533mm_underwater_trainable", // NOT in G7e's compatible families
      supportedPropulsionTypes: ["WET_HEATER", "ELECTRIC"],
    });
    const p = platform({ adoptedModelIds: [G7A, G7E], availableInventoryModelIds: [G7A, G7E] });

    expect(launcherFamilyMatches(g7e, l)).toBe(false);
    const verdict = evaluateInstallCompatibility(g7e, l, p);
    expect(verdict.compatible).toBe(false);
    expect(verdict.predicateResults.launcherFamily).toBe(false);
    // propulsion/safety passes here — the family gate is the ONLY failure, so the
    // predicate is proven to matter on its own
    expect(verdict.predicateResults.propulsionAndSafety).toBe(true);
    expect(verdict.predicateResults.fireControl).toBe(true);
    expect(verdict.predicateResults.platformTechnologyAndAdoption).toBe(true);
    expect(canInstallTorpedo(g7e, l, p)).toBe(false);
    // a supply/administrative action cannot bypass the family mismatch
    expect(() => assertMechanicalCompatibility(g7e, l, p)).toThrow(BluewaveError);
    expect(() => administrativeInstall(g7e, l, p)).toThrow(BluewaveError);
  });

  it("accepts the model when the launcher family IS declared compatible", () => {
    const g7e = compiledTorpedoOf(G7E);
    const l = launcher533({
      launcherFamilyId: "533mm_submarine_internal", // declared by G7e
      supportedPropulsionTypes: ["WET_HEATER", "ELECTRIC"],
      handlingMassLimitKg: 1_700, // G7e is 1_603 kg — isolate the family gate
    });
    const p = platform({ adoptedModelIds: [G7A, G7E], availableInventoryModelIds: [G7A, G7E] });
    expect(launcherFamilyMatches(g7e, l)).toBe(true);
    expect(canInstallTorpedo(g7e, l, p)).toBe(true);
  });

  it("re-expresses membership as mount type + physical bore (ticket 13b, ADR-0157 §13b)", () => {
    // The neutral CompiledTorpedo carries DESIGN-40 §2 mount types + the physical diameter; the
    // retired exact `compatibleLauncherFamilyIds` string set is re-expressed as mount type + physical
    // bore. A 21-in (533 mm) model therefore matches a `533mm_...` launcher of a declared mount type
    // — the two labels name the same physical bore. An undeclared mount type or a different bore
    // still fails closed.
    const mkIv = compiledTorpedoOf("rn_21in_mk_iv_1916"); // 533 mm; declares UNDERWATER_FIXED,
    // UNDERWATER_TRAINABLE, ABOVE_WATER_TRAINABLE
    expect(
      launcherFamilyMatches(mkIv, launcher533({ launcherFamilyId: "533mm_above_water_trainable" })),
    ).toBe(true);
    expect(
      launcherFamilyMatches(mkIv, launcher533({ launcherFamilyId: "533mm_underwater_trainable" })),
    ).toBe(true);
    // A mount type the model never declares still fails closed.
    expect(
      launcherFamilyMatches(mkIv, launcher533({ launcherFamilyId: "533mm_submarine_internal" })),
    ).toBe(false);
    // A different physical bore never matches.
    expect(
      launcherFamilyMatches(mkIv, launcher533({ launcherFamilyId: "610mm_above_water_trainable" })),
    ).toBe(false);
  });
});

describe("AC-4: install only when EVERY §4 predicate passes", () => {
  it("a fully-compatible model installs (all predicates pass)", () => {
    const g7a = compiledTorpedoOf(G7A);
    const verdict = evaluateInstallCompatibility(g7a, launcher533(), platform());
    expect(verdict.compatible).toBe(true);
    for (const result of Object.values(verdict.predicateResults)) {
      expect(result).toBe(true);
    }
    expect(canInstallTorpedo(g7a, launcher533(), platform())).toBe(true);
  });

  it("an incompatible model fails the full AND", () => {
    const g7e = compiledTorpedoOf(G7E);
    const l = launcher533({ supportedPropulsionTypes: ["WET_HEATER"] });
    expect(canInstallTorpedo(g7e, l, platform())).toBe(false);
  });
});

describe("AC-4: a supply/administrative action must NOT bypass mechanical compatibility", () => {
  it("rejects an over-mass model in inventory (TORPEDO_MODEL_INCOMPATIBLE, no bypass)", () => {
    const overMass = heavyG7a(2_000);
    // inventory contains the model — an administrative action still fails on mass
    const p = platform({ availableInventoryModelIds: [G7A, G7E] });
    let err: BluewaveError | undefined;
    try {
      assertMechanicalCompatibility(overMass, launcher533(), p);
    } catch (e) {
      err = e as BluewaveError;
    }
    expect(err).toBeDefined();
    expect(err!.message).toBe(TORPEDO_MODEL_INCOMPATIBLE);
    expect(err!.context.failingPredicates).toContain("mass");
    expect(() => administrativeInstall(overMass, launcher533(), p)).toThrow(BluewaveError);
  });

  it("rejects a wrong-diameter model even when supply guarantees inventory", () => {
    const type93 = compiledTorpedoOf("jpn_61cm_type93_1935"); // 610 mm
    const p = platform({
      technologyPrerequisiteIds: ["wet_heater_engine", "electric_propulsion", "oxygen_propulsion"],
      adoptedModelIds: [G7A, G7E, "jpn_61cm_type93_1935"],
      availableInventoryModelIds: [G7A, G7E, "jpn_61cm_type93_1935"],
    });
    const l = launcher533({
      boreDiameterMm: 533,
      handlingMassLimitKg: 3_000,
      supportedPropulsionTypes: ["WET_HEATER", "ELECTRIC", "OXYGEN"],
    });
    expect(() => administrativeInstall(type93, l, p)).toThrow(BluewaveError);
  });

  it("rejects an unsupported-propulsion model even when inventory holds it", () => {
    const g7e = compiledTorpedoOf(G7E);
    const l = launcher533({ supportedPropulsionTypes: ["WET_HEATER"] });
    expect(() => administrativeInstall(g7e, l, platform())).toThrow(BluewaveError);
  });

  it("an administratively-cleared mechanically-compatible model installs (inventory/treaty waived, mechanical enforced)", () => {
    const g7a = compiledTorpedoOf(G7A);
    // inventory empty + treaty-restricted — the administrative action carries
    // clearance, but mechanical compatibility is still fully enforced.
    const p = platform({
      availableInventoryModelIds: [],
      treatyOrScenarioRestrictedModelIds: [G7A],
    });
    expect(() => assertMechanicalCompatibility(g7a, launcher533(), p)).not.toThrow();
    const verdict = administrativeInstall(g7a, launcher533(), p);
    expect(verdict.compatible).toBe(true);
    expect(verdict.predicateResults.diameter).toBe(true);
    expect(verdict.predicateResults.mass).toBe(true);
    expect(verdict.predicateResults.propulsionAndSafety).toBe(true);
    expect(verdict.predicateResults.fireControl).toBe(true);
    expect(verdict.predicateResults.platformTechnologyAndAdoption).toBe(true);
  });
});
