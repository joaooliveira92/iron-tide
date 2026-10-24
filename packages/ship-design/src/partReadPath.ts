import {
  armamentNationId,
  armamentTechnologyId,
  gunFamilyId,
  gunModelId,
  gunMountId,
  resolveArmament,
  toCompiledArmamentMount,
  type ArmamentAccessStatus,
  type ArmamentResolutionFinding,
  type CompiledArmamentMount,
  type GunModel as ArmamentGunModel,
  type GunMountDef as ArmamentGunMountDef,
  type ResolvedArmament,
} from "@bluewave/armament";
import type { LoadoutEntryData } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import { armamentAmmunitionFor, type AuthoredArmamentContent } from "./armamentContent.js";
import type { ComponentDef } from "./component.js";
import type { PlacementSpec } from "./compileShared.js";
import {
  buildGunMountPart,
  gunKey,
  isGunMountType,
  isSingleGunMount,
  type FlattenedGunMountPart,
  type FlattenedGunPart,
  type GunMountType,
  type GunPartModel,
  type GunPartRecord,
  type TranslationDisposition,
} from "./gunPartAdapter.js";
import type { QuantityReadIssue } from "./legacyComponentQuantities.js";
import { compatibilitySlotId } from "./partCompatibility.js";
import { retirementMonthFromAvailableUntil } from "./partLifecycle.js";
import { quantityLines, type QuantityLine } from "./partQuantities.js";
import { designInvariant } from "./errors.js";

export interface GunPlacementTranslation {
  readonly designId: string;
  readonly instanceId: string;
  readonly nationId: string;
  readonly familyId: string;
  readonly legacyBarrels: number;
  readonly legacyResolvedMountType: GunMountType;
  readonly legacyMountId: string;
  readonly mountType: GunMountType;
  readonly mountCount: number;
  readonly gunsPerMount: number;
  readonly containedUnits: number;
  readonly disposition: TranslationDisposition | null;
  readonly mountPart: FlattenedGunMountPart;
  readonly gunPart: FlattenedGunPart;
  readonly entry: LoadoutEntryData;
  readonly quantities: readonly QuantityLine[];
  readonly quantityIssues: readonly QuantityReadIssue[];
}

export function translateGunPlacement(input: {
  readonly designId: string;
  readonly placement: PlacementSpec;
  readonly nationId: string;
  readonly gun: GunPartRecord;
  readonly content: AuthoredArmamentContent;
  readonly components: readonly ComponentDef[];
}): GunPlacementTranslation | null {
  const legacyBarrels = input.placement.params?.barrels ?? 1;
  const legacyMountType = input.gun.resolvedMountType;
  if (!isGunMountType(legacyMountType)) {
    throw designInvariant(
      `partReadPath: gun model '${input.gun.part.id}' resolves to '${legacyMountType}', not a gun mount type`,
    );
  }
  const mount = buildGunMountPart({
    content: input.content,
    components: input.components,
    familyId: input.gun.familyId,
    legacyMountType,
    barrels: legacyBarrels,
  });
  if (mount === null) return null;
  const mountCount = isSingleGunMount(legacyMountType) ? legacyBarrels : 1;
  const gunsPerMount = mount.part.spec.gunsPerMount;
  const containedUnits = mountCount * gunsPerMount;
  const { placement } = input;
  const roundsRange = input.gun.part.parameters?.["rounds"];
  const rounds = placement.params?.["rounds"] ?? roundsRange?.min;
  return {
    designId: input.designId,
    instanceId: placement.instanceId,
    nationId: input.nationId,
    familyId: input.gun.familyId,
    legacyBarrels,
    legacyResolvedMountType: legacyMountType,
    legacyMountId: mount.legacyMountId,
    mountType: mount.part.spec.mountType,
    mountCount,
    gunsPerMount,
    containedUnits,
    disposition: mount.disposition,
    mountPart: mount.part,
    gunPart: input.gun.part,
    entry: {
      id: placement.instanceId,
      slot: compatibilitySlotId(placement.zoneId, "gun_mount"),
      part: mount.part.id,
      mountCount,
      stationPermille: placement.stationPermille,
      ...(placement.side !== undefined ? { side: placement.side } : {}),
      ...(placement.magazineRef !== undefined ? { magazineEntry: placement.magazineRef } : {}),
      entries: {
        guns: [
          {
            part: input.gun.part.id,
            mountCount: containedUnits,
            ...(rounds !== undefined ? { params: { rounds } } : {}),
          },
        ],
      },
    },
    quantities: [
      ...quantityLines(mount.part.quantities, "mount", mount.part.id, mountCount, gunsPerMount),
      ...quantityLines(input.gun.part.quantities, "gun", input.gun.part.id, containedUnits, 1),
    ],
    quantityIssues: mount.quantityIssues,
  };
}

