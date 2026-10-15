/**
 * The P1 gun adapter (ship-part-model SPM-R19, SPM-R20; proposal §9.2): today's gun
 * catalogue read as `gun` and `gun_mount` **parts** in the strict flattened shape of
 * `@bluewave/content-schema` (`FlattenedPartSchema`). Nothing simulation-facing is added to
 * a part: the legacy family id, the legacy resolved mount type and the D17 disposition stay
 * on the adapter's side records, which are migration provenance only.
 *
 * Sources: a nation's authored model (`ship-building/armament/gun-models.yaml`) or the
 * family-derived `standard_<family>` model (`components.yaml`); an authored mount
 * (`gun-mounts.yaml`) or the family-derived `<family>_<type>` mount (`components.yaml`).
 * Quantities follow §9.2: `gun_kg` and the per-gun cost → `PER_PART_UNIT` on the gun;
 * `mount_fixed_kg` → `PER_LOADOUT_ENTRY`; `mount_per_barrel_kg` and the per-barrel mount
 * cost → `PER_CONTAINED_UNIT` on the mount. The component's crew, volume and deck-footprint
 * formulas are per-barrel terms too, so they become `PER_CONTAINED_UNIT` on the mount through
 * the shared formula reader (`legacyComponentQuantities.ts`, ticket 05); a count-independent
 * term would be `PER_LOADOUT_ENTRY`.
 */
import type {
  ArmamentMountType,
  ArmamentProvenance,
  GunModel as ArmamentGunModel,
  GunMountDef as ArmamentGunMountDef,
} from "@bluewave/armament";
import type { FlattenedPart, QuantityComponentData } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import {
  armamentModelFor,
  armamentMountFor,
  type AuthoredArmamentContent,
} from "./armamentContent.js";
import type { ComponentDef } from "./component.js";
import {
  QUANTITY_STEM,
  readComponentQuantities,
  type QuantityReadIssue,
} from "./legacyComponentQuantities.js";
import { availableUntilFromRetirementMonth } from "./partLifecycle.js";

export type FlattenedGunPart = Extract<FlattenedPart, { readonly family: "gun" }>;
export type FlattenedGunMountPart = Extract<FlattenedPart, { readonly family: "gun_mount" }>;
/** The six gun-mount types; the legacy enum's torpedo-tube values are not mount types. */
export type GunMountType = FlattenedGunMountPart["spec"]["mountType"];

/** Where the adapter read each record, relative to the content root (ADR-0147). */
export const GUN_SOURCE_FILES = {
  authoredModel: "ship-building/armament/gun-models.yaml",
  authoredMount: "ship-building/armament/gun-mounts.yaml",
  component: "ship-building/components.yaml",
} as const;

/** The one disposition a translated D17 central-battery entry carries (proposal §9.2). */
export type TranslationDisposition = "RECLASSIFIED_AS_CENTRAL_BATTERY";

/** The mount types whose legacy `barrels` count single-gun mounts (§9.2 row 1). */
const SINGLE_GUN_MOUNTS: ReadonlySet<string> = new Set<GunMountType>([
  "CASEMATE",
  "BROADSIDE_BATTERY",
  "DECK_SHIELDED",
  "DECK_OPEN",
]);

/** The rotating mount types whose 1–2 barrels share one mount (§9.2 row 2). */
const MULTI_GUN_MOUNTS: ReadonlySet<string> = new Set<GunMountType>(["TURRET", "BARBETTE"]);

export function isGunMountType(type: ArmamentMountType): type is GunMountType {
  return SINGLE_GUN_MOUNTS.has(type) || MULTI_GUN_MOUNTS.has(type);
}

export function isSingleGunMount(type: GunMountType): boolean {
  return SINGLE_GUN_MOUNTS.has(type);
}

/** A number-valued component constant, or `undefined`. */
function constantOf(def: ComponentDef | undefined, name: string): number | undefined {
  return def?.constants[name];
}

function definedQuantity(
  id: string,
  kind: QuantityComponentData["kind"],
  value: number | undefined,
  basis: QuantityComponentData["basis"],
): QuantityComponentData[] {
  return value === undefined ? [] : [{ id, kind, value, basis }];
}

/** A copy of the armament provenance in the content-schema record shape. */
function provenanceOf(p: ArmamentProvenance): FlattenedGunPart["provenance"] {
  return {
    sourceStatus: p.sourceStatus,
    confidence: p.confidence,
    kind: p.kind,
    sources: p.sources.map((s) => ({ ...s })),
    ...(p.derivation !== undefined ? { derivation: { ...p.derivation } } : {}),
    ...(p.note !== undefined ? { note: p.note } : {}),
  };
}

