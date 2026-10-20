// Shared Effect Schema schemas + runtime-validated types for every on-disk
// artifact the persistence package reads back. Casting parsed JSON to a TS type
// is only a compile-time assertion; these schemas are the runtime authority that
// turns "trust me" into "prove it" before any reconstruction or integrity work
// reads attacker/mutation-controlled surface (TODOs #9/#14).
//
// NOTE on depth: `StorableSnapshotSchema` validates the *shape* of the storable
// snapshot (the container fields and their JSON-safe record types) rather than
// enumerating every nested SafeInt/deeply-typed leaf. Deep value-fidelity is
// guaranteed authoritatively by the deterministic `envelope` + `rawHash`
// checks in `store.ts` (a structurally-valid but semantically-changed body
// cannot pass them), and this schema exists to reject shape hacks — missing,
// mistyped, or wrongly-typed top-level/container fields — that the envelope
// hash alone would still choke on ambiguously. Keeping deep leaves permissive
// avoids duplicating the entire (fast-evolving) `@bluewave/campaign` schema as
// a frozen mirror.
//
// `Schema.Struct` in Effect v4 strips unmodeled keys by default, matching the
// Zod `z.object` default (not `.strict()`); parity is proven by the existing
// save/compatibility/corruption suites plus the focused schema parity test.

import { Effect, Schema } from "effect";

// Zod's `z.infer` produced mutable object and array types; Effect Schema's
// `.Type` is deeply readonly. The decoded runtime value is already plain,
// mutable JavaScript, so these aliases restore the mutable shapes existing
// callers compile against (e.g. tampering a parsed `SigFile` in a test) without
// changing the decoder or the wire shape.
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

// v4 removed Zod's `optionalWith({ default })`. The official migration mapping
// for `.default(v)` is `withDecodingDefaultType(Effect.succeed(v))`: the key may
// be absent or `undefined` on input, and the decoded value is required and
// defaulted. This matches Zod's `.default([])` accept/default semantics exactly.
const emptyArrayDefault = Effect.succeed([]);

/**
 * One persisted possession (S-5 02): every key required and non-empty, and no other key accepted, so a malformed
 * entry is refused at the boundary instead of reaching state. The whole `world.possessions` field stays optional
 * for saves that predate it.
 */
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

/**
 * One persisted technology of the compiled research catalogue (`TechnologyDefinitionData`): every key required and
 * non-empty where meaningful, and no other key accepted, so a malformed catalogue entry is refused at the boundary
 * instead of reaching state. The whole `world.technologies` field stays optional for saves that predate it.
 */
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

// S-2: the prestige value set (ADR-0239) in its stored shape. Every field is required and none has
// a default: a 4.0.0 save without it, or with a malformed one, is not loadable. Integer-ness and
// bounds are enforced where the set is decoded (`decodePrestigeValueSet`); here the stored shape is
// pinned so an unlisted field can never be silently stripped on load.
const StorablePrestigeRuleSchema = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("PROPORTIONAL_LOSS"),
    basisPoints: Schema.Finite,
  }),
  Schema.Struct({ kind: Schema.Literal("FIXED_GAIN"), amount: Schema.Finite }),
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

// Integrity contract (see ADR-0032):
//  - `serializedHash`: sha256 of the exact on-disk `campaign.json` bytes.
//  - `stateHash`:     the semantic hash of the reconstituted in-memory state
//                     (identical to `state.rawHash`).
//  - `compatibilityVersion`: the snapshot's compatibility version.
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
  /** sha256 of `month-input.json`, written only by a save that closes an executed month (absent on older saves). */
  monthInputHash: Schema.optional(Schema.String),
});

export type SaveMetadata = Mutable<typeof SaveMetadataSchema.Type>;
