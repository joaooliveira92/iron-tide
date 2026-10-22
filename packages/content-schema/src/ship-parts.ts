import { Schema } from "effect";

import { TORPEDO_MOUNT_TYPE_VALUES } from "./design.js";
import { ProvenanceSchema } from "./provenance.js";
import {
  ARMOUR_REGION_IDS,
  ARMOUR_SCHEME_IDS,
  DesignRequirementSchema,
  HullSpecSchema,
  MOUNT_SIDES,
} from "./reference-design.js";
import { SHIP_ZONE_IDS } from "./ship-component.js";
import { PartVisualOverridesSchema } from "./visual-traits.js";

export const PART_INTERFACES = [
  "gun",
  "gun_mount",
  "ammunition",
  "torpedo",
  "torpedo_launcher",
  "propulsion_plant",
  "armour_material",
  "sensor",
  "magazine",
  "funnel",
  "electrical_plant",
  "accommodation",
  "damage_control",
  "ventilation",
] as const;

export const PART_FAMILIES = [
  "gun",
  "gun_mount",
  "ammunition",
  "torpedo_launcher",
  "torpedo",
  "propulsion_plant",
  "armour_material",
  "sensor",
  "fitting",
] as const;

export const APPLICATION_BASES = [
  "PER_LOADOUT_ENTRY",
  "PER_PART_UNIT",
  "PER_CONTAINED_UNIT",
] as const;

export const ACCOUNTING_QUANTITY_KINDS = [
  "massKg",
  "costMicro",
  "crew",
  "volumeLitre",
  "deckFootprintMm2",
] as const;

export const QUANTITY_KINDS = [...ACCOUNTING_QUANTITY_KINDS, "lengthMm", "powerKw"] as const;

export const QUANTITY_KIND_UNITS = {
  massKg: "kg",
  costMicro: "micro-currency",
  crew: "persons",
  volumeLitre: "L",
  deckFootprintMm2: "mm2",
  lengthMm: "mm",
  powerKw: "kW",
} as const satisfies Record<(typeof QUANTITY_KINDS)[number], string>;

export const PRODUCTION_LINES = [
  "slipway",
  "armour_plate",
  "heavy_gun",
  "machinery",
  "quay",
  "trials",
  "fit_out",
] as const;

export const LEGACY_EXCEPTION_CODES = ["DQ-TORPEDO-001"] as const;

export const WAIVABLE_CONSTRAINTS = ["diameterUmEqualsBore"] as const;

export const GUN_MOUNT_TYPES = [
  "TURRET",
  "BARBETTE",
  "CASEMATE",
  "DECK_SHIELDED",
  "DECK_OPEN",
  "BROADSIDE_BATTERY",
] as const;

export const ENGINE_BEHAVIOUR_CLASSES = [
  "capital_combatant",
  "cruiser",
  "torpedo_craft",
  "colonial_vessel",
  "merchant_auxiliary",
  "aviation",
  "submarine",
] as const;

export const SHIP_TYPE_DISPLAY_CATEGORIES = [
  "CAPITAL_SHIP",
  "CRUISER",
  "LIGHT_COMBATANT",
  "COLONIAL_VESSEL",
  "AUXILIARY",
  "AVIATION",
  "SUBMARINE",
] as const;

export const SHIP_TYPE_ROLES = [
  "BATTLE_LINE",
  "FLEET_SCOUTING",
  "COMMERCE_PROTECTION",
  "COMMERCE_RAIDING",
  "COLONIAL_PRESENCE",
  "CRUISER_HUNTING",
  "PATROL",
  "FOREIGN_STATION",
  "SCREENING",
  "TORPEDO_ATTACK",
  "COASTAL_DEFENCE",
  "MINELAYING",
  "LOCAL_DEFENCE",
  "AVIATION",
  "UNDERSEA",
  "TRANSPORT",
] as const;

export const SHIP_TYPE_ERA_BANDS = ["EARLY", "PRE_WAR", "INTERWAR", "MID_CENTURY", "LATE"] as const;

export const TORPEDO_POLICIES = ["REQUIRED", "PROHIBITED", "OPTIONAL"] as const;

export const SHIP_TYPE_HULL_TRAITS = ["merchant_derived"] as const;

export type PartInterface = (typeof PART_INTERFACES)[number];
export type PartFamily = (typeof PART_FAMILIES)[number];
export type ApplicationBasis = (typeof APPLICATION_BASES)[number];
export type QuantityKind = (typeof QUANTITY_KINDS)[number];
export type LegacyExceptionCode = (typeof LEGACY_EXCEPTION_CODES)[number];
export type EngineBehaviourClass = (typeof ENGINE_BEHAVIOUR_CLASSES)[number];
export type ProductionLine = (typeof PRODUCTION_LINES)[number];
export type ShipZoneId = (typeof SHIP_ZONE_IDS)[number];

