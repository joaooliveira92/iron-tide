//packages/combat/src/torpedoes/compatibility.ts
// DESIGN-40 §4 platform compatibility: a torpedo model may be installed only when
// diameter fits, mass is within launcher + handling limits, propulsion/safety is
// supported, fire control supports the model, platform technology/adoption
// passes, inventory is available, and treaty/scenario restrictions permit. A
// supply or administrative action MUST NOT bypass mechanical compatibility
// (assertMechanicalCompatibility / administrativeInstall fail closed). A newer
// model that exceeds mount mass or handling limits requires a validated refit
// under DESIGN-23 — the refit mechanic is DEFERRED to the supply/DESIGN-23
// track (recorded, not implemented here); the verdict surfaces requiresRefit.
// Pure/deterministic: fixed predicate evaluation, no ambient I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import type { CompiledTorpedo } from "@bluewave/armament";
import { TORPEDO_MOUNT_TYPES, type TorpedoMountType } from "./constants.js";
import type { TorpedoLauncherDefinition } from "./launcher.js";
import { TORPEDO_MODEL_INCOMPATIBLE } from "./reasonCodes.js";

// The §4 compatibility predicates, in DESIGN-40 §4 declaration order, plus the
// §1/§2 launcher-family membership gate (a model may only be installed into a
// launcher whose mount type the model declares in its compiled launch types).
export type TorpedoCompatibilityPredicate =
  | "launcherFamily"
  | "diameter"
  | "mass"
  | "propulsionAndSafety"
  | "fireControl"
  | "platformTechnologyAndAdoption"
  | "inventoryAvailable"
  | "treatyOrScenario";

// The mechanical predicates a supply/administrative action can never bypass.
// launcherFamily is mechanical: a family mismatch is a physical non-fit that no
// supply/administrative action may waive.
export const MECHANICAL_COMPATIBILITY_PREDICATES: readonly TorpedoCompatibilityPredicate[] = [
  "launcherFamily",
  "diameter",
  "mass",
  "propulsionAndSafety",
  "fireControl",
  "platformTechnologyAndAdoption",
];

// Platform-side capability/inventory/adoption surface consulted by §4.
export interface TorpedoPlatformCapabilities {
  technologyPrerequisiteIds: readonly string[]; // technology prerequisites the platform satisfies
  adoptedModelIds: readonly string[]; // torpedo models the platform has adopted
  treatyOrScenarioRestrictedModelIds: readonly string[]; // models restricted by treaty/scenario
  availableInventoryModelIds: readonly string[]; // inventory available for install/load
}

export interface TorpedoCompatibilityVerdict {
  compatible: boolean;
  predicateResults: Record<TorpedoCompatibilityPredicate, boolean>;
  /** DESIGN-23 refit required: a newer/heavier model exceeds mount mass or
   *  handling limits. The refit mechanic is deferred to the supply/DESIGN-23
   *  track (recorded, never fabricated here). */
  requiresRefit: boolean;
}

// F2: the launcher's mount type must be one of the mount types the compiled torpedo declares
// (§2 launcher mount type × the part's `launchTypes`, derived from the retired launcher-family
// suffix set). A model that never declares the launcher's mount type
// fails closed — e.g. the G7e (ABOVE_WATER_TRAINABLE / SUBMARINE_INTERNAL) can never be installed
// into an UNDERWATER_TRAINABLE launcher.
export function launcherFamilyMatches(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
): boolean {
  return launcherFamilyMatchesTorpedo(torpedo, launcher.launcherFamilyId);
}

/** The mount type named by a launcher-family id (`14in_above_water_fixed` → `ABOVE_WATER_FIXED`). */
export function mountTypeOfLauncherFamilyId(familyId: string): TorpedoMountType | undefined {
  for (const mountType of TORPEDO_MOUNT_TYPES) {
    const suffix = mountType.toLowerCase();
    if (familyId === suffix || familyId.endsWith(`_${suffix}`)) return mountType;
  }
  return undefined;
}

/** The physical diameter (µm) a launcher-family id's prefix names (`14in` / `533mm` / `61cm`). */
function familyDiameterUm(familyId: string, mountType: TorpedoMountType): number | undefined {
  const prefix = familyId.slice(0, familyId.length - (mountType.toLowerCase().length + 1));
  const value = Number.parseInt(prefix, 10);
  if (!Number.isInteger(value) || value <= 0) return undefined;
  if (prefix.endsWith("mm")) return value * 1_000;
  if (prefix.endsWith("cm")) return value * 10_000;
  if (prefix.endsWith("in")) return value * 25_400;
  return undefined;
}

/**
 * The compiled-torpedo form of the launcher-family membership gate: the family id's mount type
 * must be one of the torpedo's `launchTypes`, and the family's physical diameter prefix must match
 * the torpedo's diameter. This reconstructs the retired exact family-id membership from the
 * neutral `launchTypes` + `diameterUm`; a unit-label difference (`21in` vs `533mm`) is not
 * distinguishable and is treated as a match (the physical diameter is what the family encodes).
 */
export function launcherFamilyMatchesTorpedo(torpedo: CompiledTorpedo, familyId: string): boolean {
  const mountType = mountTypeOfLauncherFamilyId(familyId);
  if (mountType === undefined) return false;
  if (!(torpedo.launchTypes as readonly string[]).includes(mountType)) return false;
  const familyDiameter = familyDiameterUm(familyId, mountType);
  if (familyDiameter === undefined) return false;
  return Math.round(familyDiameter / 1_000) === Math.round(torpedo.diameterUm / 1_000);
}

