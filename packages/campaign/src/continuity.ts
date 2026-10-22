import type { DiagnosticCollector } from "@bluewave/diagnostics";
export type ContinuityMode = "historical" | "alternate_continuity_v1";
export type ParticipationStatus = "ACTIVE" | "INACTIVE" | "CONDITIONAL_ACTIVE";
export type ParticipantClass = "PLAYABLE_SLOT_INSTANCE" | "AI_ONLY_POWER";
export interface ScenarioParticipationRecord {
  scenarioId: string;
  playableSlotId: string;
  continuityModeId: ContinuityMode;
  participationStatus: ParticipationStatus;
  scenarioNationInstanceId: string;
  continuationDefinitionId: string;
  reasonCode: string;
  contentHash: string;
}
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
export function validateParticipationRecord(r: unknown, c: DiagnosticCollector) {
  if (typeof r !== "object" || r === null) {
    c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", "record must be object", {
      stage: "continuity",
    });
    return false;
  }
  const rec = r as Record<string, unknown>;
  const req = [
    "scenarioId",
    "playableSlotId",
    "continuityModeId",
    "participationStatus",
    "scenarioNationInstanceId",
    "continuationDefinitionId",
    "reasonCode",
    "contentHash",
  ];
  for (const f of req) {
    if (!(f in rec)) {
      c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", `Missing ${f}`, { stage: "continuity" });
      return false;
    }
    if (typeof rec[f] !== "string" || (rec[f] as string).trim() === "") {
      c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", `${f} must be non-empty string`, {
        stage: "continuity",
      });
      return false;
    }
  }
  if (!["historical", "alternate_continuity_v1"].includes(rec["continuityModeId"] as string)) {
    c.addError(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      `Invalid continuityModeId ${String(rec["continuityModeId"])}`,
      { stage: "continuity" },
    );
    return false;
  }
  if (
    !["ACTIVE", "INACTIVE", "CONDITIONAL_ACTIVE"].includes(rec["participationStatus"] as string)
  ) {
    c.addError("INVALID_SCENARIO_PARTICIPATION_RECORD", "Invalid participationStatus", {
      stage: "continuity",
    });
    return false;
  }
  const status = rec["participationStatus"] as string;
  if (status === "ACTIVE" && rec["scenarioNationInstanceId"] === "NONE") {
    c.addError(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      "ACTIVE requires scenarioNationInstanceId",
      { stage: "continuity" },
    );
    return false;
  }
  if (status === "INACTIVE" && rec["scenarioNationInstanceId"] !== "NONE") {
    c.addError(
      "INVALID_SCENARIO_PARTICIPATION_RECORD",
      "INACTIVE must have scenarioNationInstanceId NONE",
      { stage: "continuity" },
    );
    return false;
  }
  if (status === "CONDITIONAL_ACTIVE" && rec["continuationDefinitionId"] === "NONE") {
    c.addError(
      "MISSING_ALTERNATE_CONTINUITY_DEFINITION",
      "CONDITIONAL_ACTIVE requires continuationDefinitionId",
      { stage: "continuity" },
    );
    return false;
  }
  return true;
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