// Gun parts

/** One gun part with the adapter-side facts the translation needs (never in the part). */
export interface GunPartRecord {
  readonly part: FlattenedGunPart;
  /** The legacy armament family (`components.yaml` gun id). */
  readonly familyId: string;
  /** The type the legacy compile resolves: the model's first supported type, else `DECK_OPEN`. */
  readonly resolvedMountType: ArmamentMountType;
}

export interface GunPartRequest {
  readonly nationId: string;
  readonly familyId: string;
}

/** A request the adapter could not read, with the reason (never dropped silently). */
export interface UnreadGunPart extends GunPartRequest {
  readonly code: "PART_READ_PATH_NO_GUN_MODEL";
  readonly message: string;
}

/** The in-memory gun-part index: parts by id, and the part each nation uses per family. */
export interface GunPartModel {
  /** Every distinct gun part, codepoint-ordered by id. */
  readonly parts: readonly FlattenedGunPart[];
  readonly byRequest: ReadonlyMap<string, GunPartRecord>;
  /** Requests with no model, codepoint-ordered by nation then family. */
  readonly unread: readonly UnreadGunPart[];
}

/** A stable key for one nation's use of one family. `\u0000` cannot appear in an id. */
export function gunKey(nationId: string, familyId: string): string {
  return `${nationId}\u0000${familyId}`;
}

function gunPartFromModel(
  content: AuthoredArmamentContent,
  component: ComponentDef | undefined,
  nationId: string,
  model: ArmamentGunModel,
): FlattenedGunPart {
  if (model.caliberUm === undefined || model.introductionMonth === undefined) {
    throw new Error(
      `gunPartAdapter: gun model '${String(model.id)}' has no caliberUm or introductionMonth; ` +
        "every authored model and its legacy component define both",
    );
  }
  const authored = content.gunModels.some((m) => m.id === String(model.id));
  const gunKg = constantOf(component, "gun_kg");
  const costPerKg = constantOf(component, "cost_per_kg_micro");
  const requires = (model.requiredTechnologyIds ?? []).map(String);
  const rounds = component?.parameters["rounds"];
  return {
    id: String(model.id),
    family: "gun",
    provides: "gun",
    name: model.designation,
    // The family-derived model is shared by every nation without an authored one.
    ...(authored ? { nation: nationId } : {}),
    lifecycle: {
      availableFrom: model.introductionMonth,
      availableUntil: availableUntilFromRetirementMonth(model.retirementMonth),
      ...(requires.length > 0 ? { requires } : {}),
    },
    spec: {
      gunFamily: String(model.familyId),
      calibreUm: model.caliberUm,
      ...(model.barrelLengthCalibers !== undefined
        ? { barrelLengthCalibers: model.barrelLengthCalibers }
        : {}),
      ...(model.gunMassKg !== undefined ? { gunMassKg: model.gunMassKg } : {}),
      ...(model.loadingSystem !== undefined ? { loadingSystem: model.loadingSystem } : {}),
      ...(model.nominalMuzzleVelocityUmPerSec !== undefined
        ? { nominalMuzzleVelocityUmPerSec: model.nominalMuzzleVelocityUmPerSec }
        : {}),
      ...(model.mechanicalRateOfFireRoundsPerMinuteX100 !== undefined
        ? { mechanicalRateOfFireRoundsPerMinuteX100: model.mechanicalRateOfFireRoundsPerMinuteX100 }
        : {}),
      ...(model.propellantChargeBp !== undefined
        ? { propellantChargeBp: model.propellantChargeBp }
        : {}),
      ...(model.shellMassG !== undefined ? { shellMassG: model.shellMassG } : {}),
      ...(model.roundVolumeMl !== undefined ? { roundVolumeMl: model.roundVolumeMl } : {}),
      ...(model.reliabilityBp !== undefined ? { reliabilityBp: model.reliabilityBp } : {}),
    },
    // The stowage choice is a per-placement parameter: the range lives on the gun part.
    ...(rounds !== undefined
      ? { parameters: { rounds: { min: rounds.min, max: rounds.max, step: rounds.step } } }
      : {}),
    quantities: [
      ...definedQuantity("gun_mass", "massKg", model.gunMassKg, "PER_PART_UNIT"),
      ...definedQuantity(
        "gun_cost",
        "costMicro",
        gunKg !== undefined && costPerKg !== undefined ? gunKg * costPerKg : undefined,
        "PER_PART_UNIT",
      ),
    ],
    revisions: [],
    origin: {
      sourceFile: authored ? GUN_SOURCE_FILES.authoredModel : GUN_SOURCE_FILES.component,
    },
    provenance: provenanceOf(model.provenance),
  };
}