function armamentGunModelFromPart(gun: GunPartRecord): ArmamentGunModel {
  const { part } = gun;
  return {
    id: gunModelId(part.id),
    familyId: gunFamilyId(gun.familyId),
    designation: part.name,
    caliberUm: part.spec.calibreUm,
    ...(part.spec.barrelLengthCalibers !== undefined
      ? { barrelLengthCalibers: part.spec.barrelLengthCalibers }
      : {}),
    ...(part.spec.gunMassKg !== undefined ? { gunMassKg: part.spec.gunMassKg } : {}),
    ...(part.spec.loadingSystem !== undefined ? { loadingSystem: part.spec.loadingSystem } : {}),
    ...(part.spec.nominalMuzzleVelocityUmPerSec !== undefined
      ? { nominalMuzzleVelocityUmPerSec: part.spec.nominalMuzzleVelocityUmPerSec }
      : {}),
    ...(part.spec.mechanicalRateOfFireRoundsPerMinuteX100 !== undefined
      ? {
          mechanicalRateOfFireRoundsPerMinuteX100:
            part.spec.mechanicalRateOfFireRoundsPerMinuteX100,
        }
      : {}),
    ...(part.spec.propellantChargeBp !== undefined
      ? { propellantChargeBp: part.spec.propellantChargeBp }
      : {}),
    ...(part.spec.shellMassG !== undefined ? { shellMassG: part.spec.shellMassG } : {}),
    ...(part.spec.roundVolumeMl !== undefined ? { roundVolumeMl: part.spec.roundVolumeMl } : {}),
    ...(part.spec.reliabilityBp !== undefined ? { reliabilityBp: part.spec.reliabilityBp } : {}),
    introductionMonth: part.lifecycle.availableFrom,
    retirementMonth: retirementMonthFromAvailableUntil(part.lifecycle.availableUntil),
    requiredTechnologyIds: (part.lifecycle.requires ?? []).map(armamentTechnologyId),
    provenance: part.provenance,
  };
}

function quantityValue(part: FlattenedGunMountPart, id: string): number | undefined {
  return part.quantities.find((q) => q.id === id)?.value;
}

function armamentMountFromPart(
  part: FlattenedGunMountPart,
  familyId: string,
  gunCount: number,
): ArmamentGunMountDef {
  const fixed = quantityValue(part, "installation_fixed");
  const perGun = quantityValue(part, "installation_per_gun");
  const { spec } = part;
  return {
    id: gunMountId(part.id),
    mountType: spec.mountType,
    compatibleGunFamilies: [gunFamilyId(familyId)],
    gunCount,
    ...(fixed !== undefined ? { baseInstallationMassKg: fixed } : {}),
    ...(perGun !== undefined ? { perGunInstallationMassKg: perGun } : {}),
    ...(spec.topWeightKg !== undefined ? { topWeightKg: spec.topWeightKg } : {}),
    ...(spec.supportedArmorMm !== undefined ? { supportedArmorMm: spec.supportedArmorMm } : {}),
    ...(spec.traverseDeg !== undefined ? { traverseDeg: spec.traverseDeg } : {}),
    ...(spec.elevationMinDeg !== undefined ? { elevationMinDeg: spec.elevationMinDeg } : {}),
    ...(spec.elevationMaxDeg !== undefined ? { elevationMaxDeg: spec.elevationMaxDeg } : {}),
    ...(spec.firingArcDeg !== undefined ? { firingArcDeg: spec.firingArcDeg } : {}),
    ...(spec.rateOfFireModifierBp !== undefined
      ? { rateOfFireModifierBp: spec.rateOfFireModifierBp }
      : {}),
    ...(spec.ammunitionHandlingModifierBp !== undefined
      ? { ammunitionHandlingModifierBp: spec.ammunitionHandlingModifierBp }
      : {}),
    ...(spec.crewProtection !== undefined ? { crewProtection: spec.crewProtection } : {}),
    ...(spec.stabilityContributionKgM !== undefined
      ? { stabilityContributionKgM: spec.stabilityContributionKgM }
      : {}),
    ...(spec.vulnerability !== undefined ? { vulnerability: spec.vulnerability } : {}),
    introductionMonth: part.lifecycle.availableFrom,
    retirementMonth: retirementMonthFromAvailableUntil(part.lifecycle.availableUntil),
    requiredTechnologyIds: (part.lifecycle.requires ?? []).map(armamentTechnologyId),
    provenance: part.provenance,
  };
}

export type UnresolvedGunPlacementCode =
  | "PART_READ_PATH_NO_GUN_MODEL"
  | "PART_READ_PATH_NO_MOUNT"
  | "PART_READ_PATH_NO_FIRST_CLASS_ARMAMENT"
  | "PART_READ_PATH_NO_AMMUNITION"
  | "PART_READ_PATH_RESOLVER_BLOCKED";