const int = Schema.Finite.check(Schema.isInt());
const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));
const positiveInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThan(0));
const bp = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 10_000 }));
const per100k = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 100_000 }),
);
const permille = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: 0, maximum: 1000 }),
);
const degrees = Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 360 }));
const signedDegrees = Schema.Finite.check(
  Schema.isInt(),
  Schema.isBetween({ minimum: -90, maximum: 90 }),
);
const month = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "must be YYYY-MM" }),
);
const stableId = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9_]*$/, { message: "must be lower snake_case" }),
);
const shipTypeId = Schema.String.check(
  Schema.isPattern(/^[A-Z][A-Z0-9]*$/, { message: "must be an upper-case ship-type token" }),
);
const slotId = Schema.String.check(
  Schema.isPattern(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/, {
    message: "must be lower snake_case, optionally dotted",
  }),
);
const parameterName = Schema.String.check(
  Schema.isPattern(/^[a-z][A-Za-z0-9_]*$/, { message: "must be a lowerCamel field name" }),
);
const nonEmptyArray = <S extends Schema.Top>(item: S) =>
  Schema.Array(item).check(Schema.isMinLength(1));

const InterfaceSchema = Schema.Literals(PART_INTERFACES);

const RangeSchema = Schema.Struct({ min: nonNegativeInt, max: nonNegativeInt }).check(
  Schema.makeFilter((r) => (r.min <= r.max ? undefined : "min must be <= max")),
);

const UnitRangeSchema = Schema.Struct({
  min: positiveInt,
  max: positiveInt,
  step: positiveInt,
}).check(Schema.makeFilter((r) => (r.min <= r.max ? undefined : "min must be <= max")));

const ParameterRangeSchema = Schema.Struct({
  min: int,
  max: int,
  step: int.check(Schema.isGreaterThanOrEqualTo(1)),
}).check(Schema.makeFilter((r) => (r.min <= r.max ? undefined : "min must be <= max")));

export const PartLifecycleSchema = Schema.Struct({
  availableFrom: month,
  availableUntil: Schema.optional(Schema.NullOr(month)),
  requires: Schema.optional(Schema.Array(stableId)),
  supersedes: Schema.optional(Schema.Array(stableId)),
}).check(
  Schema.makeFilter((l) =>
    l.availableUntil === undefined ||
    l.availableUntil === null ||
    l.availableUntil > l.availableFrom
      ? undefined
      : "availableUntil must be after availableFrom",
  ),
);

export const QuantityComponentSchema = Schema.Struct({
  id: stableId,
  kind: Schema.Literals(ACCOUNTING_QUANTITY_KINDS),
  value: nonNegativeInt,
  basis: Schema.Literals(APPLICATION_BASES),
});

export const LengthMmSchema = nonNegativeInt;

export const PowerComponentSchema = Schema.Struct({
  id: stableId,
  kind: Schema.Literal("powerKw"),
  value: nonNegativeInt,
  basis: Schema.Literals(APPLICATION_BASES),
});

const uniqueIds = (list: ReadonlyArray<{ readonly id: string }>) =>
  new Set(list.map((c) => c.id)).size === list.length ? undefined : "component ids must be unique";

const PowerComponentList = nonEmptyArray(PowerComponentSchema).check(
  Schema.makeFilter((list) => uniqueIds(list)),
);

export const PART_LOCAL_DATUMS = ["PART_BASE"] as const;

export const PhysicalEngineeringSchema = Schema.Struct({
  envelopeHeightMm: LengthMmSchema,
  centreOfGravity: Schema.Struct({
    zMm: LengthMmSchema,
    datum: Schema.Literals(PART_LOCAL_DATUMS),
  }),
});

export const PowerEngineeringSchema = Schema.Struct({
  generation: Schema.optional(PowerComponentList),
  consumption: Schema.optional(PowerComponentList),
}).check(
  Schema.makeFilter((p) =>
    p.generation !== undefined || p.consumption !== undefined
      ? undefined
      : "declare generation or consumption, or omit power",
  ),
);

export const CoolingEngineeringSchema = Schema.Struct({
  demand: Schema.optional(PowerComponentList),
  supply: Schema.optional(PowerComponentList),
}).check(
  Schema.makeFilter((c) =>
    c.demand !== undefined || c.supply !== undefined
      ? undefined
      : "declare demand or supply, or omit cooling",
  ),
);

export const MaintenanceEngineeringSchema = Schema.Struct({ monthlyBpOfCost: bp });

export const FlammabilityEngineeringSchema = Schema.Struct({ indexBp: bp });

export const EngineeringSchema = Schema.Struct({
  physical: Schema.optional(PhysicalEngineeringSchema),
  power: Schema.optional(PowerEngineeringSchema),
  cooling: Schema.optional(CoolingEngineeringSchema),
  maintenance: Schema.optional(MaintenanceEngineeringSchema),
  flammability: Schema.optional(FlammabilityEngineeringSchema),
});

export const FIRE_CONTROL_CLASSES = ["heavy", "medium", "light"] as const;