/**
 * Build the in-memory gun-part index from today's content (SPM-R19). Each nation × family
 * request reads `armamentModelFor`, so a national model (or the family-derived fallback)
 * becomes one `gun` part; a request with no model is kept in `unread` with its reason.
 * The result does not depend on the request order.
 */
export function buildGunPartModel(input: {
  readonly content: AuthoredArmamentContent;
  readonly components: readonly ComponentDef[];
  readonly requests: readonly GunPartRequest[];
}): GunPartModel {
  const byRequest = new Map<string, GunPartRecord>();
  const parts = new Map<string, FlattenedGunPart>();
  const unread = new Map<string, UnreadGunPart>();
  for (const { nationId, familyId } of input.requests) {
    const key = gunKey(nationId, familyId);
    if (byRequest.has(key) || unread.has(key)) continue;
    const model = armamentModelFor(input.content, input.components, nationId, familyId);
    if (model === null) {
      unread.set(key, {
        nationId,
        familyId,
        code: "PART_READ_PATH_NO_GUN_MODEL",
        message: `No gun model for family '${familyId}' available to '${nationId}'.`,
      });
      continue;
    }
    const component = input.components.find((c) => c.id === familyId);
    const part = gunPartFromModel(input.content, component, nationId, model);
    parts.set(part.id, part);
    byRequest.set(key, {
      part,
      familyId: String(model.familyId),
      resolvedMountType: model.supportedMountTypes?.[0] ?? "DECK_OPEN",
    });
  }
  return {
    parts: [...parts.values()].sort((a, b) => compareCodePoints(a.id, b.id)),
    byRequest,
    unread: [...unread.values()].sort(
      (a, b) =>
        compareCodePoints(a.nationId, b.nationId) || compareCodePoints(a.familyId, b.familyId),
    ),
  };
}

// Gun-mount parts

function mountPartFromLegacy(
  content: AuthoredArmamentContent,
  component: ComponentDef | undefined,
  id: string,
  mountType: GunMountType,
  gunsPerMount: number,
  legacy: ArmamentGunMountDef,
  perGunTerms: readonly QuantityComponentData[],
): FlattenedGunMountPart {
  if (legacy.introductionMonth === undefined) {
    throw new Error(
      `gunPartAdapter: gun mount '${String(legacy.id)}' has no introductionMonth; ` +
        "every authored mount and its legacy component define one",
    );
  }
  const authored = content.gunMounts.some((m) => m.id === String(legacy.id));
  const requires = (legacy.requiredTechnologyIds ?? []).map(String);
  return {
    id,
    family: "gun_mount",
    provides: "gun_mount",
    name: id,
    lifecycle: {
      availableFrom: legacy.introductionMonth,
      availableUntil: availableUntilFromRetirementMonth(legacy.retirementMonth),
      ...(requires.length > 0 ? { requires } : {}),
    },
    // The mount's own `guns` slot holds `gunsPerMount` guns (SPM-R3).
    slots: [{ id: "guns", accepts: ["gun"], mountCount: { min: gunsPerMount, max: gunsPerMount } }],
    spec: {
      mountType,
      gunsPerMount,
      ...(legacy.topWeightKg !== undefined ? { topWeightKg: legacy.topWeightKg } : {}),
      ...(legacy.supportedArmorMm !== undefined
        ? { supportedArmorMm: legacy.supportedArmorMm }
        : {}),
      ...(legacy.traverseDeg !== undefined ? { traverseDeg: legacy.traverseDeg } : {}),
      ...(legacy.elevationMinDeg !== undefined ? { elevationMinDeg: legacy.elevationMinDeg } : {}),
      ...(legacy.elevationMaxDeg !== undefined ? { elevationMaxDeg: legacy.elevationMaxDeg } : {}),
      ...(legacy.firingArcDeg !== undefined ? { firingArcDeg: legacy.firingArcDeg } : {}),
      ...(legacy.rateOfFireModifierBp !== undefined
        ? { rateOfFireModifierBp: legacy.rateOfFireModifierBp }
        : {}),
      ...(legacy.ammunitionHandlingModifierBp !== undefined
        ? { ammunitionHandlingModifierBp: legacy.ammunitionHandlingModifierBp }
        : {}),
      ...(legacy.crewProtection !== undefined ? { crewProtection: legacy.crewProtection } : {}),
      ...(legacy.stabilityContributionKgM !== undefined
        ? { stabilityContributionKgM: legacy.stabilityContributionKgM }
        : {}),
      ...(legacy.vulnerability !== undefined ? { vulnerability: legacy.vulnerability } : {}),
    },
    quantities: [
      ...definedQuantity(
        "installation_fixed",
        "massKg",
        legacy.baseInstallationMassKg,
        "PER_LOADOUT_ENTRY",
      ),
      ...definedQuantity(
        "installation_per_gun",
        "massKg",
        legacy.perGunInstallationMassKg,
        "PER_CONTAINED_UNIT",
      ),
      ...definedQuantity(
        "mount_cost_per_gun",
        "costMicro",
        constantOf(component, "mount_cost_micro"),
        "PER_CONTAINED_UNIT",
      ),
      ...perGunTerms,
    ],
    revisions: [],
    origin: {
      sourceFile: authored ? GUN_SOURCE_FILES.authoredMount : GUN_SOURCE_FILES.component,
    },
    provenance: provenanceOf(legacy.provenance),
  };
}

