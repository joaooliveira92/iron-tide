// packages/ship-design/src/shipTypeRegistry.ts
// The domain adapter over the compiled ship-type content (ADR-0156, ship-part-model ticket 12b).
//
// Content authors one `ShipTypeRecord` per canonical type; the classification algorithm, the
// predicate functions and the engine behaviour classes stay in code. This adapter maps the records
// into the existing `ShipTypeDefinition` vocabulary and derives the natural classifier's precedence
// order from `classification.precedence`, so the order is authored data while every predicate
// remains a closed code-owned function. Absent records leave callers on the code registry, which
// the 12a regression pins equal to the authored content.
import type { ShipTypeRecord, ShipTypeRequirement } from "@bluewave/content-schema";
import { compareCodePoints } from "@bluewave/deterministic";
import { isClassifiedShipType, type ClassifiedShipType } from "./classificationRules.js";
import { isShipTypeId, type ShipTypeDefinition, type ShipTypeId } from "./shipTypes.js";

/** A compiled ship-type registry: definitions by id, the classifier order and the fit requirements. */
export interface ShipTypeRegistry {
  /** Canonical definitions by id, from the compiled records. */
  readonly byId: ReadonlyMap<ShipTypeId, ShipTypeDefinition>;
  /** Classified types in natural-classifier precedence order (ascending), reproducing `CLASSIFIED_SHIP_TYPES`. */
  readonly classified: readonly ClassifiedShipType[];
  /** Every definition in roster order (`order` ascending), matching `SHIP_TYPE_LIST`. */
  readonly list: readonly ShipTypeDefinition[];
  /** The `classification.requires` predicates by id; absent means the type declares none. */
  readonly requires: ReadonlyMap<ShipTypeId, readonly ShipTypeRequirement[]>;
}

/** The ordinal range `ShipTypeDefinition` uses for cost and build time; the schema checks it. */
type Ordinal = 1 | 2 | 3 | 4 | 5;

function ordinal(value: number): Ordinal {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) return value;
  throw new Error(`ship type ordinal ${value} is outside 1..5`);
}

/** One record's `ShipTypeDefinition`, field for field (the 12a regression pins it to `SHIP_TYPES`). */
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

/** Sort key that never depends on declaration order: precedence ascending, then id by codepoint. */
const byPrecedence = (a: ShipTypeRecord, b: ShipTypeRecord): number =>
  a.classification.precedence - b.classification.precedence || compareCodePoints(a.id, b.id);

/** The natural classifier order a content registry declares: only types with a code predicate, by precedence. */
function classifiedOrder(records: readonly ShipTypeRecord[]): readonly ClassifiedShipType[] {
  return [...records]
    .sort(byPrecedence)
    .map((record) => record.id)
    .filter((id): id is ClassifiedShipType => isClassifiedShipType(id));
}

/**
 * Map compiled ship-type records into the domain registry. A brand-new type is **not** usable
 * from content alone: record ids that are not one of the fourteen canonical tokens are left out
 * of the typed maps (they have no code predicate and no definition in the closed `ShipTypeId`
 * vocabulary), and the availability policy reports them `SHIP_TYPE_UNREGISTERED`. Adding a new
 * usable type needs a code change — a new `ShipTypeId`, its hull-type mapping and its
 * classification predicate (ADR-0156 §1).
 */
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

/**
 * The fit requirements the intended ship type declares, sourced from the context's compiled
 * registry. Absent content or an unknown/non-classified type yields no requirements (the code
 * registry authors none), so a context built without content keeps its existing findings.
 */
export function shipTypeRequirementsFor(
  ctx: { readonly shipTypes?: readonly ShipTypeRecord[] | undefined },
  type: string,
): readonly ShipTypeRequirement[] {
  if (ctx.shipTypes === undefined || !isShipTypeId(type)) return [];
  return shipTypeRegistryFromRecords(ctx.shipTypes).requires.get(type) ?? [];
}
