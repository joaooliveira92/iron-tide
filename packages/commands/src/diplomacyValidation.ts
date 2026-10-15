import type { CampaignSnapshot } from "@bluewave/campaign";
import { MAXIMUM_CONCURRENT_WARS } from "@bluewave/campaign";
import type {
  AcceptPeaceCommand,
  BreakAllianceCommand,
  BreakNonAggressionPactCommand,
  CommandBody,
  CommandEnvelope,
  DeclareBlockadeCommand,
  DeclareWarCommand,
  FormAllianceCommand,
  FormNonAggressionPactCommand,
} from "./envelope.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

// --- B10c diplomacy & war validators ---

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

function findRelation(snapshot: CampaignSnapshot, a: string, b: string) {
  const key = pairKey(a, b);
  return snapshot.politics.relations.find((r) => pairKey(r.nationA, r.nationB) === key) ?? null;
}

function activeWarsFor(snapshot: CampaignSnapshot, nationId: string) {
  return snapshot.wars.wars.filter(
    (w) =>
      w.status !== "ENDED" &&
      (w.attackerSideMembers.includes(nationId) || w.defenderSideMembers.includes(nationId)),
  );
}

function isActiveSharedWar(snapshot: CampaignSnapshot, a: string, b: string): boolean {
  return snapshot.wars.wars.some(
    (w) =>
      (w.status === "ACTIVE" || w.status === "DECLARED_NOT_ACTIVE") &&
      (w.attackerSideMembers.includes(a) || w.defenderSideMembers.includes(a)) &&
      (w.attackerSideMembers.includes(b) || w.defenderSideMembers.includes(b)),
  );
}

export function validateDeclareWar(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as DeclareWarCommand;
  if (typeof body.nationId !== "string" || body.nationId.length === 0)
    return rejectValidation(envelope, snapshot, "INVALID_NATION_ID", "nationId must be non-empty");
  if (typeof body.targetNationId !== "string" || body.targetNationId.length === 0)
    return rejectValidation(
      envelope,
      snapshot,
      "DECLARE_WAR_INVALID_TARGET",
      "targetNationId must be non-empty",
    );
  if (body.nationId === body.targetNationId)
    return rejectValidation(
      envelope,
      snapshot,
      "DECLARE_WAR_INVALID_TARGET",
      "Cannot declare war on yourself",
    );
  if (!snapshot.nations.has(body.targetNationId))
    return rejectValidation(
      envelope,
      snapshot,
      "DECLARE_WAR_INVALID_TARGET",
      `Target nation ${body.targetNationId} does not exist`,
    );
  if (!snapshot.nations.has(body.nationId))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_NATION_ID",
      `Nation ${body.nationId} not found`,
    );
  const relation = findRelation(snapshot, body.nationId, body.targetNationId);
  if (relation && relation.relation === "at_war")
    return rejectValidation(
      envelope,
      snapshot,
      "ALREADY_AT_WAR",
      `${body.nationId} is already at war with ${body.targetNationId}`,
    );
  if (activeWarsFor(snapshot, body.nationId).length >= MAXIMUM_CONCURRENT_WARS)
    return rejectValidation(
      envelope,
      snapshot,
      "MAXIMUM_CONCURRENT_WARS_REACHED",
      `${body.nationId} already at maximum concurrent wars`,
    );
  return { ok: true };
}

export function validateAcceptPeace(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as AcceptPeaceCommand;
  if (typeof body.warId !== "string" || body.warId.length === 0)
    return rejectValidation(envelope, snapshot, "PEACE_INVALID", "warId must be non-empty");
  const war = snapshot.wars.wars.find((w) => w.id === body.warId);
  if (!war)
    return rejectValidation(envelope, snapshot, "PEACE_INVALID", `War ${body.warId} not found`);
  if (war.status !== "ACTIVE")
    return rejectValidation(
      envelope,
      snapshot,
      "PEACE_NO_ACTIVE_WAR",
      `War ${body.warId} is not active`,
    );
  const isMember =
    war.attackerSideMembers.includes(body.nationId) ||
    war.defenderSideMembers.includes(body.nationId);
  if (!isMember)
    return rejectValidation(
      envelope,
      snapshot,
      "PEACE_NO_ACTIVE_WAR",
      `${body.nationId} is not a member of war ${body.warId}`,
    );
  return { ok: true };
}