export const CAPABILITY_KINDS = [
  "ammunition_feed",
  "arc_obstruction",
  "damage_control",
  "fire_control_class",
  "fire_control_support",
] as const;

const FireControlClass = Schema.Literals(FIRE_CONTROL_CLASSES);

export const CapabilitySchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("fire_control_class"), class: FireControlClass }),
  Schema.Struct({
    kind: Schema.Literal("fire_control_support"),
    classes: nonEmptyArray(FireControlClass).check(
      Schema.makeFilter((c) => (new Set(c).size === c.length ? undefined : "classes must differ")),
    ),
  }),
  Schema.Struct({ kind: Schema.Literal("ammunition_feed"), maxFeedPermille: permille }),
  Schema.Struct({
    kind: Schema.Literal("arc_obstruction"),
    blockedDeg: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 360 })),
    reachPermille: permille,
  }),
  Schema.Struct({ kind: Schema.Literal("damage_control"), effectBp: bp }),
]);

export const CapabilitiesSchema = Schema.Array(CapabilitySchema).check(
  Schema.isMinLength(1),
  Schema.makeFilter((list) => {
    const kinds = list.map((c) => c.kind);
    if (new Set(kinds).size !== kinds.length) return "capability kinds must be unique";
    const sorted = [...kinds].sort();
    return kinds.every((k, i) => k === sorted[i])
      ? undefined
      : "capabilities must be sorted by kind";
  }),
);

export const PART_TAGS = [
  "accommodation",
  "damage_control",
  "electrical",
  "fire_control",
  "funnel",
  "gun",
  "heavy",
  "light",
  "magazine",
  "medium",
  "smoothbore",
  "torpedo",
  "ventilation",
] as const;

export type PartTag = (typeof PART_TAGS)[number];

export const PartMetadataSchema = Schema.Struct({
  displayName: Schema.optional(Schema.NonEmptyString),
  tags: Schema.optional(
    Schema.Array(Schema.Literals(PART_TAGS)).check(
      Schema.isMinLength(1),
      Schema.makeFilter((tags) => {
        for (let i = 1; i < tags.length; i++) {
          const a = tags[i - 1]!;
          const b = tags[i]!;
          if (a === b) return `duplicate tag '${b}'`;
          if (a > b) return "tags must be sorted in codepoint order";
        }
        return undefined;
      }),
    ),
  ),
});

export const LegacyExceptionSchema = Schema.Struct({
  code: Schema.Literals(LEGACY_EXCEPTION_CODES),
  waives: Schema.Literals(WAIVABLE_CONSTRAINTS),
  forPart: stableId,
  note: Schema.NonEmptyString,
});

export const PartVisualSchema = Schema.Struct({
  traits: Schema.optional(PartVisualOverridesSchema),
  override: Schema.optional(stableId),
});

export const SlotConstraintsSchema = Schema.Struct({
  calibreInchesMin: Schema.optional(nonNegativeInt),
  calibreInchesMax: Schema.optional(nonNegativeInt),
  mountTypes: Schema.optional(nonEmptyArray(Schema.Literals(GUN_MOUNT_TYPES))),
  gunsPerMount: Schema.optional(nonEmptyArray(positiveInt)),
  diameterUmMin: Schema.optional(nonNegativeInt),
  diameterUmMax: Schema.optional(nonNegativeInt),
  diameterUmEqualsBore: Schema.optional(Schema.Literal(true)),
  launchTypes: Schema.optional(nonEmptyArray(Schema.Literals(TORPEDO_MOUNT_TYPE_VALUES))),
  massKgMax: Schema.optional(nonNegativeInt),
});

export const SlotSchema = Schema.Struct({
  id: slotId,
  accepts: Schema.optional(nonEmptyArray(InterfaceSchema)),
  mountCount: Schema.optional(RangeSchema),
  zone: Schema.optional(Schema.Literals(SHIP_ZONE_IDS)),
  region: Schema.optional(Schema.Literals(ARMOUR_REGION_IDS)),
  stationPermille: Schema.optional(
    Schema.Struct({ from: permille, to: permille }).check(
      Schema.makeFilter((r) => (r.from <= r.to ? undefined : "from must be <= to")),
    ),
  ),
  side: Schema.optional(Schema.Literals(MOUNT_SIDES)),
  arcDeg: Schema.optional(Schema.Struct({ centre: degrees, width: degrees })),
  constraints: Schema.optional(SlotConstraintsSchema),
  sameParts: Schema.optional(Schema.Boolean),
  mirrors: Schema.optional(slotId),
}).check(
  Schema.makeFilter((s) => {
    if (s.mirrors === undefined) {
      return s.accepts === undefined ? "a slot must declare accepts or mirrors" : undefined;
    }
    return Object.keys(s).every((key) => key === "id" || key === "mirrors")
      ? undefined
      : "a mirroring slot declares only id and mirrors";
  }),
);

