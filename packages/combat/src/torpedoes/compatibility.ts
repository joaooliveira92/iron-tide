import { BluewaveError } from "@bluewave/contracts";
import type { CompiledTorpedo } from "@bluewave/armament";
import { TORPEDO_MOUNT_TYPES, type TorpedoMountType } from "./constants.js";
import type { TorpedoLauncherDefinition } from "./launcher.js";
import { TORPEDO_MODEL_INCOMPATIBLE } from "./reasonCodes.js";

export type TorpedoCompatibilityPredicate =
  | "launcherFamily"
  | "diameter"
  | "mass"
  | "propulsionAndSafety"
  | "fireControl"
  | "platformTechnologyAndAdoption"
  | "inventoryAvailable"
  | "treatyOrScenario";

export const MECHANICAL_COMPATIBILITY_PREDICATES: readonly TorpedoCompatibilityPredicate[] = [
  "launcherFamily",
  "diameter",
  "mass",
  "propulsionAndSafety",
  "fireControl",
  "platformTechnologyAndAdoption",
];

export interface TorpedoPlatformCapabilities {
  technologyPrerequisiteIds: readonly string[];
  adoptedModelIds: readonly string[];
  treatyOrScenarioRestrictedModelIds: readonly string[];
  availableInventoryModelIds: readonly string[];
}

export interface TorpedoCompatibilityVerdict {
  compatible: boolean;
  predicateResults: Record<TorpedoCompatibilityPredicate, boolean>;
  requiresRefit: boolean;
}

export function launcherFamilyMatches(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
): boolean {
  return launcherFamilyMatchesTorpedo(torpedo, launcher.launcherFamilyId);
}

export function mountTypeOfLauncherFamilyId(familyId: string): TorpedoMountType | undefined {
  for (const mountType of TORPEDO_MOUNT_TYPES) {
    const suffix = mountType.toLowerCase();
    if (familyId === suffix || familyId.endsWith(`_${suffix}`)) return mountType;
  }
  return undefined;
}

function familyDiameterUm(familyId: string, mountType: TorpedoMountType): number | undefined {
  const prefix = familyId.slice(0, familyId.length - (mountType.toLowerCase().length + 1));
  const value = Number.parseInt(prefix, 10);
  if (!Number.isInteger(value) || value <= 0) return undefined;
  if (prefix.endsWith("mm")) return value * 1_000;
  if (prefix.endsWith("cm")) return value * 10_000;
  if (prefix.endsWith("in")) return value * 25_400;
  return undefined;
}

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

export function assertMechanicalCompatibility(
  torpedo: CompiledTorpedo,
  launcher: TorpedoLauncherDefinition,
  platform: TorpedoPlatformCapabilities,
): void {
  const verdict = evaluateInstallCompatibility(torpedo, launcher, platform);
  const failing = MECHANICAL_COMPATIBILITY_PREDICATES.filter((p) => !verdict.predicateResults[p]);
  if (failing.length > 0) incompatible(torpedo, launcher, failing);
}

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
      inventoryAvailable: true,
      treatyOrScenario: true,
    },
    requiresRefit: false,
  };
}