/** The result of translating one gun placement's mount (§9.2, D17). */
export interface GunMountTranslation {
  readonly part: FlattenedGunMountPart;
  /** The legacy mount record the part was read from (its id is the D18 old value). */
  readonly legacyMountId: string;
  readonly disposition: TranslationDisposition | null;
  /** Crew, volume or footprint formulas of the family the part model could not carry. */
  readonly quantityIssues: readonly QuantityReadIssue[];
}

/** The family component's crew, volume and deck footprint, per gun on the mount. */
function perGunQuantities(component: ComponentDef | undefined): {
  readonly quantities: readonly QuantityComponentData[];
  readonly issues: readonly QuantityReadIssue[];
} {
  if (component === undefined) return { quantities: [], issues: [] };
  return readComponentQuantities(component, {
    fields: ["crew", "volumeLitre", "deckFootprintMm2"],
    countParameter: "barrels",
    perUnitBasis: "PER_CONTAINED_UNIT",
    idFor: (field, term) =>
      term === "fixed" ? `${QUANTITY_STEM[field]}_fixed` : `${QUANTITY_STEM[field]}_per_gun`,
  });
}

/**
 * Build the mount part for one placement, applying the §9.2 translation. The legacy
 * resolved mount record supplies every value, so nothing calculated changes; a ≥3-barrel
 * turret or barbette becomes the D17 battery assembly (`BROADSIDE_BATTERY`, canonical id
 * `<family>_central_battery_<n>`). Returns `null` when no mount exists for the family.
 */
export function buildGunMountPart(input: {
  readonly content: AuthoredArmamentContent;
  readonly components: readonly ComponentDef[];
  readonly familyId: string;
  readonly legacyMountType: GunMountType;
  readonly barrels: number;
}): GunMountTranslation | null {
  const legacy = armamentMountFor(
    input.content,
    input.components,
    input.familyId,
    input.legacyMountType,
    input.barrels,
  );
  if (legacy === null) return null;
  const component = input.components.find((c) => c.id === input.familyId);
  const legacyMountId = String(legacy.id);
  const perGun = perGunQuantities(component);
  const read = (id: string, type: GunMountType, gunsPerMount: number) =>
    mountPartFromLegacy(
      input.content,
      component,
      id,
      type,
      gunsPerMount,
      legacy,
      perGun.quantities,
    );
  const quantityIssues = perGun.issues;
  if (isSingleGunMount(input.legacyMountType)) {
    return {
      part: read(legacyMountId, input.legacyMountType, 1),
      legacyMountId,
      disposition: null,
      quantityIssues,
    };
  }
  if (input.barrels >= 3) {
    // D17: the legacy resolved type and the disposition stay in migration provenance only.
    return {
      part: read(
        `${input.familyId}_central_battery_${input.barrels}`,
        "BROADSIDE_BATTERY",
        input.barrels,
      ),
      legacyMountId,
      disposition: "RECLASSIFIED_AS_CENTRAL_BATTERY",
      quantityIssues,
    };
  }
  return {
    part: read(legacyMountId, input.legacyMountType, input.barrels),
    legacyMountId,
    disposition: null,
    quantityIssues,
  };
}