export const SlotTemplateSchema = Schema.Struct({
  id: stableId,
  slots: nonEmptyArray(SlotSchema),
  provenance: Schema.optional(ProvenanceSchema),
});

export const PlatformLifecycleSchema = Schema.Struct({
  availableFrom: month,
  availableUntil: Schema.optional(Schema.NullOr(month)),
}).check(
  Schema.makeFilter((l) =>
    l.availableUntil === undefined ||
    l.availableUntil === null ||
    l.availableUntil > l.availableFrom
      ? undefined
      : "availableUntil must be after availableFrom",
  ),
);

export const PlatformSchema = Schema.Struct({
  id: stableId,
  hullForm: stableId,
  lifecycle: Schema.optional(PlatformLifecycleSchema),
  slotTemplates: Schema.Array(stableId),
  slots: Schema.optional(Schema.Array(SlotSchema)),
  provenance: Schema.optional(ProvenanceSchema),
}).check(
  Schema.makeFilter((p) =>
    p.slotTemplates.length > 0 || (p.slots?.length ?? 0) > 0
      ? undefined
      : "a platform declares at least one slot template or slot",
  ),
);

export const GUN_WEAPON_CATEGORIES = [
  "MAIN_GUN",
  "SECONDARY_GUN",
  "DUAL_PURPOSE_GUN",
  "AA_WEAPON",
] as const;

const GunSpecFields = {
  gunFamily: Schema.optional(stableId),
  weaponCategory: Schema.optional(Schema.Literals(GUN_WEAPON_CATEGORIES)),
  supportedMountTypes: Schema.optional(
    nonEmptyArray(Schema.Literals(GUN_MOUNT_TYPES)).check(
      Schema.makeFilter((t) =>
        new Set(t).size === t.length ? undefined : "mount types must differ",
      ),
    ),
  ),
  firstClassArmament: Schema.optional(Schema.Literal(true)),
  beamArcDeg: Schema.optional(degrees),
  calibreUm: positiveInt,
  barrelLengthCalibers: Schema.optional(Schema.Finite.check(Schema.isGreaterThan(0))),
  gunMassKg: Schema.optional(nonNegativeInt),
  loadingSystem: Schema.optional(Schema.NonEmptyString),
  nominalMuzzleVelocityUmPerSec: Schema.optional(positiveInt),
  mechanicalRateOfFireRoundsPerMinuteX100: Schema.optional(positiveInt),
  propellantChargeBp: Schema.optional(nonNegativeInt),
  shellMassG: Schema.optional(nonNegativeInt),
  roundVolumeMl: Schema.optional(nonNegativeInt),
  reliabilityBp: Schema.optional(bp),
};

const GunMountSpecFields = {
  mountType: Schema.Literals(GUN_MOUNT_TYPES),
  gunsPerMount: positiveInt,
  compatibleGunFamilies: Schema.optional(nonEmptyArray(stableId)),
  compiledMountId: Schema.optional(stableId),
  hullSpaceUsageLitre: Schema.optional(nonNegativeInt),
  topWeightKg: Schema.optional(nonNegativeInt),
  supportedArmorMm: Schema.optional(nonNegativeInt),
  traverseDeg: Schema.optional(degrees),
  elevationMinDeg: Schema.optional(signedDegrees),
  elevationMaxDeg: Schema.optional(signedDegrees),
  firingArcDeg: Schema.optional(degrees),
  rateOfFireModifierBp: Schema.optional(nonNegativeInt),
  ammunitionHandlingModifierBp: Schema.optional(nonNegativeInt),
  crewProtection: Schema.optional(Schema.NonEmptyString),
  stabilityContributionKgM: Schema.optional(int),
  vulnerability: Schema.optional(Schema.NonEmptyString),
};

const AmmunitionSpecFields = {
  shellType: Schema.Literals(["AP", "APC", "CPC", "SAP", "HE", "MELINITE"]),
  compatibleGunFamilies: Schema.optional(nonEmptyArray(stableId)),
  compatibleGunModels: Schema.optional(nonEmptyArray(stableId)),
  shellMassG: Schema.optional(nonNegativeInt),
  propellantInteractionBp: Schema.optional(nonNegativeInt),
  penetrationBiasBp: Schema.optional(bp),
  explosiveFillerG: Schema.optional(nonNegativeInt),
  burstingEffectBp: Schema.optional(nonNegativeInt),
  fireEffectBp: Schema.optional(nonNegativeInt),
  storageHazard: Schema.optional(Schema.NonEmptyString),
  rateOfFireModifierBp: Schema.optional(nonNegativeInt),
};

export const TORPEDO_WARHEAD_TYPES = [
  "WET_GUNCOTTON",
  "TNT",
  "TORPEX",
  "TPX",
  "HBX",
  "HEXANITE",
  "TYPE_97",
] as const;

export const TORPEDO_PROPULSION_TYPES = [
  "COMPRESSED_AIR",
  "WET_HEATER",
  "ELECTRIC",
  "OXYGEN",
] as const;

