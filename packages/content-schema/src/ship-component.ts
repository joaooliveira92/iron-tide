import { Schema } from "effect";

import { ProvenanceSchema } from "./provenance.js";

/** Mirrors `COMPONENT_CATEGORIES` in `@bluewave/ship-design` (a test keeps the two lists identical). */
export const SHIP_COMPONENT_CATEGORIES = [
  "HULL_FORM",
  "MATERIAL",
  "BOILER",
  "ENGINE",
  "SHAFT_PROPELLER",
  "FUEL_BUNKER",
  "GENERATOR",
  "MAIN_GUN",
  "SECONDARY_GUN",
  "TERTIARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
  "TORPEDO_TUBE",
  "MINE_GEAR",
  "AIRCRAFT_FACILITY",
  "MISSILE_LAUNCHER",
  "MOUNT",
  "MAGAZINE",
  "AMMUNITION",
  "ARMOUR_SCHEME",
  "UNDERWATER_PROTECTION",
  "DIRECTOR",
  "RANGEFINDER",
  "RADAR",
  "SONAR",
  "COMMS",
  "SPECIAL_EQUIPMENT",
  "DAMAGE_CONTROL",
  "ACCOMMODATION",
] as const;

export const SHIP_ZONE_IDS = [
  "FORECASTLE",
  "FWD_MAGAZINE",
  "FWD_SERVICE",
  "CENTRAL_MACHINERY",
  "SUPERSTRUCTURE",
  "AFT_SERVICE",
  "AFT_MAGAZINE",
  "QUARTERDECK",
  "MISSION",
] as const;

const int = Schema.Finite.check(Schema.isInt());
const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));
const bp = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 10_000 }));

const month = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "must be YYYY-MM" }),
);
const stableId = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9_]*$/, { message: "must be lower snake_case" }),
);
const formula = Schema.NonEmptyString;

const ParameterRangeSchema = Schema.Struct({
  min: int,
  max: int,
  step: int.check(Schema.isGreaterThanOrEqualTo(1)),
}).check(Schema.makeFilter((r) => (r.min <= r.max ? undefined : "min must be <= max")));

const IntroductionSchema = Schema.Struct({
  fromMonth: month,
  obsoleteMonth: Schema.NullOr(month),
});

/** One catalogue component (spec §6.1). Formulas use the restricted grammar parsed by `@bluewave/ship-design`. */
export const ShipComponentSchema = Schema.Struct({
  id: stableId,
  displayName: Schema.NonEmptyString,
  category: Schema.Literals(SHIP_COMPONENT_CATEGORIES),
  introduction: IntroductionSchema,
  requires: Schema.Array(stableId),
  parameters: Schema.Record(Schema.String, ParameterRangeSchema),
  constants: Schema.Record(Schema.String, int),
  weightKg: formula,
  volumeLitre: formula,
  costMicro: formula,
  crew: formula,
  powerKw: formula,
  upgradePath: Schema.Array(stableId),
  tags: Schema.Array(Schema.NonEmptyString),
  deckFootprintMm2: Schema.optional(formula),
  heightMm: Schema.optional(formula),
  zCgMm: Schema.optional(formula),
  coolingKw: Schema.optional(formula),
  attributes: Schema.optional(Schema.Record(Schema.String, formula)),
  allowedZones: Schema.optional(Schema.Array(Schema.Literals(SHIP_ZONE_IDS))),
  forbidsCoLocation: Schema.optional(Schema.Array(Schema.Literals(SHIP_COMPONENT_CATEGORIES))),
  critical: Schema.optional(Schema.Boolean),
  fcClass: Schema.optional(Schema.NonEmptyString),
  fcClasses: Schema.optional(Schema.Array(Schema.NonEmptyString)),
  torpedoMount: Schema.optional(
    Schema.Struct({ mountType: Schema.NonEmptyString, torpedoModelId: Schema.NonEmptyString }),
  ),
  maintenanceMonthlyBp: Schema.optional(nonNegativeInt),
  buildWorkMicro: Schema.optional(formula),
  productionLine: Schema.optional(Schema.NonEmptyString),
  provenance: Schema.optional(ProvenanceSchema),
});

