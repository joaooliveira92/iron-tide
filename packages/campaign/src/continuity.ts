import { compareCodePoints } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Result, Schema } from "effect";
import { displayValue, issueKeys, recordOf } from "./schemaIssueKeys.js";
export const CONTINUITY_MODE_IDS = ["historical", "alternate_continuity_v1"] as const;
export type ContinuityMode = (typeof CONTINUITY_MODE_IDS)[number];
export const PARTICIPATION_STATUSES = ["ACTIVE", "INACTIVE", "CONDITIONAL_ACTIVE"] as const;
export type ParticipationStatus = (typeof PARTICIPATION_STATUSES)[number];
export type ParticipantClass = "PLAYABLE_SLOT_INSTANCE" | "AI_ONLY_POWER";

const nonBlankString = Schema.String.check(Schema.isPattern(/\S/));

const PARTICIPATION_VIOLATIONS = {
  activeWithoutInstance: {
    code: "INVALID_SCENARIO_PARTICIPATION_RECORD",
    message: "ACTIVE requires scenarioNationInstanceId",
  },
  inactiveWithInstance: {
    code: "INVALID_SCENARIO_PARTICIPATION_RECORD",
    message: "INACTIVE must have scenarioNationInstanceId NONE",
  },
  conditionalWithoutContinuation: {
    code: "MISSING_ALTERNATE_CONTINUITY_DEFINITION",
    message: "CONDITIONAL_ACTIVE requires continuationDefinitionId",
  },
} as const;

function participationViolation(record: {
  readonly participationStatus: ParticipationStatus;
  readonly scenarioNationInstanceId: string;
  readonly continuationDefinitionId: string;
}): (typeof PARTICIPATION_VIOLATIONS)[keyof typeof PARTICIPATION_VIOLATIONS] | undefined {
  const { participationStatus: status } = record;
  if (status === "ACTIVE" && record.scenarioNationInstanceId === "NONE") {
    return PARTICIPATION_VIOLATIONS.activeWithoutInstance;
  }
  if (status === "INACTIVE" && record.scenarioNationInstanceId !== "NONE") {
    return PARTICIPATION_VIOLATIONS.inactiveWithInstance;
  }
  if (status === "CONDITIONAL_ACTIVE" && record.continuationDefinitionId === "NONE") {
    return PARTICIPATION_VIOLATIONS.conditionalWithoutContinuation;
  }
  return undefined;
}

const ParticipationFieldsSchema = Schema.Struct({
  scenarioId: nonBlankString,
  playableSlotId: nonBlankString,
  continuityModeId: Schema.Literals(CONTINUITY_MODE_IDS),
  participationStatus: Schema.Literals(PARTICIPATION_STATUSES),
  scenarioNationInstanceId: nonBlankString,
  continuationDefinitionId: nonBlankString,
  reasonCode: nonBlankString,
  contentHash: nonBlankString,
});

export const ScenarioParticipationRecordSchema = ParticipationFieldsSchema.check(
  Schema.makeFilter((record) => participationViolation(record)?.message ?? true),
);

export type ScenarioParticipationRecord = typeof ScenarioParticipationRecordSchema.Type;
export interface NationIdentityDefinition {
  nationInstanceId: string;
  playableSlotId: string;
  participantClass: ParticipantClass;
}
export interface ContinuationDefinition {
  continuationDefinitionId: string;
  playableSlotId: string;
  targetScenarioNationInstanceId: string;
}
const PARTICIPATION_FIELDS = Object.keys(ParticipationFieldsSchema.fields) as ReadonlyArray<
  keyof ScenarioParticipationRecord
>;

const ENUMERATED_FIELDS: ReadonlyArray<string> = ["continuityModeId", "participationStatus"];

const decodeOptions = { errors: "all", onExcessProperty: "error" } as const;
const decodeParticipation = Schema.decodeUnknownResult(
  ScenarioParticipationRecordSchema,
  decodeOptions,
);
const decodeParticipationFields = Schema.decodeUnknownResult(
  ParticipationFieldsSchema,
  decodeOptions,
);

const isNonBlank = Schema.is(nonBlankString);

export function validateParticipationRecord(r: unknown, c: DiagnosticCollector) {
  const stage = { stage: "continuity" } as const;
  if (typeof r !== "object" || r === null) {
    c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", "record must be object", stage);
    return false;
  }
  const rec = recordOf(r);
  const decoded = decodeParticipation(rec);
  if (Result.isSuccess(decoded)) return true;
  const keys = issueKeys(decoded.failure.issue);

  for (const f of PARTICIPATION_FIELDS) {
    if (keys.missing.has(f)) {
      c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", `Missing ${f}`, stage);
      return false;
    }
    if (keys.invalid.has(f) && !(ENUMERATED_FIELDS.includes(f) && isNonBlank(rec[f]))) {
      c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", `${f} must be non-empty string`, stage);
      return false;
    }
  }
  if (keys.invalid.has("continuityModeId")) {
    c.addError(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      `Invalid continuityModeId ${displayValue(rec["continuityModeId"])}`,
      stage,
    );
    return false;
  }
  if (keys.invalid.has("participationStatus")) {
    c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", "Invalid participationStatus", stage);
    return false;
  }
  const [unknownKey] = [...keys.unexpected].sort(compareCodePoints);
  if (unknownKey !== undefined) {
    c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", `unknown field ${unknownKey}`, stage);
    return false;
  }
  const fields = decodeParticipationFields(rec);
  const violation = Result.isSuccess(fields) ? participationViolation(fields.success) : undefined;
  c.addError(
    violation?.code ?? "INVALID_SCENARIO_PARTICIPATION_RECORD",
    violation?.message ?? "invalid participation record",
    stage,
  );
  return false;
}
function findUniqueParticipationRecord(
  scenarioId: string,
  playableSlotId: string,
  continuityModeId: ContinuityMode,
  records: ScenarioParticipationRecord[],
  c: DiagnosticCollector,
): ScenarioParticipationRecord | undefined {
  const matches = records.filter(
    (r) =>
      r.scenarioId === scenarioId &&
      r.playableSlotId === playableSlotId &&
      r.continuityModeId === continuityModeId,
  );
  if (matches.length !== 1) {
    c.addError(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      `Expected unique record for ${scenarioId}/${playableSlotId}/${continuityModeId}, got ${matches.length}`,
      { stage: "continuity" },
    );
    return undefined;
  }
  return matches[0];
}