export const TORPEDO_TUBE_HIT_HAZARD_POLICIES = ["ORDINARY", "OXYGEN", "ELECTRIC"] as const;

export type TorpedoWarheadType = (typeof TORPEDO_WARHEAD_TYPES)[number];
export type TorpedoPropulsionType = (typeof TORPEDO_PROPULSION_TYPES)[number];
export type TorpedoTubeHitHazardPolicy = (typeof TORPEDO_TUBE_HIT_HAZARD_POLICIES)[number];
export const TorpedoSpeedSettingSchema = Schema.Struct({
  settingId: Schema.String.check(
    Schema.isPattern(/^[a-z0-9][a-z0-9_]*$/, { message: "must be lower snake_case" }),
  ),
  speedMilliKnots: positiveInt,
  rangeM: positiveInt,
});

const TorpedoSpecFields = {
  diameterUm: positiveInt,
  massKg: positiveInt,
  warheadType: Schema.Literals(TORPEDO_WARHEAD_TYPES),
  warheadExplosiveMassKg: nonNegativeInt,
  warheadExplosiveEquivalentMassKg: nonNegativeInt,
  propulsionType: Schema.Literals(TORPEDO_PROPULSION_TYPES),
  speedSettings: nonEmptyArray(TorpedoSpeedSettingSchema),
  minimumArmingDistanceM: nonNegativeInt,
  reliabilityBp: per100k,
  guidanceCapability: stableId,
  launchTypes: nonEmptyArray(Schema.Literals(TORPEDO_MOUNT_TYPE_VALUES)),
  technologyPrerequisiteIds: Schema.Array(stableId),
  tubeHitHazardPolicy: Schema.Literals(TORPEDO_TUBE_HIT_HAZARD_POLICIES),
  oxygenWakeVisibilityModifierBp: Schema.optional(bp),
};

const TorpedoLauncherSpecFields = {
  launchType: Schema.Literals(TORPEDO_MOUNT_TYPE_VALUES),
  loadsTorpedo: Schema.optional(stableId),
  boreDiameterUm: positiveInt,
  reloadsPerTube: Schema.optional(nonNegativeInt),
};

const PropulsionPlantSpecFields = {
  fuelType: Schema.Literals(["COAL", "OIL", "MIXED"]),
  weightMilliKgPerKw: positiveInt,
  volumeLitrePerKw: positiveInt,
  sfcGramPerKwh: Schema.Struct({
    points: Schema.Array(Schema.Tuple([int, int])).check(Schema.isMinLength(1)),
  }),
  reliabilityBp: bp,
};

const ArmourMaterialSpecFields = {
  efficiencyBp: positiveInt,
};

const SensorSpecFields = {
  accuracyBonusBp: Schema.optional(bp),
  gunCapacity: Schema.optional(positiveInt),
};

const FittingSpecFields = {
  magazineLitre: Schema.optional(nonNegativeInt),
  flashProtectionBp: Schema.optional(bp),
  critical: Schema.optional(Schema.Boolean),
};

const FAMILY_INTERFACES = {
  gun: ["gun"],
  gun_mount: ["gun_mount"],
  ammunition: ["ammunition"],
  torpedo_launcher: ["torpedo_launcher"],
  torpedo: ["torpedo"],
  propulsion_plant: ["propulsion_plant"],
  armour_material: ["armour_material"],
  sensor: ["sensor"],
  fitting: [
    "magazine",
    "funnel",
    "electrical_plant",
    "accommodation",
    "damage_control",
    "ventilation",
  ],
} as const satisfies Record<PartFamily, readonly PartInterface[]>;

type OptionalFields<F extends Schema.Struct.Fields> = {
  readonly [K in keyof F]: Schema.optionalKey<F[K]>;
};

function optionalFields<F extends Schema.Struct.Fields>(fields: F): OptionalFields<F> {
  const out: Partial<Record<keyof F, Schema.Top>> = {};
  for (const key of Object.keys(fields) as Array<keyof F>) {
    out[key] = Schema.optionalKey(fields[key]);
  }
  return out as OptionalFields<F>;
}

function revisionSchema<S extends Schema.Top>(specDelta: S) {
  return Schema.Struct({
    from: month,
    spec: specDelta,
    requires: Schema.optional(Schema.Array(stableId)),
    provenance: ProvenanceSchema,
  });
}

function requiredKeys(fields: Schema.Struct.Fields): readonly string[] {
  return Object.keys(fields).filter((key) => fields[key]?.ast.context?.isOptional !== true);
}

function legacyExceptionsOnLauncherOnly(part: {
  readonly family: PartFamily;
  readonly legacyExceptions?: ReadonlyArray<unknown> | undefined;
}) {
  return part.legacyExceptions === undefined || part.family === "torpedo_launcher"
    ? undefined
    : {
        path: ["legacyExceptions"],
        issue: "a legacy exception is admissible on a torpedo_launcher record only",
      };
}

