import { canonicalSerialize, sha256Hex, compareCodePoints } from "@bluewave/deterministic";
import { CommandError } from "./errors.js";
import type { CommandRecord } from "./types.js";

export function normalizeUnorderedSets(payload: unknown): unknown {
  if (Array.isArray(payload)) {
    const copy = [...payload];
    if (
      copy.length > 0 &&
      typeof copy[0] === "object" &&
      copy[0] !== null &&
      "id" in (copy[0] as Record<string, unknown>)
    ) {
      copy.sort((a, b) =>
        compareCodePoints(
          String((a as Record<string, unknown>)["id"]),
          String((b as Record<string, unknown>)["id"]),
        ),
      );
    } else if (copy.every((v) => typeof v === "string" || typeof v === "number")) {
      copy.sort((a, b) => compareCodePoints(String(a), String(b)));
    }
    return copy.map(normalizeUnorderedSets);
  }
  if (payload !== null && typeof payload === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>))
      out[k] = normalizeUnorderedSets(v);
    return out;
  }
  return payload;
}

export function convertPresentationUnits(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload };
  if ("displacementTons" in out && typeof out["displacementTons"] === "number") {
    out["displacementKg"] = Math.round((out["displacementTons"] as number) * 1000);
    delete out["displacementTons"];
  }
  if ("speedKnots" in out && typeof out["speedKnots"] === "number") {
    out["speedUms"] = Math.round((out["speedKnots"] as number) * 1000);
    delete out["speedKnots"];
  }
  return out;
}

export function validatePayloadSchema(
  payload: Record<string, unknown>,
  allowedFields: Set<string>,
  allowVersionedExtensions: boolean,
): { ok: true } | { ok: false; unknownFields: string[] } {
  const unknown = Object.keys(payload).filter((k) => !allowedFields.has(k));
  if (unknown.length > 0 && !allowVersionedExtensions) return { ok: false, unknownFields: unknown };
  return { ok: true };
}

export function canonicalizePayload(
  rawPayload: Record<string, unknown>,
  allowedFields: Set<string>,
  allowVersionedExtensions: boolean,
): { canonicalPayload: Record<string, unknown>; canonicalPayloadHash: string } {
  const schemaCheck = validatePayloadSchema(rawPayload, allowedFields, allowVersionedExtensions);
  if (!schemaCheck.ok)
    throw new CommandError({
      code: "INVALID_COMMAND_PAYLOAD",
      message: `INVALID_COMMAND_PAYLOAD: unknown fields ${schemaCheck.unknownFields.join(",")}`,
    });
  const converted = convertPresentationUnits(rawPayload);
  const normalized = normalizeUnorderedSets(converted) as Record<string, unknown>;
  const hash = sha256Hex(canonicalSerialize(normalized));
  return { canonicalPayload: normalized, canonicalPayloadHash: hash };
}

let globalOrdinal = 0;
export function assignSubmissionOrdinal(): number {
  return globalOrdinal++;
}
export function resetSubmissionOrdinal(): void {
  globalOrdinal = 0;
}

export function canonicalOrder(
  records: CommandRecord[],
  phaseOrdinalMap: Map<string, number>,
): CommandRecord[] {
  return [...records].sort((a, b) => {
    const pa = phaseOrdinalMap.get(a.submissionPhaseId) ?? 0;
    const pb = phaseOrdinalMap.get(b.submissionPhaseId) ?? 0;
    if (pa !== pb) return pa - pb;
    if (a.issuerParticipantId !== b.issuerParticipantId)
      return compareCodePoints(a.issuerParticipantId, b.issuerParticipantId);
    if (a.submissionOrdinal !== b.submissionOrdinal)
      return a.submissionOrdinal - b.submissionOrdinal;
    return compareCodePoints(a.commandId, b.commandId);
  });
}

export function hashCommandRecord(rec: CommandRecord): string {
  return sha256Hex(
    canonicalSerialize({
      commandId: rec.commandId,
      commandTypeId: rec.commandTypeId,
      commandSchemaVersion: rec.commandSchemaVersion,
      campaignId: rec.campaignId,
      issuerClass: rec.issuerClass,
      issuerParticipantId: rec.issuerParticipantId,
      targetAggregateId: rec.targetAggregateId,
      submissionPhaseId: rec.submissionPhaseId,
      submissionOrdinal: rec.submissionOrdinal,
      idempotencyKey: rec.idempotencyKey,
      canonicalPayloadHash: rec.canonicalPayloadHash,
      status: rec.status,
    }),
  );
}
