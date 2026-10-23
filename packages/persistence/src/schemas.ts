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
  designs: JsonRecord,
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