export const PartOriginSchema = Schema.Struct({
  sourceFile: Schema.NonEmptyString,
  prototype: Schema.optional(
    Schema.Struct({
      id: stableId,
      sourceFile: Schema.NonEmptyString,
      inheritedSpec: Schema.Array(Schema.NonEmptyString),
      inheritedQuantities: Schema.Array(stableId),
    }),
  ),
});

function envelopeFields<const F extends PartFamily>(family: F) {
  return {
    id: stableId,
    family: Schema.Literal(family),
    provides: Schema.Literals(FAMILY_INTERFACES[family]),
    name: Schema.NonEmptyString,
    nation: Schema.optional(stableId),
    lifecycle: PartLifecycleSchema,
    parameters: Schema.optional(Schema.Record(parameterName, ParameterRangeSchema)),
    slots: Schema.optional(Schema.Array(SlotSchema)),
    legacyExceptions: Schema.optional(Schema.Array(LegacyExceptionSchema)),
    visual: Schema.optional(PartVisualSchema),
    entryUnits: Schema.optional(UnitRangeSchema),
    allowedZones: Schema.optional(
      nonEmptyArray(Schema.Literals(SHIP_ZONE_IDS)).check(
        Schema.makeFilter((zones) =>
          new Set(zones).size === zones.length ? undefined : "allowedZones must be unique",
        ),
      ),
    ),
    forbidsCoLocation: Schema.optional(
      nonEmptyArray(InterfaceSchema).check(
        Schema.makeFilter((ifaces) =>
          new Set(ifaces).size === ifaces.length
            ? undefined
            : "forbidsCoLocation entries must differ",
        ),
      ),
    ),
    buildWorkMicro: Schema.optional(nonNegativeInt),
    productionLine: Schema.optional(Schema.Literals(PRODUCTION_LINES)),
    engineering: Schema.optional(EngineeringSchema),
    capabilities: Schema.optional(CapabilitiesSchema),
    metadata: Schema.optional(PartMetadataSchema),
    provenance: ProvenanceSchema,
    origin: Schema.optional(PartOriginSchema),
  };
}

function partMember<const F extends PartFamily, const SpecFields extends Schema.Struct.Fields>(
  family: F,
  specFields: SpecFields,
) {
  const delta = Schema.Struct(optionalFields(specFields));
  const required = requiredKeys(specFields);
  return Schema.Struct({
    ...envelopeFields(family),
    extends: Schema.optional(stableId),
    spec: delta,
    quantities: Schema.optional(Schema.Array(QuantityComponentSchema)),
    revisions: Schema.optional(Schema.Array(revisionSchema(delta))),
  }).check(
    Schema.makeFilter((part) => {
      const misplaced = legacyExceptionsOnLauncherOnly(part);
      if (part.extends !== undefined) return misplaced;
      const missing = required.filter((key) => !Object.hasOwn(part.spec, key));
      return [
        ...missing.map((key) => ({ path: ["spec", key], issue: "Missing key" })),
        ...(misplaced === undefined ? [] : [misplaced]),
      ];
    }),
  );
}

export const PartSchema = Schema.Union([
  partMember("gun", GunSpecFields),
  partMember("gun_mount", GunMountSpecFields),
  partMember("ammunition", AmmunitionSpecFields),
  partMember("torpedo_launcher", TorpedoLauncherSpecFields),
  partMember("torpedo", TorpedoSpecFields),
  partMember("propulsion_plant", PropulsionPlantSpecFields),
  partMember("armour_material", ArmourMaterialSpecFields),
  partMember("sensor", SensorSpecFields),
  partMember("fitting", FittingSpecFields),
]).annotate({
  message: `expected a part record whose family is one of ${PART_FAMILIES.join(", ")}`,
});

function flattenedMember<const F extends PartFamily, const SpecFields extends Schema.Struct.Fields>(
  family: F,
  specFields: SpecFields,
) {
  return Schema.Struct({
    ...envelopeFields(family),
    spec: Schema.Struct(specFields),
    quantities: Schema.Array(QuantityComponentSchema),
    revisions: Schema.Array(revisionSchema(Schema.Struct(optionalFields(specFields)))),
    origin: PartOriginSchema,
  }).check(Schema.makeFilter(legacyExceptionsOnLauncherOnly));
}

export const FlattenedPartSchema = Schema.Union([
  flattenedMember("gun", GunSpecFields),
  flattenedMember("gun_mount", GunMountSpecFields),
  flattenedMember("ammunition", AmmunitionSpecFields),
  flattenedMember("torpedo_launcher", TorpedoLauncherSpecFields),
  flattenedMember("torpedo", TorpedoSpecFields),
  flattenedMember("propulsion_plant", PropulsionPlantSpecFields),
  flattenedMember("armour_material", ArmourMaterialSpecFields),
  flattenedMember("sensor", SensorSpecFields),
  flattenedMember("fitting", FittingSpecFields),
]);