export const ShipComponentCatalogueSchema = Schema.Struct({
  components: Schema.Array(ShipComponentSchema),
});

export const PropulsionPlantSchema = Schema.Struct({
  id: stableId,
  fuelType: Schema.Literals(["COAL", "OIL", "MIXED"]),
  weightMilliKgPerKw: positiveInt,
  volumeLitrePerKw: positiveInt,
  sfcGramPerKwh: Schema.Struct({
    points: Schema.Array(Schema.Tuple([int, int])).check(Schema.isMinLength(1)),
  }),
  reliabilityBp: bp,
  minKw: int.check(Schema.isGreaterThanOrEqualTo(1)),
  maxKw: int.check(Schema.isGreaterThanOrEqualTo(1)),
  introduction: IntroductionSchema,
  requires: Schema.Array(stableId),
  provenance: Schema.optional(ProvenanceSchema),
}).check(Schema.makeFilter((p) => (p.minKw <= p.maxKw ? undefined : "minKw must be <= maxKw")));

export const PropulsionPlantCatalogueSchema = Schema.Struct({
  plants: Schema.Array(PropulsionPlantSchema),
});

export const SHIP_HULL_TRAITS = ["merchant_derived"] as const;

const ShipZoneSchema = Schema.Struct({
  id: Schema.Literals(SHIP_ZONE_IDS),
  startPermille: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: 1000 }),
  ),
  endPermille: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 1000 })),
  volumeBp: bp,
  deckAreaBp: bp,
  buoyancyBp: bp,
});

export const ShipHullFormSchema = Schema.Struct({
  id: stableId,
  lengthMinMm: positiveInt,
  lengthMaxMm: positiveInt,
  lbMinX100: positiveInt,
  lbMaxX100: positiveInt,
  formBp: positiveInt,
  waterplaneCoeffBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 10_000 }),
  ),
  sheerBp: positiveInt,
  volumeFullnessBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 10_000 }),
  ),
  deckFullnessBp: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 1, maximum: 10_000 }),
  ),
  lcbPermille: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 1000 })),
  /** What the hull form is for: `merchant_derived` hulls may be designed as armed merchant cruisers (DESIGN-22 section 15). */
  traits: Schema.optional(
    Schema.Array(Schema.Literals(SHIP_HULL_TRAITS)).check(Schema.isMaxLength(4)),
  ),
  zones: Schema.Array(ShipZoneSchema).check(Schema.isMinLength(9), Schema.isMaxLength(9)),
  provenance: Schema.optional(ProvenanceSchema),
})
  .check(
    Schema.makeFilter((h) =>
      h.lengthMinMm <= h.lengthMaxMm && h.lbMinX100 <= h.lbMaxX100
        ? undefined
        : "min must be <= max",
    ),
  )
  .check(
    Schema.makeFilter((h) =>
      h.zones.reduce((a, z) => a + z.volumeBp, 0) === 10_000
        ? undefined
        : "zone volumeBp must sum to 10000",
    ),
  )
  .check(
    Schema.makeFilter((h) =>
      h.zones.reduce((a, z) => a + z.deckAreaBp, 0) === 10_000
        ? undefined
        : "zone deckAreaBp must sum to 10000",
    ),
  )
  .check(
    Schema.makeFilter((h) =>
      h.zones.reduce((a, z) => a + z.buoyancyBp, 0) === 10_000
        ? undefined
        : "zone buoyancyBp must sum to 10000",
    ),
  );

export const ShipHullFormCatalogueSchema = Schema.Struct({
  hullForms: Schema.Array(ShipHullFormSchema),
});

export type ShipComponentData = typeof ShipComponentSchema.Type;
export type PropulsionPlantData = typeof PropulsionPlantSchema.Type;
export type ShipHullFormData = typeof ShipHullFormSchema.Type;