export function validateFormAlliance(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as FormAllianceCommand;
  if (body.nationId === body.partnerNationId)
    return rejectValidation(
      envelope,
      snapshot,
      "ALLIANCE_FORMATION_INELIGIBLE",
      "Cannot ally with yourself",
    );
  const relation = findRelation(snapshot, body.nationId, body.partnerNationId);
  if (relation && relation.relation === "allied")
    return rejectValidation(
      envelope,
      snapshot,
      "ALLIANCE_ALREADY_EXISTS",
      `${body.nationId} is already allied with ${body.partnerNationId}`,
    );
  if (relation && relation.relation !== "neutral")
    return rejectValidation(
      envelope,
      snapshot,
      "ALLIANCE_TARGET_NOT_NEUTRAL",
      `Relation must be neutral to form alliance`,
    );
  return { ok: true };
}

export function validateBreakAlliance(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as BreakAllianceCommand;
  const relation = findRelation(snapshot, body.nationId, body.partnerNationId);
  if (!relation || relation.relation !== "allied")
    return rejectValidation(
      envelope,
      snapshot,
      "ALLIANCE_ALREADY_EXISTS",
      `${body.nationId} is not allied with ${body.partnerNationId}`,
    );
  if (isActiveSharedWar(snapshot, body.nationId, body.partnerNationId))
    return rejectValidation(
      envelope,
      snapshot,
      "ALLIANCE_LOCKED_BY_WAR",
      `Alliance cannot be broken during an active shared war`,
    );
  return { ok: true };
}

export function validateFormNap(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as FormNonAggressionPactCommand;
  if (body.nationId === body.partnerNationId)
    return rejectValidation(envelope, snapshot, "NAP_ALREADY_EXISTS", "Cannot NAP with yourself");
  const relation = findRelation(snapshot, body.nationId, body.partnerNationId);
  if (relation && relation.nap)
    return rejectValidation(
      envelope,
      snapshot,
      "NAP_ALREADY_EXISTS",
      `A NAP already exists between ${body.nationId} and ${body.partnerNationId}`,
    );
  return { ok: true };
}

export function validateBreakNap(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as BreakNonAggressionPactCommand;
  const relation = findRelation(snapshot, body.nationId, body.partnerNationId);
  if (!relation || !relation.nap)
    return rejectValidation(
      envelope,
      snapshot,
      "NAP_ALREADY_EXISTS",
      `No NAP exists between ${body.nationId} and ${body.partnerNationId}`,
    );
  return { ok: true };
}

export function validateDeclareBlockade(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as DeclareBlockadeCommand;
  if (body.nationId === body.targetNationId)
    return rejectValidation(
      envelope,
      snapshot,
      "BLOCKADE_INVALID_TARGET",
      "Cannot blockade yourself",
    );
  const relation = findRelation(snapshot, body.nationId, body.targetNationId);
  if (!relation || relation.relation !== "at_war")
    return rejectValidation(
      envelope,
      snapshot,
      "BLOCKADE_NOT_AT_WAR",
      `${body.nationId} is not at war with ${body.targetNationId}`,
    );
  if (typeof body.areaId !== "string" || body.areaId.length === 0)
    return rejectValidation(
      envelope,
      snapshot,
      "BLOCKADE_INVALID_TARGET",
      "areaId must be non-empty",
    );
  const existing = snapshot.wars.blockadeState.some(
    (b) =>
      b.blockaderId === body.nationId &&
      b.blockadedNationId === body.targetNationId &&
      b.areaId === body.areaId,
  );
  if (existing)
    return rejectValidation(
      envelope,
      snapshot,
      "BLOCKADE_ALREADY_EXISTS",
      `A blockade already exists for ${body.nationId} on ${body.targetNationId} in area ${body.areaId}`,
    );
  return { ok: true };
}
