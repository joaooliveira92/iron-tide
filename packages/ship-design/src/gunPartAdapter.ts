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
import { designInvariant } from "./errors.js";

export type FlattenedGunPart = Extract<FlattenedPart, { readonly family: "gun" }>;
export type FlattenedGunMountPart = Extract<FlattenedPart, { readonly family: "gun_mount" }>;
export type GunMountType = FlattenedGunMountPart["spec"]["mountType"];

export const GUN_SOURCE_FILES = {
  authoredModel: "ship-building/armament/gun-models.yaml",
  authoredMount: "ship-building/armament/gun-mounts.yaml",
  component: "ship-building/components.yaml",
} as const;

export type TranslationDisposition = "RECLASSIFIED_AS_CENTRAL_BATTERY";

const SINGLE_GUN_MOUNTS: ReadonlySet<string> = new Set<GunMountType>([
  "CASEMATE",
  "BROADSIDE_BATTERY",
  "DECK_SHIELDED",
  "DECK_OPEN",
]);

const MULTI_GUN_MOUNTS: ReadonlySet<string> = new Set<GunMountType>(["TURRET", "BARBETTE"]);

export function isGunMountType(type: ArmamentMountType): type is GunMountType {
  return SINGLE_GUN_MOUNTS.has(type) || MULTI_GUN_MOUNTS.has(type);
}

export function isSingleGunMount(type: GunMountType): boolean {
  return SINGLE_GUN_MOUNTS.has(type);
}

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

export interface GunPartRecord {
  readonly part: FlattenedGunPart;
  readonly familyId: string;
  readonly resolvedMountType: ArmamentMountType;
}

export interface GunPartRequest {
  readonly nationId: string;
  readonly familyId: string;
}

export interface UnreadGunPart extends GunPartRequest {
  readonly code: "PART_READ_PATH_NO_GUN_MODEL";
  readonly message: string;
}

export interface GunPartModel {
  readonly parts: readonly FlattenedGunPart[];
  readonly byRequest: ReadonlyMap<string, GunPartRecord>;
  readonly unread: readonly UnreadGunPart[];
}

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
    throw designInvariant(
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
    throw designInvariant(
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

export interface GunMountTranslation {
  readonly part: FlattenedGunMountPart;
  readonly legacyMountId: string;
  readonly disposition: TranslationDisposition | null;
  readonly quantityIssues: readonly QuantityReadIssue[];
}

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
