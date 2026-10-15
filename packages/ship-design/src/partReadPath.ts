/**
 * The P1 gun read path (ship-part-model SPM-R6, R13, R14, R16, R19, R20; proposal §9.2).
 * Additive and in memory only: production content, saves, visual YAML and every golden are
 * untouched, and the production pipeline stays on the legacy path.
 *
 * A reference design's gun placement becomes one **loadout entry** (the strict
 * `LoadoutEntrySchema` shape) in its zone's compatibility slot, with a nested `guns` entry —
 * `mountCount × gunsPerMount` = the legacy barrel count — and its quantities compile through
 * their declared basis (`partQuantities.ts`). The parts (`gunPartAdapter.ts`) are then turned
 * back into armament inputs for the existing `@bluewave/armament` resolver, so
 * `ResolvedArmament` and the compiled weapon contract equal the legacy path's for every
 * placement except the nine D17 identity paths (`mountType`, `mountId`).
 *
 * A placement that does not resolve is never dropped: it carries an `UnresolvedGunPlacement`
 * naming the design, placement, nation, family, parts and the reason. Today that is the
 * compatibility path — a nation with no first-class armament content resolves nothing in the
 * legacy compile either — and `useFirstClassArmament` carries that gate so P2 can drop it.
 */
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

/** One gun placement rendered in the new model (SPM-R6, R13, R14, R16). */
export interface GunPlacementTranslation {
  readonly designId: string;
  readonly instanceId: string;
  readonly nationId: string;
  readonly familyId: string;
  /** The legacy placement's barrels (its `params.barrels`, default 1). */
  readonly legacyBarrels: number;
  /** The legacy resolved mount type, before any D17 reclassification. */
  readonly legacyResolvedMountType: GunMountType;
  /** The legacy mount record id (the D18 old `mountId`). */
  readonly legacyMountId: string;
  /** The canonical translated mount type. */
  readonly mountType: GunMountType;
  readonly mountCount: number;
  readonly gunsPerMount: number;
  /** `mountCount × gunsPerMount` = the legacy barrel count. */
  readonly containedUnits: number;
  /** Migration provenance only; never written to a part or an entry. */
  readonly disposition: TranslationDisposition | null;
  readonly mountPart: FlattenedGunMountPart;
  readonly gunPart: FlattenedGunPart;
  /** The placement's one loadout entry: the mount in its zone slot, the guns nested. */
  readonly entry: LoadoutEntryData;
  /** Every quantity component compiled at this entry's counts. */
  readonly quantities: readonly QuantityLine[];
  /** The family's crew, volume or footprint formulas the part model could not carry (none today). */
  readonly quantityIssues: readonly QuantityReadIssue[];
}

/**
 * Translate one gun placement into its loadout entry (SPM-R20, §9.2). The mount type is the
 * one the legacy compile resolves (the model's first supported type, else `DECK_OPEN`).
 * Returns `null` when the family has no mount of that type.
 */
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
    throw new Error(
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
      // A nested entry's part units are its parent's contained units (SPM-R13).
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

// ---------------------------------------------------------------------------
// Compiling the entry back through the existing armament resolver (SPM-R16)
// ---------------------------------------------------------------------------

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
    // `supportedMountTypes` is intentionally absent: the mount type belongs to the mount
    // part and its slot, not the gun, so a D17 battery resolves cleanly.
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

/** Why a gun placement produced no `ResolvedArmament`. */
export type UnresolvedGunPlacementCode =
  /** No gun model (national or family-derived) for the nation and family. */
  | "PART_READ_PATH_NO_GUN_MODEL"
  /** The family has no mount of the type the legacy compile resolves. */
  | "PART_READ_PATH_NO_MOUNT"
  /** The nation has no first-class armament content; the legacy compile resolves none either. */
  | "PART_READ_PATH_NO_FIRST_CLASS_ARMAMENT"
  /** The nation has first-class content but no ammunition pattern for the family. */
  | "PART_READ_PATH_NO_AMMUNITION"
  /** The armament resolver returned BLOCKING findings. */
  | "PART_READ_PATH_RESOLVER_BLOCKED";

/** A deterministic, actionable record of one placement that did not resolve. */
export interface UnresolvedGunPlacement {
  readonly designId: string;
  readonly instanceId: string;
  readonly nationId: string;
  readonly familyId: string;
  /** The gun part read for the placement, when one was. */
  readonly gunPart: string | null;
  /** The mount part translated for the placement, when one was. */
  readonly mountPart: string | null;
  readonly code: UnresolvedGunPlacementCode;
  /** The BLOCKING resolver finding codes, codepoint-ordered (only for `RESOLVER_BLOCKED`). */
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
  /** The legacy gate: a nation with no first-class armament resolves nothing (P1 only). */
  readonly useFirstClassArmament: boolean;
}

/** Exactly one of `resolved` and `unresolved` is non-null. */
export interface ResolvedGunPlacement {
  readonly translation: GunPlacementTranslation | null;
  readonly resolved: ResolvedArmament | null;
  readonly compiled: CompiledArmamentMount | null;
  readonly findings: readonly ArmamentResolutionFinding[];
  readonly unresolved: UnresolvedGunPlacement | null;
}

/**
 * Compile one gun placement through its loadout entry and the existing armament resolver
 * (SPM-R16). The armament inputs are rebuilt from the parts — the gun model from the `gun`
 * part, the mount from the `gun_mount` part at the translated gun count — so the result
 * matches the legacy resolver for every placement except the nine D17 identity paths.
 */
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

/** Unresolved placements in a stable order: design, then placement (codepoint). */
export function sortUnresolvedGunPlacements(
  list: readonly UnresolvedGunPlacement[],
): UnresolvedGunPlacement[] {
  return [...list].sort(
    (a, b) =>
      compareCodePoints(a.designId, b.designId) || compareCodePoints(a.instanceId, b.instanceId),
  );
}