export interface UnresolvedGunPlacement {
  readonly designId: string;
  readonly instanceId: string;
  readonly nationId: string;
  readonly familyId: string;
  readonly gunPart: string | null;
  readonly mountPart: string | null;
  readonly code: UnresolvedGunPlacementCode;
  readonly blockingCodes: readonly string[];
  readonly message: string;
}

export interface ResolveGunPlacementInput {
  readonly content: AuthoredArmamentContent;
  readonly components: readonly ComponentDef[];
  readonly model: GunPartModel;
  readonly designId: string;
  readonly placement: PlacementSpec;
  readonly nationId: string;
  readonly familyId: string;
  readonly month: string;
  readonly unlockedTechnologyIds: ReadonlySet<string>;
  readonly componentAccess: Readonly<Record<string, ArmamentAccessStatus>>;
  readonly useFirstClassArmament: boolean;
}

export interface ResolvedGunPlacement {
  readonly translation: GunPlacementTranslation | null;
  readonly resolved: ResolvedArmament | null;
  readonly compiled: CompiledArmamentMount | null;
  readonly findings: readonly ArmamentResolutionFinding[];
  readonly unresolved: UnresolvedGunPlacement | null;
}

export function resolveGunPlacementThroughParts(
  input: ResolveGunPlacementInput,
): ResolvedGunPlacement {
  const where = {
    designId: input.designId,
    instanceId: input.placement.instanceId,
    nationId: input.nationId,
    familyId: input.familyId,
  };
  const unresolvedResult = (
    translation: GunPlacementTranslation | null,
    gunPart: string | null,
    code: UnresolvedGunPlacementCode,
    message: string,
    findings: readonly ArmamentResolutionFinding[] = [],
  ): ResolvedGunPlacement => ({
    translation,
    resolved: null,
    compiled: null,
    findings,
    unresolved: {
      ...where,
      gunPart,
      mountPart: translation?.mountPart.id ?? null,
      code,
      blockingCodes: [
        ...new Set(findings.filter((f) => f.severity === "BLOCKING").map((f) => f.code)),
      ].sort(compareCodePoints),
      message,
    },
  });

  const gun = input.model.byRequest.get(gunKey(input.nationId, input.familyId));
  if (gun === undefined) {
    return unresolvedResult(
      null,
      null,
      "PART_READ_PATH_NO_GUN_MODEL",
      `No gun model for family '${input.familyId}' available to '${input.nationId}'.`,
    );
  }
  const translation = translateGunPlacement({
    designId: input.designId,
    placement: input.placement,
    nationId: input.nationId,
    gun,
    content: input.content,
    components: input.components,
  });
  if (translation === null) {
    return unresolvedResult(
      null,
      gun.part.id,
      "PART_READ_PATH_NO_MOUNT",
      `No ${gun.resolvedMountType} mount for family '${gun.familyId}'.`,
    );
  }
  if (!input.useFirstClassArmament) {
    return unresolvedResult(
      translation,
      gun.part.id,
      "PART_READ_PATH_NO_FIRST_CLASS_ARMAMENT",
      `Nation '${input.nationId}' has no first-class armament content; ` +
        "the legacy compile resolves this placement on the compatibility path.",
    );
  }
  const ammunition = armamentAmmunitionFor(input.content, input.nationId, input.familyId);
  if (ammunition === null) {
    return unresolvedResult(
      translation,
      gun.part.id,
      "PART_READ_PATH_NO_AMMUNITION",
      `No ammunition pattern for nation '${input.nationId}'.`,
    );
  }
  const result = resolveArmament(
    armamentGunModelFromPart(gun),
    armamentMountFromPart(translation.mountPart, gun.familyId, translation.containedUnits),
    ammunition,
    {
      month: input.month,
      unlockedTechnologyIds: new Set([...input.unlockedTechnologyIds].map(armamentTechnologyId)),
    },
    { nationId: armamentNationId(input.nationId), componentAccess: input.componentAccess },
  );
  if (result.resolved === null) {
    return unresolvedResult(
      translation,
      gun.part.id,
      "PART_READ_PATH_RESOLVER_BLOCKED",
      `The armament resolver blocked '${gun.part.id}' in '${translation.mountPart.id}'.`,
      result.findings,
    );
  }
  return {
    translation,
    resolved: result.resolved,
    compiled: toCompiledArmamentMount(
      result.resolved,
      translation.mountType,
      input.placement.instanceId,
    ),
    findings: result.findings,
    unresolved: null,
  };
}

export function sortUnresolvedGunPlacements(
  list: readonly UnresolvedGunPlacement[],
): UnresolvedGunPlacement[] {
  return [...list].sort(
    (a, b) =>
      compareCodePoints(a.designId, b.designId) || compareCodePoints(a.instanceId, b.instanceId),
  );
}