function resolveConditionalActiveParticipation(
  rec: ScenarioParticipationRecord,
  playableSlotId: string,
  continuityModeId: ContinuityMode,
  identities: Map<string, NationIdentityDefinition>,
  continuations: Map<string, ContinuationDefinition>,
  c: DiagnosticCollector,
): string | undefined {
  if (continuityModeId !== "alternate_continuity_v1") {
    c.addError(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      "CONDITIONAL_ACTIVE only under alternate_continuity_v1",
      { stage: "continuity" },
    );
    return undefined;
  }
  if (
    rec.continuationDefinitionId === "NONE" ||
    !continuations.has(rec.continuationDefinitionId as string)
  ) {
    c.addError(
      "MISSING_ALTERNATE_CONTINUITY_DEFINITION",
      `Missing continuation ${String(rec.continuationDefinitionId)}`,
      { stage: "continuity" },
    );
    return undefined;
  }
  const cont = continuations.get(rec.continuationDefinitionId as string)!;
  if (cont.playableSlotId !== playableSlotId) {
    c.addError("MISSING_ALTERNATE_CONTINUITY_DEFINITION", "Continuation playableSlotId mismatch", {
      stage: "continuity",
    });
    return undefined;
  }
  const target = cont.targetScenarioNationInstanceId;
  const ident = identities.get(target);
  if (
    !ident ||
    ident.participantClass !== "PLAYABLE_SLOT_INSTANCE" ||
    ident.playableSlotId !== playableSlotId
  ) {
    c.addError(
      "AI_POWER_PLAYABLE_SLOT_SUBSTITUTION",
      `AI power cannot replace playable slot ${playableSlotId}`,
      { stage: "continuity" },
    );
    return undefined;
  }
  return target;
}

function resolveActiveParticipation(
  rec: ScenarioParticipationRecord,
  playableSlotId: string,
  identities: Map<string, NationIdentityDefinition>,
  c: DiagnosticCollector,
): string | undefined {
  if (rec.scenarioNationInstanceId === "NONE") {
    c.addError(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      "ACTIVE requires scenarioNationInstanceId",
      { stage: "continuity" },
    );
    return undefined;
  }
  if (rec.continuationDefinitionId !== "NONE") {
    c.addError(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      "ACTIVE must have continuationDefinitionId NONE",
      { stage: "continuity" },
    );
    return undefined;
  }
  const ident = identities.get(rec.scenarioNationInstanceId as string);
  if (!ident) {
    c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", "Unknown nation instance", {
      stage: "continuity",
    });
    return undefined;
  }
  if (
    ident.participantClass !== "PLAYABLE_SLOT_INSTANCE" ||
    ident.playableSlotId !== playableSlotId
  ) {
    c.addError(
      "AI_POWER_PLAYABLE_SLOT_SUBSTITUTION",
      `AI_ONLY_POWER cannot occupy playable slot ${playableSlotId}`,
      { stage: "continuity" },
    );
    return undefined;
  }
  return rec.scenarioNationInstanceId as string;
}

export function resolveParticipation(
  scenarioId: string,
  playableSlotId: string,
  continuityModeId: ContinuityMode,
  records: ScenarioParticipationRecord[],
  identities: Map<string, NationIdentityDefinition>,
  continuations: Map<string, ContinuationDefinition>,
  c: DiagnosticCollector,
): string | undefined {
  const rec = findUniqueParticipationRecord(
    scenarioId,
    playableSlotId,
    continuityModeId,
    records,
    c,
  );
  if (!rec) return undefined;

  if (rec.participationStatus === "INACTIVE" && continuityModeId === "historical") {
    c.addError(
      "PLAYABLE_SLOT_INACTIVE_HISTORICAL",
      `Slot ${playableSlotId} inactive in historical`,
      { stage: "continuity" },
    );
    return undefined;
  }
  if (rec.participationStatus === "CONDITIONAL_ACTIVE" && continuityModeId === "historical") {
    c.addError(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      "CONDITIONAL_ACTIVE prohibited in historical",
      { stage: "continuity" },
    );
    return undefined;
  }
  if (rec.participationStatus === "CONDITIONAL_ACTIVE") {
    return resolveConditionalActiveParticipation(
      rec,
      playableSlotId,
      continuityModeId,
      identities,
      continuations,
      c,
    );
  }
  if (rec.participationStatus === "ACTIVE") {
    return resolveActiveParticipation(rec, playableSlotId, identities, c);
  }
  c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", `Slot ${playableSlotId} inactive`, {
    stage: "continuity",
  });
  return undefined;
}