export function diameterFitsLauncher(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
): boolean {
  return torpedo.diameterUm <= launcher.boreDiameterMm * 1_000;
}

export function massWithinLimits(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
): boolean {
  return torpedo.massKg <= launcher.handlingMassLimitKg;
}

export function propulsionAndSafetySupported(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
): boolean {
  return (launcher.supportedPropulsionTypes as readonly string[]).includes(torpedo.propulsionType);
}

export function fireControlSupportsModel(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
): boolean {
  return (launcher.fireControlSupportedGuidance as readonly string[]).includes(
    torpedo.guidanceCapability,
  );
}

export function platformTechnologyAndAdoption(
  torpedo: CompiledTorpedo,
  platform: TorpedoPlatformCapabilities,
): boolean {
  const techSupported = torpedo.technologyPrerequisiteIds.every((prereq) =>
    (platform.technologyPrerequisiteIds as readonly string[]).includes(prereq),
  );
  const adopted = (platform.adoptedModelIds as readonly string[]).includes(torpedo.partId);
  return techSupported && adopted;
}

export function inventoryAvailable(
  torpedo: CompiledTorpedo,
  platform: TorpedoPlatformCapabilities,
): boolean {
  return (platform.availableInventoryModelIds as readonly string[]).includes(torpedo.partId);
}

export function treatyOrScenarioPermits(
  torpedo: CompiledTorpedo,
  platform: TorpedoPlatformCapabilities,
): boolean {
  return !(platform.treatyOrScenarioRestrictedModelIds as readonly string[]).includes(
    torpedo.partId,
  );
}

// AC-4: full §4 verdict — every predicate evaluated, compatible = AND of all
// eight (incl. the launcher-family membership gate); requiresRefit surfaces
// when the model exceeds mass/handling limits (DESIGN-23 refit recorded as
// deferred).
export function evaluateInstallCompatibility(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
  platform: TorpedoPlatformCapabilities,
): TorpedoCompatibilityVerdict {
  const predicateResults: Record<TorpedoCompatibilityPredicate, boolean> = {
    launcherFamily: launcherFamilyMatches(torpedo, launcher),
    diameter: diameterFitsLauncher(torpedo, launcher),
    mass: massWithinLimits(torpedo, launcher),
    propulsionAndSafety: propulsionAndSafetySupported(torpedo, launcher),
    fireControl: fireControlSupportsModel(torpedo, launcher),
    platformTechnologyAndAdoption: platformTechnologyAndAdoption(torpedo, platform),
    inventoryAvailable: inventoryAvailable(torpedo, platform),
    treatyOrScenario: treatyOrScenarioPermits(torpedo, platform),
  };
  const compatible = (Object.keys(predicateResults) as TorpedoCompatibilityPredicate[]).every(
    (p) => predicateResults[p],
  );
  return {
    compatible,
    predicateResults,
    requiresRefit: !predicateResults.mass,
  };
}

// AC-4: install-only-when-every-predicate-passes boolean.
export function canInstallTorpedo(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
  platform: TorpedoPlatformCapabilities,
): boolean {
  return evaluateInstallCompatibility(torpedo, launcher, platform).compatible;
}

function incompatible(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
  failing: readonly TorpedoCompatibilityPredicate[],
): never {
  throw new BluewaveError(TORPEDO_MODEL_INCOMPATIBLE, {
    code: TORPEDO_MODEL_INCOMPATIBLE,
    reason: "torpedo model is not mechanically compatible with this launcher",
    modelId: torpedo.partId,
    launcherFamilyId: launcher.launcherFamilyId,
    failingPredicates: [...failing],
  });
}

// AC-4: the mechanical-compatibility guard a supply/administrative action MUST
// pass. Mechanical predicates (diameter/mass/propulsion+fire-control/platform
// tech) are never bypassable — inventory and treaty clearance are the only
// predicates a supply/administrative action may legitimately waive. Fails
// closed with TORPEDO_MODEL_INCOMPATIBLE + the failing predicates.
export function assertMechanicalCompatibility(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
  platform: TorpedoPlatformCapabilities,
): void {
  const verdict = evaluateInstallCompatibility(torpedo, launcher, platform);
  const failing = MECHANICAL_COMPATIBILITY_PREDICATES.filter((p) => !verdict.predicateResults[p]);
  if (failing.length > 0) incompatible(torpedo, launcher, failing);
}

// AC-4: a supply/administrative action installs a torpedo into a launcher. By
// its nature the action carries inventory + treaty clearance, but it MUST NOT
// bypass mechanical compatibility — the mechanical guard runs first and fails
// closed. Returns the mechanical verdict on success.
export function administrativeInstall(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
  platform: TorpedoPlatformCapabilities,
): TorpedoCompatibilityVerdict {
  assertMechanicalCompatibility(torpedo, launcher, platform);
  const mechanical = evaluateInstallCompatibility(torpedo, launcher, platform).predicateResults;
  return {
    compatible: true,
    predicateResults: {
      launcherFamily: mechanical.launcherFamily,
      diameter: mechanical.diameter,
      mass: mechanical.mass,
      propulsionAndSafety: mechanical.propulsionAndSafety,
      fireControl: mechanical.fireControl,
      platformTechnologyAndAdoption: mechanical.platformTechnologyAndAdoption,
      // inventory + treaty are guaranteed by the supply/administrative action;
      // mechanical compatibility is enforced above and never bypassed.
      inventoryAvailable: true,
      treatyOrScenario: true,
    },
    requiresRefit: false,
  };
}
