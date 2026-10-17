import { Schema } from "effect";

import { DesignTemplateSchema } from "./design.js";
import { ProvenanceSchema } from "./provenance.js";
import { CANONICAL_RESEARCH_FIELD_IDS } from "./research-fields.js";

/**
 * Authored campaign-file schemas (CAH-SCH-2). The six campaign-file collections
 * (`fleets`/`economies`/`constructions`/`research`/`designs`/`diplomacy`) are
 * compiled into the bundle's `campaign` section; before these schemas they were
 * only duplicate-id and cross-reference checked, so a structurally malformed
 * record could still compile. The shapes mirror what the campaign compiler's
 * builders consume (packages/campaign/src/{nationCompilation,designCompilation,
 * politicalCompilation}.ts) and the authored production content.
 */

const month = Schema.String.check(
  Schema.isPattern(/^\d{4}-(0[1-9]|1[0-2])$/, { message: "must be YYYY-MM" }),
);
const nonNegativeInt = Schema.Finite.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(0));

/** A design template plus the campaign-only version and family fields (CAH-SCH-2). */
export const CampaignDesignSchema = Schema.Struct({
  ...DesignTemplateSchema.fields,
  designVersionId: Schema.NonEmptyString,
  familyCreationMonth: Schema.optional(month),
  normalizedDisplacementKg: Schema.optional(nonNegativeInt),
  normalizedSpeedUms: Schema.optional(nonNegativeInt),
  normalizedArmorUm: Schema.optional(nonNegativeInt),
});

const FleetShipSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  classId: Schema.NonEmptyString,
  designVersionId: Schema.optional(Schema.NonEmptyString),
  hitPoints: nonNegativeInt,
  maxHitPoints: nonNegativeInt,
  speed: nonNegativeInt,
  firepower: nonNegativeInt,
  armor: nonNegativeInt,
  isUnderConstruction: Schema.Boolean,
  constructionProgress: nonNegativeInt,
  constructionTotalWork: nonNegativeInt,
  // S-1: optional authored readiness/crew seed. Absent, the campaign compiler
  // derives them (`isUnderConstruction` -> WORKING_UP, else ACTIVE at ceiling);
  // present, the campaign compile boundary validates the vocabulary and the
  // 0..100 integer band (S-1 D2). Kept structurally open here so a malformed
  // value reaches that boundary as a `_tag`-discriminated diagnostic.
  readiness: Schema.optional(Schema.String),
  crewQuality: Schema.optional(Schema.Finite),
  inBattleId: Schema.optional(Schema.NonEmptyString),
});

export const CampaignFleetSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  locationAreaId: Schema.NonEmptyString,
  ships: Schema.Array(FleetShipSchema),
  provenance: Schema.optional(ProvenanceSchema),
});

export const CampaignEconomySchema = Schema.Struct({
  nationId: Schema.NonEmptyString,
  treasury: nonNegativeInt,
  income: nonNegativeInt,
  expenses: nonNegativeInt,
  provenance: Schema.optional(ProvenanceSchema),
});

export const CampaignConstructionSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  type: Schema.Literals(["ship", "building", "technology"]),
  targetId: Schema.NonEmptyString,
  designVersionId: Schema.optional(Schema.NonEmptyString),
  totalWork: nonNegativeInt,
  completedWork: nonNegativeInt,
  paidWork: nonNegativeInt,
  status: Schema.Literals(["PLANNED", "AUTHORIZED", "ACTIVE", "COMPLETED"]),
  startedAt: month,
  provenance: Schema.optional(ProvenanceSchema),
});

const TechnologyProgressSchema = Schema.Struct({
  techId: Schema.NonEmptyString,
  investedPoints: nonNegativeInt,
  completed: Schema.Boolean,
});

/** Every canonical research field is an optional priority key; unknown keys are rejected. */
const ResearchFieldPrioritiesSchema = Schema.Struct(
  Object.fromEntries(
    CANONICAL_RESEARCH_FIELD_IDS.map((id) => [id, Schema.optionalKey(nonNegativeInt)]),
  ),
);

export const CampaignResearchSchema = Schema.Struct({
  nationId: Schema.NonEmptyString,
  researchBudget: nonNegativeInt,
  currentProjectTechId: Schema.optional(Schema.NonEmptyString),
  fieldPriorities: Schema.optional(ResearchFieldPrioritiesSchema),
  technologies: Schema.Array(TechnologyProgressSchema),
  activeCandidates: Schema.optional(Schema.Record(Schema.String, Schema.String)),
  discoveredTechs: Schema.optional(Schema.Array(Schema.String)),
  provenance: Schema.optional(ProvenanceSchema),
});

export const CampaignDiplomacySchema = Schema.Struct({
  nationA: Schema.NonEmptyString,
  nationB: Schema.NonEmptyString,
  relation: Schema.Literals(["neutral", "allied", "at_war", "trade_agreement"]),
  tension: Schema.optional(
    Schema.Finite.check(Schema.isInt(), Schema.isBetween({ minimum: 0, maximum: 10 })),
  ),
  nap: Schema.optional(Schema.Boolean),
  since: Schema.optional(month),
  provenance: Schema.optional(ProvenanceSchema),
});

/**
 * The DESIGN-26 §13/§17 canonical division vocabulary (N-1 ticket 07). Declared
 * at the content boundary so the authored record is strictly typed; the campaign
 * engine re-exports the same values (`packages/campaign/src/division.ts`) so the
 * two cannot drift.
 */
export const CAMPAIGN_DIVISION_ROLES = [
  "INDEPENDENT",
  "CORE",
  "SUPPORT",
  "SCOUT",
  "SCREEN",
  "PATROL",
] as const;
export const CAMPAIGN_DIVISION_FORMATIONS = [
  "LINE_AHEAD",
  "LINE_ABREAST",
  "SEARCH_LINE",
  "SCREEN",
] as const;

/**
 * An authored initial division (N-1 ticket 07, DESIGN-26). `shipOrder` names the
 * member ships in canonical order (the first is the flagship); the campaign
 * compiler resolves their shared area, seeds the DESIGN-26 initial experience
 * and cohesion, and fills the rest. `commanderOfficerId` is a per-nation officer
 * id or omitted for a vacant command. The magnitudes are ADR-0213
 * `balance_adjustment` values (ADR-0224).
 */
export const CampaignDivisionSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  nationId: Schema.NonEmptyString,
  shipOrder: Schema.NonEmptyArray(Schema.NonEmptyString),
  commanderOfficerId: Schema.optional(Schema.NonEmptyString),
  divisionRole: Schema.Literals(CAMPAIGN_DIVISION_ROLES),
  preferredFormation: Schema.Literals(CAMPAIGN_DIVISION_FORMATIONS),
  provenance: Schema.optional(ProvenanceSchema),
});

export type CampaignDesign = typeof CampaignDesignSchema.Type;
export type CampaignFleet = typeof CampaignFleetSchema.Type;
export type CampaignEconomy = typeof CampaignEconomySchema.Type;
export type CampaignConstruction = typeof CampaignConstructionSchema.Type;
export type CampaignResearch = typeof CampaignResearchSchema.Type;
export type CampaignDiplomacy = typeof CampaignDiplomacySchema.Type;
export type CampaignDivision = typeof CampaignDivisionSchema.Type;
