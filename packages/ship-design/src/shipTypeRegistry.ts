import type { ShipTypeRecord, ShipTypeRequirement } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import { isClassifiedShipType, type ClassifiedShipType } from "./classificationRules.js";
import { isShipTypeId, type ShipTypeDefinition, type ShipTypeId } from "./shipTypes.js";
import { designInvariant } from "./errors.js";

export interface ShipTypeRegistry {
  readonly byId: ReadonlyMap<ShipTypeId, ShipTypeDefinition>;
  readonly classified: readonly ClassifiedShipType[];
  readonly list: readonly ShipTypeDefinition[];
  readonly requires: ReadonlyMap<ShipTypeId, readonly ShipTypeRequirement[]>;
}

type Ordinal = 1 | 2 | 3 | 4 | 5;

function ordinal(value: number): Ordinal {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  throw designInvariant(`ship type ordinal ${value} is outside 1..5`);
}

function definitionFromRecord(
  record: ShipTypeRecord & { readonly id: ShipTypeId },
): ShipTypeDefinition {
  return {
    id: record.id,
    name: record.name,
    engineClass: record.engineClass,
    era: record.era,
    category: record.displayCategory,
    roles: record.roles,
    description: record.presentation.description,
    recommendedUse: record.presentation.recommendedUse,
    weaknesses: record.presentation.weaknesses,
    armourProfile: record.presentation.armourProfile,
    armamentProfile: record.presentation.armamentProfile,
    relativeCost: ordinal(record.relativeCost),
    relativeBuildTime: ordinal(record.relativeBuildTime),
    torpedoes: record.torpedoPolicy,
    auxiliary: record.auxiliary,
    requiredHullTrait: record.requiredHullTrait,
    availability: record.availability,
    order: record.order,
  };
}

const byPrecedence = (a: ShipTypeRecord, b: ShipTypeRecord): number =>
  a.classification.precedence - b.classification.precedence || compareCodePoints(a.id, b.id);

function classifiedOrder(records: readonly ShipTypeRecord[]): readonly ClassifiedShipType[] {
  return [...records]
    .sort(byPrecedence)
    .map((record) => record.id)
    .filter((id): id is ClassifiedShipType => isClassifiedShipType(id));
}

export function shipTypeRegistryFromRecords(records: readonly ShipTypeRecord[]): ShipTypeRegistry {
  const known = records.filter((record): record is ShipTypeRecord & { readonly id: ShipTypeId } =>
    isShipTypeId(record.id),
  );
  const byId = new Map<ShipTypeId, ShipTypeDefinition>();
  const requires = new Map<ShipTypeId, readonly ShipTypeRequirement[]>();
  for (const record of known) {
    byId.set(record.id, definitionFromRecord(record));
    requires.set(record.id, record.classification.requires);
  }
  const list = [...byId.values()].sort(
    (a, b) => a.order - b.order || compareCodePoints(a.id, b.id),
  );
  return { byId, classified: classifiedOrder(records), list, requires };
}

export function shipTypeRequirementsFor(
  ctx: { readonly shipTypes?: readonly ShipTypeRecord[] | undefined },
  type: string,
): readonly ShipTypeRequirement[] {
  if (ctx.shipTypes === undefined || !isShipTypeId(type)) return [];
  return shipTypeRegistryFromRecords(ctx.shipTypes).requires.get(type) ?? [];
}
