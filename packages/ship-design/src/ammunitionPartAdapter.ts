import {
  ammunitionId,
  gunFamilyId,
  gunModelId,
  type AmmunitionPattern as ArmamentAmmunitionPattern,
} from "@bluewave/armament";
import type { FlattenedPart } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import type { AuthoredAmmunition } from "./armamentContent.js";
import {
  availableUntilFromRetirementMonth,
  isMonth,
  lifecycleIssue,
  retirementMonthFromAvailableUntil,
} from "./partLifecycle.js";

export type FlattenedAmmunitionPart = Extract<FlattenedPart, { readonly family: "ammunition" }>;

export const AMMUNITION_FILE = "ship-building/armament/ammunition.yaml";

export interface AmmunitionPartRecord {
  readonly part: FlattenedAmmunitionPart;
  readonly legacy: {
    readonly compatibleGunFamilies?: readonly string[];
    readonly compatibleGunModelIds?: readonly string[];
  };
}

export interface UnreadAmmunition {
  readonly id: string;
  readonly code: "PART_READ_PATH_INVALID_LIFECYCLE" | "PART_READ_PATH_INVALID_NATION";
  readonly message: string;
}

export interface AmmunitionPartModel {
  readonly records: readonly AmmunitionPartRecord[];
  readonly unread: readonly UnreadAmmunition[];
}

const STABLE_ID = /^[a-z][a-z0-9_]*$/;

export function buildAmmunitionPartModel(input: {
  readonly ammunition: readonly AuthoredAmmunition[];
}): AmmunitionPartModel {
  const records: AmmunitionPartRecord[] = [];
  const unread: UnreadAmmunition[] = [];
  for (const a of input.ammunition) {
    const until =
      a.retirementMonth != null && !isMonth(a.retirementMonth)
        ? a.retirementMonth
        : availableUntilFromRetirementMonth(a.retirementMonth);
    const lifecycle = lifecycleIssue(a.introductionMonth, until);
    if (a.introductionMonth === undefined || lifecycle !== null) {
      unread.push({
        id: a.id,
        code: "PART_READ_PATH_INVALID_LIFECYCLE",
        message: `Ammunition '${a.id}': ${lifecycle ?? "no introduction month"}.`,
      });
      continue;
    }
    if (!STABLE_ID.test(a.nationId)) {
      unread.push({
        id: a.id,
        code: "PART_READ_PATH_INVALID_NATION",
        message: `Ammunition '${a.id}' names nation '${a.nationId}', which is not a stable id.`,
      });
      continue;
    }
    records.push({
      part: {
        id: a.id,
        family: "ammunition",
        provides: "ammunition",
        name: a.id,
        nation: a.nationId,
        lifecycle: {
          availableFrom: a.introductionMonth,
          availableUntil: until,
        },
        spec: {
          shellType: a.shellType,
          ...(a.shellMassG !== undefined ? { shellMassG: a.shellMassG } : {}),
          ...(a.propellantInteractionBp !== undefined
            ? { propellantInteractionBp: a.propellantInteractionBp }
            : {}),
          ...(a.penetrationBiasBp !== undefined ? { penetrationBiasBp: a.penetrationBiasBp } : {}),
          ...(a.explosiveFillerG !== undefined ? { explosiveFillerG: a.explosiveFillerG } : {}),
          ...(a.burstingEffectBp !== undefined ? { burstingEffectBp: a.burstingEffectBp } : {}),
          ...(a.fireEffectBp !== undefined ? { fireEffectBp: a.fireEffectBp } : {}),
          ...(a.storageHazard !== undefined ? { storageHazard: a.storageHazard } : {}),
          ...(a.rateOfFireModifierBp !== undefined
            ? { rateOfFireModifierBp: a.rateOfFireModifierBp }
            : {}),
        },
        quantities:
          a.ammunitionCostMicro === undefined
            ? []
            : [
                {
                  id: "round_cost",
                  kind: "costMicro",
                  value: a.ammunitionCostMicro,
                  basis: "PER_PART_UNIT",
                },
              ],
        revisions: [],
        origin: { sourceFile: AMMUNITION_FILE },
        provenance: {
          sourceStatus: a.provenance.sourceStatus,
          confidence: a.provenance.confidence,
          kind: a.provenance.kind,
          sources: a.provenance.sources.map((s) => ({ ...s })),
          ...(a.provenance.derivation !== undefined
            ? { derivation: { ...a.provenance.derivation } }
            : {}),
          ...(a.provenance.note !== undefined ? { note: a.provenance.note } : {}),
        },
      },
      legacy: {
        ...(a.compatibleGunFamilies !== undefined
          ? { compatibleGunFamilies: [...a.compatibleGunFamilies] }
          : {}),
        ...(a.compatibleGunModelIds !== undefined
          ? { compatibleGunModelIds: [...a.compatibleGunModelIds] }
          : {}),
      },
    });
  }
  return {
    records: records.sort((a, b) => compareCodePoints(a.part.id, b.part.id)),
    unread: unread.sort((a, b) => compareCodePoints(a.id, b.id)),
  };
}

export function ammunitionPatternFromPart(record: AmmunitionPartRecord): ArmamentAmmunitionPattern {
  const { part, legacy } = record;
  const { spec } = part;
  const cost = part.quantities.find((q) => q.id === "round_cost")?.value;
  return {
    id: ammunitionId(part.id),
    shellType: spec.shellType,
    ...(legacy.compatibleGunFamilies !== undefined
      ? { compatibleGunFamilies: legacy.compatibleGunFamilies.map(gunFamilyId) }
      : {}),
    ...(legacy.compatibleGunModelIds !== undefined
      ? { compatibleGunModelIds: legacy.compatibleGunModelIds.map(gunModelId) }
      : {}),
    ...(spec.shellMassG !== undefined ? { shellMassG: spec.shellMassG } : {}),
    ...(spec.propellantInteractionBp !== undefined
      ? { propellantInteractionBp: spec.propellantInteractionBp }
      : {}),
    ...(spec.penetrationBiasBp !== undefined ? { penetrationBiasBp: spec.penetrationBiasBp } : {}),
    ...(spec.explosiveFillerG !== undefined ? { explosiveFillerG: spec.explosiveFillerG } : {}),
    ...(spec.burstingEffectBp !== undefined ? { burstingEffectBp: spec.burstingEffectBp } : {}),
    ...(spec.fireEffectBp !== undefined ? { fireEffectBp: spec.fireEffectBp } : {}),
    ...(spec.storageHazard !== undefined ? { storageHazard: spec.storageHazard } : {}),
    ...(cost !== undefined ? { ammunitionCostMicro: cost } : {}),
    ...(spec.rateOfFireModifierBp !== undefined
      ? { rateOfFireModifierBp: spec.rateOfFireModifierBp }
      : {}),
    introductionMonth: part.lifecycle.availableFrom,
    retirementMonth: retirementMonthFromAvailableUntil(part.lifecycle.availableUntil),
    provenance: part.provenance,
  };
}
