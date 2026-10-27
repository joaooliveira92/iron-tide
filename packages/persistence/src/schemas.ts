import {
  DeclinedBattleRecordSchema,
  DeclineCounterEntrySchema,
} from "@bluewave/campaign/decline-records";
import { Effect, Schema } from "effect";

type Mutable<T> =
  T extends ReadonlyArray<infer U>
    ? Mutable<U>[]
    : T extends object
      ? { -readonly [K in keyof T]: Mutable<T[K]> }
      : T;

export const SaveHeaderSchema = Schema.Struct({
  snapshot: Schema.Struct({
    compatibilityVersion: Schema.String,
  }),
});

export type DecodedSaveHeader = Mutable<typeof SaveHeaderSchema.Type>;

const JsonRecord = Schema.Record(Schema.String, Schema.Unknown);

const StorableDesignCapabilitySchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("fire_control_class"),
    class: Schema.Literals(["heavy", "medium", "light"]),
  }),
  Schema.Struct({
    kind: Schema.Literal("fire_control_support"),
    classes: Schema.Array(Schema.Literals(["heavy", "medium", "light"])).check(
      Schema.isMinLength(1),
    ),
  }),
  Schema.Struct({
    kind: Schema.Literal("ammunition_feed"),
    maxFeedPermille: Schema.Finite,
  }),
  Schema.Struct({
    kind: Schema.Literal("arc_obstruction"),
    blockedDeg: Schema.Finite,
    reachPermille: Schema.Finite,
  }),
  Schema.Struct({ kind: Schema.Literal("damage_control"), effectBp: Schema.Finite }),
  Schema.Struct({
    kind: Schema.Literal("search_radar"),
    level: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 3 })),
  }),
  Schema.Struct({
    kind: Schema.Literal("fire_control_radar"),
    level: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 3 })),
  }),
  Schema.Struct({
    kind: Schema.Literal("sonar_detection"),
    level: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 3 })),
  }),
  Schema.Struct({
    kind: Schema.Literal("asw_attack"),
    level: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 3 })),
  }),
  Schema.Struct({
    kind: Schema.Literal("aa_engagement"),
    level: Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 3 })),
  }),
  Schema.Struct({
    kind: Schema.Literal("missile_launch"),
    missileClass: Schema.Literals(["light_ssm", "medium_ssm", "heavy_ssm", "sam", "asm"]),
  }),
  Schema.Struct({ kind: Schema.Literal("aircraft_hangar"), capacity: Schema.Finite }),
]);

export const StorableDesignCapabilitiesSchema = Schema.Array(StorableDesignCapabilitySchema).check(
  Schema.isMinLength(1),
  Schema.makeFilter((list) => {
    for (let i = 1; i < list.length; i++) {
      if (list[i - 1]!.kind > list[i]!.kind) return "capabilities must be sorted by kind";
    }
    return undefined;
  }),
);

const StorableConstructionPlanShareSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.String,
  line: Schema.String,
  totalWork: Schema.Finite,
  dependsOn: Schema.Array(Schema.String),
});

const StorableConstructionPlanSchema = Schema.Struct({
  yardId: Schema.String,
  packages: Schema.Array(StorableConstructionPlanShareSchema),
  capacityUnits: Schema.Record(Schema.String, Schema.Finite),
});

export const StorableCompiledDesignVersionSchema = Schema.Struct({
  designVersionId: Schema.String,
  designFamilyId: Schema.String,
  className: Schema.String,
  nationId: Schema.String,
  hullType: Schema.String,
  normalizedDisplacementKg: Schema.Finite,
  normalizedSpeedUms: Schema.Finite,
  normalizedArmorUm: Schema.Finite,
  hitPoints: Schema.Finite,
  mainGunsCaliber: Schema.Finite,
  mainGunsCount: Schema.Finite,
  machineryType: Schema.String,
  crewComplement: Schema.Finite,
  contentVersion: Schema.String,
  compiledHash: Schema.String,
  capabilities: Schema.optional(StorableDesignCapabilitiesSchema),
  armament: Schema.optional(Schema.Array(Schema.Unknown)),
  torpedoArmament: Schema.optional(Schema.Array(Schema.Unknown)),
  sourceDraft: Schema.optional(JsonRecord),
  colonialServiceFitted: Schema.optional(Schema.Literal(true)),
  crampedAccommodation: Schema.optional(Schema.Literal(true)),
  shortRange: Schema.optional(Schema.Literal(true)),
  constructionCostUnits: Schema.optional(Schema.Finite),
  constructionPlan: Schema.optional(StorableConstructionPlanSchema),
});

const emptyArrayDefault = Effect.succeed([]);

export const StorablePossessionSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  areaId: Schema.NonEmptyString,
});

export const StorableTechnologySchema = Schema.Struct({
  techId: Schema.NonEmptyString,
  researchFieldId: Schema.NonEmptyString,
  cost: Schema.Finite,
  discoveryWeight: Schema.Finite,
  prerequisites: Schema.Array(Schema.NonEmptyString),
  availabilityMonth: Schema.Finite,
});

const StorablePrestigeRuleSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("PROPORTIONAL_LOSS"),
    basisPoints: Schema.Finite,
  }),
  Schema.Struct({ kind: Schema.Literal("FIXED_GAIN"), amount: Schema.Finite }),
  Schema.Struct({ kind: Schema.Literal("FIXED_LOSS"), amount: Schema.Finite }),
]);

const StorablePrestigeValueSetSchema = Schema.Struct({
  lowerBound: Schema.Finite,
  upperBound: Schema.Finite,
  sackingThreshold: Schema.Finite,
  sackingProbabilityBp: Schema.Finite,
  rules: Schema.Struct({
    UNPAID_FUNDS: StorablePrestigeRuleSchema,
    BATTLE_LOST: StorablePrestigeRuleSchema,
    BATTLE_WON: StorablePrestigeRuleSchema,
    DECLINED_BATTLE: Schema.optionalKey(StorablePrestigeRuleSchema),
  }),
});

const StorableCareerResultSchema = Schema.Struct({
  nationId: Schema.String,
  score: Schema.Finite,
  reason: Schema.Literals(["SACKED", "CAMPAIGN_END"]),
  month: Schema.Struct({ year: Schema.Finite, month: Schema.Finite }),
});

const StorableSnapshotSchema = Schema.Struct({
  version: Schema.String,
  turnNumber: Schema.Finite,
  campaignId: Schema.String,
  startYear: Schema.Finite,
  startMonth: Schema.Finite,
  slots: Schema.Array(Schema.Struct({ nationId: Schema.String, type: Schema.String })).pipe(
    Schema.withDecodingDefaultType(emptyArrayDefault),
  ),
  world: Schema.Struct({
    areas: Schema.Array(Schema.Record(Schema.String, Schema.Unknown)).pipe(
      Schema.withDecodingDefaultType(emptyArrayDefault),
    ),
    routes: Schema.Array(Schema.Unknown).pipe(Schema.withDecodingDefaultType(emptyArrayDefault)),
    ports: Schema.Array(Schema.Unknown).pipe(Schema.withDecodingDefaultType(emptyArrayDefault)),
    technologies: Schema.optional(Schema.Array(StorableTechnologySchema)),
    possessions: Schema.optional(Schema.Array(StorablePossessionSchema)),
  }),
  nations: JsonRecord,
  wars: Schema.Struct({
    wars: Schema.Array(Schema.Unknown),
    battles: Schema.Array(Schema.Unknown),
    participantMemberships: Schema.Array(Schema.Unknown),
    blockadeState: Schema.Array(Schema.Unknown),
    battleManifests: Schema.Array(Schema.Unknown),
    declinedBattles: Schema.optional(Schema.Array(DeclinedBattleRecordSchema)),
    declineCounters: Schema.optional(Schema.Array(DeclineCounterEntrySchema)),
  }),
  politics: Schema.Struct({
    relations: Schema.Array(Schema.Unknown),
    shells: JsonRecord,
  }),
  intelligence: Schema.Struct({
    shells: JsonRecord,
  }),
  designs: Schema.Record(Schema.String, StorableCompiledDesignVersionSchema),
  designFamilies: JsonRecord,
  strategicWeather: Schema.Array(Schema.Unknown).pipe(
    Schema.withDecodingDefaultType(emptyArrayDefault),
  ),
  prestigeRules: StorablePrestigeValueSetSchema,
  careerResult: Schema.optionalKey(StorableCareerResultSchema),
  rulesetVersion: Schema.String,
  compatibilityVersion: Schema.String,
});

export const StorableCampaignStateSchema = Schema.Struct({
  snapshot: StorableSnapshotSchema,
  envelope: Schema.Struct({
    algorithm: Schema.String,
    artifactKind: Schema.String,
    compatibilityVersion: Schema.String,
    bodyHash: Schema.String,
    bodyLength: Schema.Finite,
  }),
  rawHash: Schema.String,
});

export const decodeStorableCampaignState = Schema.decodeUnknownResult(StorableCampaignStateSchema, {
  onExcessProperty: "error",
});

export type StorableCampaignState = Mutable<typeof StorableCampaignStateSchema.Type>;

export const PointerFileSchema = Schema.Struct({
  activeSaveId: Schema.String,
  previousSaveId: Schema.optional(Schema.String),
  recoveredAt: Schema.optional(Schema.String),
});

export type PointerFile = Mutable<typeof PointerFileSchema.Type>;

export const SigFileSchema = Schema.Struct({
  serializedHash: Schema.String,
  stateHash: Schema.String,
  compatibilityVersion: Schema.String,
});

export type SigFile = Mutable<typeof SigFileSchema.Type>;

export const SaveMetadataSchema = Schema.Struct({
  saveId: Schema.String,
  previousSaveId: Schema.optional(Schema.String),
  timestamp: Schema.String,
  turnNumber: Schema.Finite,
  campaignId: Schema.String,
  snapshotHash: Schema.String,
  compatibilityVersion: Schema.String,
  contentArtifactHash: Schema.String,
  campaignName: Schema.optional(Schema.String),
  nationId: Schema.optional(Schema.String),
  campaignDate: Schema.optional(Schema.Struct({ year: Schema.Finite, month: Schema.Finite })),
  monthInputHash: Schema.optional(Schema.String),
});

export type SaveMetadata = Mutable<typeof SaveMetadataSchema.Type>;