export const PartLineageSchema = Schema.Struct({
  prototype: Schema.optional(stableId),
  variants: Schema.Array(stableId),
  supersedes: Schema.Array(stableId),
  supersededBy: Schema.Array(stableId),
});

export const ShipTypeRequirementSchema = Schema.Struct({
  slot: slotId,
  interface: InterfaceSchema,
  constraints: SlotConstraintsSchema,
  mountCountMin: Schema.optional(positiveInt),
});

export const ShipTypeClassificationSchema = Schema.Struct({
  precedence: int,
  requires: Schema.Array(ShipTypeRequirementSchema),
});

export const ShipTypeAvailabilitySchema = Schema.Struct({
  fromEra: Schema.Literals(SHIP_TYPE_ERA_BANDS),
  requiresTech: Schema.NullOr(stableId),
  requiresCapability: Schema.NullOr(stableId),
  mechanicsImplemented: Schema.Boolean,
});

export const ShipTypePresentationSchema = Schema.Struct({
  description: Schema.NonEmptyString,
  recommendedUse: Schema.NonEmptyString,
  weaknesses: Schema.NonEmptyString,
  armourProfile: Schema.NonEmptyString,
  armamentProfile: Schema.NonEmptyString,
});

export const ShipTypeRecordSchema = Schema.Struct({
  id: shipTypeId,
  name: Schema.NonEmptyString,
  engineClass: Schema.Literals(ENGINE_BEHAVIOUR_CLASSES),
  displayCategory: Schema.Literals(SHIP_TYPE_DISPLAY_CATEGORIES),
  roles: nonEmptyArray(Schema.Literals(SHIP_TYPE_ROLES)),
  era: Schema.Literals(SHIP_TYPE_ERA_BANDS),
  availability: ShipTypeAvailabilitySchema,
  classification: ShipTypeClassificationSchema,
  torpedoPolicy: Schema.Literals(TORPEDO_POLICIES),
  relativeCost: int.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
  relativeBuildTime: int.check(Schema.isBetween({ minimum: 1, maximum: 5 })),
  auxiliary: Schema.Boolean,
  requiredHullTrait: Schema.NullOr(Schema.Literals(SHIP_TYPE_HULL_TRAITS)),
  presentation: ShipTypePresentationSchema,
  order: int,
  provenance: ProvenanceSchema,
});

export const PartIndexSchema = Schema.Struct({
  byId: Schema.Record(stableId, FlattenedPartSchema),
  byInterface: Schema.Record(stableId, Schema.Array(stableId)),
  byFamily: Schema.Record(stableId, Schema.Array(stableId)),
  lineage: Schema.Record(stableId, PartLineageSchema),
  shipTypes: Schema.Array(ShipTypeRecordSchema),
});

export const CompiledPartModelSchema = Schema.Struct({
  partIndex: PartIndexSchema,
  slotTemplates: Schema.Array(SlotTemplateSchema),
  platforms: Schema.Array(PlatformSchema),
});

export type FlattenedPart = typeof FlattenedPartSchema.Type;
export type PartIndex = typeof PartIndexSchema.Type;
export type CompiledPartModel = typeof CompiledPartModelSchema.Type;
export type ShipTypeRecord = typeof ShipTypeRecordSchema.Type;
export type ShipTypeRequirement = typeof ShipTypeRequirementSchema.Type;

export interface ResolvedPartRevision {
  readonly revision: string;
  readonly spec: Readonly<Record<string, unknown>>;
}

export function resolvePartRevision(part: FlattenedPart, month: string): ResolvedPartRevision {
  let spec: Record<string, unknown> = { ...part.spec };
  let revision = "base";
  for (const entry of part.revisions) {
    if (entry.from > month) break;
    spec = { ...spec, ...entry.spec };
    revision = entry.from;
  }
  return { revision, spec };
}

const UnitPlacementSchema = Schema.Struct({
  stationPermille: permille,
  side: Schema.optional(Schema.Literals(MOUNT_SIDES)),
});

const ArmourShapeSchema = Schema.Struct({
  thicknessUm: positiveInt,
  lengthMm: positiveInt,
  heightMm: positiveInt,
  cosObliquityBp: bp,
});

export const DEFAULT_MOUNT_COUNT = 1;

const entryFields = {
  id: Schema.optional(stableId),
  part: stableId,
  mountCount: Schema.optional(positiveInt),
  stationPermille: Schema.optional(permille),
  side: Schema.optional(Schema.Literals(MOUNT_SIDES)),
  units: Schema.optional(nonEmptyArray(UnitPlacementSchema)),
  params: Schema.optional(Schema.Record(parameterName, int)),
  shape: Schema.optional(ArmourShapeSchema),
  feedsFrom: Schema.optional(slotId),
  magazineEntry: Schema.optional(stableId),
};

