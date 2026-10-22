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

export const StorablePossessionSchema = Schema.Record(Schema.String, Schema.Unknown)
  .check(
    Schema.makeFilter(
      (o) =>
        Object.keys(o).sort().join(",") === "areaId,id,nationId" ||
        "a possession carries exactly id, nationId and areaId",
    ),
  )
  .pipe(
    Schema.decodeTo(
      Schema.Struct({
        id: Schema.NonEmptyString,
        nationId: Schema.NonEmptyString,
        areaId: Schema.NonEmptyString,
      }),
    ),
  );

export const StorableDeclinedBattleSchema = Schema.Record(Schema.String, Schema.Unknown)
  .check(
    Schema.makeFilter(
      (o) =>
        Object.keys(o).sort().join(",") ===
          "areaId,battleId,missionType,month,nationId,opponentCredit,responseInputHash,victoryPointCost,warId" ||
        "a declined-battle record carries exactly its nine fields",
    ),
  )
  .pipe(
    Schema.decodeTo(
      Schema.Struct({
        battleId: Schema.NonEmptyString,
        warId: Schema.NonEmptyString,
        nationId: Schema.NonEmptyString,
        areaId: Schema.NonEmptyString,
        month: Schema.NonEmptyString,
        missionType: Schema.NonEmptyString,
        responseInputHash: Schema.NonEmptyString,
        victoryPointCost: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
        opponentCredit: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
      }),
    ),
  );

export const StorableDeclineCounterSchema = Schema.Record(Schema.String, Schema.Unknown)
  .check(
    Schema.makeFilter(
      (o) =>
        Object.keys(o).sort().join(",") === "count,decayAnchorMonth,key,lastWarId,nationId" ||
        "a decline-counter entry carries exactly its five fields",
    ),
  )
  .pipe(
    Schema.decodeTo(
      Schema.Struct({
        key: Schema.NonEmptyString,
        nationId: Schema.NonEmptyString,
        lastWarId: Schema.NonEmptyString,
        count: Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0)),
        decayAnchorMonth: Schema.String.check(Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/)),
      }),
    ),
  );

export const StorableTechnologySchema = Schema.Record(Schema.String, Schema.Unknown)
  .check(
    Schema.makeFilter(
      (o) =>
        Object.keys(o).sort().join(",") ===
          "availabilityMonth,cost,discoveryWeight,prerequisites,researchFieldId,techId" ||
        "a technology carries exactly techId, researchFieldId, cost, discoveryWeight, prerequisites and availabilityMonth",
    ),
  )
  .pipe(
    Schema.decodeTo(
      Schema.Struct({
        techId: Schema.NonEmptyString,
        researchFieldId: Schema.NonEmptyString,
        cost: Schema.Finite,
        discoveryWeight: Schema.Finite,
        prerequisites: Schema.Array(Schema.NonEmptyString),
        availabilityMonth: Schema.Finite,
      }),
    ),
  );

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
    declinedBattles: Schema.optional(Schema.Array(StorableDeclinedBattleSchema)),
    declineCounters: Schema.optional(Schema.Array(StorableDeclineCounterSchema)),
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