export interface NestedLoadoutEntryEncoded {
  readonly id?: string | undefined;
  readonly part: string;
  readonly mountCount?: number | undefined;
  readonly stationPermille?: number | undefined;
  readonly side?: (typeof MOUNT_SIDES)[number] | undefined;
  readonly units?: ReadonlyArray<typeof UnitPlacementSchema.Encoded> | undefined;
  readonly params?: { readonly [key: string]: number } | undefined;
  readonly shape?: typeof ArmourShapeSchema.Encoded | undefined;
  readonly feedsFrom?: string | undefined;
  readonly magazineEntry?: string | undefined;
  readonly entries?:
    | { readonly [childSlot: string]: ReadonlyArray<NestedLoadoutEntryEncoded> }
    | undefined;
}

export interface NestedLoadoutEntry {
  readonly id?: string | undefined;
  readonly part: string;
  readonly mountCount?: number | undefined;
  readonly stationPermille?: number | undefined;
  readonly side?: (typeof MOUNT_SIDES)[number] | undefined;
  readonly units?: ReadonlyArray<typeof UnitPlacementSchema.Type> | undefined;
  readonly params?: { readonly [key: string]: number } | undefined;
  readonly shape?: typeof ArmourShapeSchema.Type | undefined;
  readonly feedsFrom?: string | undefined;
  readonly magazineEntry?: string | undefined;
  readonly entries?:
    | { readonly [childSlot: string]: ReadonlyArray<NestedLoadoutEntry> }
    | undefined;
}

const nestedEntries = Schema.optional(
  Schema.Record(
    slotId,
    Schema.Array(
      Schema.suspend(
        (): Schema.Codec<NestedLoadoutEntry, NestedLoadoutEntryEncoded> => NestedLoadoutEntrySchema,
      ),
    ),
  ),
);

export const NestedLoadoutEntrySchema = Schema.Struct({ ...entryFields, entries: nestedEntries });

export const LoadoutEntrySchema = Schema.Struct({
  slot: slotId,
  ...entryFields,
  entries: nestedEntries,
});

export const LoadoutSchema = Schema.Struct({
  platform: stableId,
  entries: Schema.Array(LoadoutEntrySchema),
});

export const DesignHeaderSchema = Schema.Struct({
  nation: stableId,
  requirement: DesignRequirementSchema,
  hull: HullSpecSchema,
  machinery: Schema.Struct({
    fuelCapacityKg: nonNegativeInt,
    fuelZoneId: Schema.Literals(SHIP_ZONE_IDS),
    fuelStationPermille: permille,
    foulingBp: int.check(Schema.isGreaterThanOrEqualTo(-10_000)),
    enginePriorityBp: Schema.optional(
      int.check(Schema.isBetween({ minimum: -10_000, maximum: 10_000 })),
    ),
    rooms: Schema.optional(
      Schema.Array(
        Schema.Struct({
          zoneId: Schema.Literals(SHIP_ZONE_IDS),
          stationPermille: permille,
          shareBp: bp,
        }),
      ),
    ),
  }),
  fireControl: Schema.optional(Schema.Struct({ positions: nonNegativeInt })),
  colonialServiceFitted: Schema.optional(Schema.Boolean),
  aluminiumSuperstructure: Schema.optional(Schema.Boolean),
  antiAircraft: Schema.optional(
    Schema.Struct({
      lightGuns: nonNegativeInt,
      mediumGuns: nonNegativeInt,
      directors: nonNegativeInt,
    }),
  ),
  tertiary: Schema.optional(Schema.Struct({ caliberUm: positiveInt, count: nonNegativeInt })),
  protection: Schema.Struct({
    citadelLengthMm: nonNegativeInt,
    torpedoWarheadKg: nonNegativeInt,
    bunkerProtectionBp: bp,
    schemeId: Schema.optional(Schema.Literals(ARMOUR_SCHEME_IDS)),
  }),
});

export const DesignLoadoutSchema = Schema.Struct({
  header: DesignHeaderSchema,
  loadout: LoadoutSchema,
});

export const ReferenceDesignLoadoutSchema = Schema.Struct({
  id: stableId,
  name: Schema.NonEmptyString,
  month,
  starterFor: Schema.optional(Schema.NonEmptyString),
  header: DesignHeaderSchema,
  loadout: LoadoutSchema,
});

export type DesignHeaderData = typeof DesignHeaderSchema.Type;
export type DesignLoadoutData = typeof DesignLoadoutSchema.Type;
export type ReferenceDesignLoadoutData = typeof ReferenceDesignLoadoutSchema.Type;
export type CapabilityData = typeof CapabilitySchema.Type;
export type EngineeringData = typeof EngineeringSchema.Type;
export type PartData = typeof PartSchema.Type;
export type SlotData = typeof SlotSchema.Type;
export type SlotTemplateData = typeof SlotTemplateSchema.Type;
export type PlatformData = typeof PlatformSchema.Type;
export type LoadoutData = typeof LoadoutSchema.Type;
export type LoadoutEntryData = typeof LoadoutEntrySchema.Type;
export type QuantityComponentData = typeof QuantityComponentSchema.Type;
