import type { CampaignSnapshot } from "@bluewave/campaign";
import {
  DIVISION_FORMATIONS,
  DIVISION_MAX_SHIPS,
  DIVISION_ROLES,
  VACANT,
} from "@bluewave/campaign";
import type {
  AddShipToDivisionCommand,
  ChangeDivisionFlagshipCommand,
  CommandBody,
  CommandEnvelope,
  CreateDivisionCommand,
  DissolveDivisionCommand,
  RemoveShipFromDivisionCommand,
  ReorderDivisionShipsCommand,
} from "./envelope.js";
import type { LifecycleStepResult } from "./types.js";
import { rejectValidation } from "./validation.js";

function divisionById(snapshot: CampaignSnapshot, nationId: string, divisionId: string) {
  const nation = snapshot["nations"].get(nationId);
  if (!nation) return undefined;
  return nation["divisions"].find((d) => d["divisionId"] === divisionId);
}

function shipsOf(nationId: string, snapshot: CampaignSnapshot, shipIds: string[]) {
  const nation = snapshot["nations"].get(nationId);
  if (!nation) return [];
  const all = nation["fleets"].flatMap((f) => f["ships"]);
  const byId = new Map(all.map((s) => [s["id"], s]));
  return shipIds.map((id) => byId.get(id)).filter((s): s is NonNullable<typeof s> => !!s);
}

export function validateCreateDivision(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as CreateDivisionCommand;
  if (typeof body.divisionId !== "string" || body.divisionId.length === 0)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_INVALID_ID",
      "divisionId must be non-empty",
    );
  if (divisionById(snapshot, body.nationId, body.divisionId))
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_ALREADY_EXISTS",
      `Division ${body.divisionId} already exists`,
    );
  if (!Array.isArray(body.shipOrder) || body.shipOrder.length === 0)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_SIZE_LIMIT_EXCEEDED",
      "A division must contain 1..5 commissioned ships",
    );
  if (!DIVISION_ROLES.includes(body.divisionRole as any))
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_ROLE_INELIGIBLE",
      `Invalid role ${body.divisionRole}`,
    );
  if (!DIVISION_FORMATIONS.includes(body.preferredFormation as any))
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_FORMATION_INELIGIBLE",
      `Invalid formation ${body.preferredFormation}`,
    );
  if (new Set(body.shipOrder).size !== body.shipOrder.length)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_SHIP_TYPE_INCOMPATIBLE",
      "Duplicate ship in division",
    );
  const ships = shipsOf(body.nationId, snapshot, body.shipOrder);
  if (ships.length !== body.shipOrder.length)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      "One or more ships not found in nation fleets",
    );
  const anyInDivision = ships.filter((s) =>
    (snapshot["nations"].get(body.nationId)?.divisions ?? []).some((d) =>
      d["shipOrder"].includes(s.id),
    ),
  );
  if (anyInDivision.length > 0)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Ship already in another division: ${anyInDivision[0]!.id}`,
    );
  return { ok: true };
}

export function validateAddShipToDivision(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as AddShipToDivisionCommand;
  const division = divisionById(snapshot, body.nationId, body.divisionId);
  if (!division)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Division ${body.divisionId} not found`,
    );
  if (division["shipOrder"].includes(body.shipId))
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_SHIP_TYPE_INCOMPATIBLE",
      `Ship ${body.shipId} already in division`,
    );
  const ships = shipsOf(body.nationId, snapshot, [body.shipId]);
  if (ships.length === 0)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Ship ${body.shipId} not found`,
    );
  if (
    (snapshot["nations"].get(body.nationId)?.divisions ?? []).some(
      (d) => d.divisionId !== body.divisionId && d.shipOrder.includes(body.shipId),
    )
  )
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Ship ${body.shipId} in another division`,
    );
  if (division["shipOrder"].length >= DIVISION_MAX_SHIPS)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_SIZE_LIMIT_EXCEEDED",
      `Division ${body.divisionId} is full`,
    );
  return { ok: true };
}

export function validateRemoveShipFromDivision(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as RemoveShipFromDivisionCommand;
  const division = divisionById(snapshot, body.nationId, body.divisionId);
  if (!division)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Division ${body.divisionId} not found`,
    );
  if (!division["shipOrder"].includes(body.shipId))
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Ship ${body.shipId} not in division`,
    );
  if (division["shipOrder"].length === 1)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_SIZE_LIMIT_EXCEEDED",
      "Removing the final ship requires DissolveDivisionCommand",
    );
  return { ok: true };
}

export function validateAssignOfficer(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "AssignOfficer" }>;
  const nation = snapshot.nations.get(body.nationId);
  if (!nation)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_NATION_ID",
      `Nation ${body.nationId} not found`,
    );
  if (!(nation.officers ?? []).some((o) => o.id === body.officerId))
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Officer ${body.officerId} is not in ${body.nationId}'s officer corps`,
    );
  const division = divisionById(snapshot, body.nationId, body.divisionId);
  if (!division)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Division ${body.divisionId} not found`,
    );
  const elsewhere = nation.divisions.find(
    (d) => d.commanderOfficerId === body.officerId && d.divisionId !== body.divisionId,
  );
  if (elsewhere)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Officer ${body.officerId} already commands division ${elsewhere.divisionId}; relieve them first`,
    );
  return { ok: true };
}

export function validateRelieveOfficer(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as Extract<CommandBody, { type: "RelieveOfficer" }>;
  const division = divisionById(snapshot, body.nationId, body.divisionId);
  if (!division)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Division ${body.divisionId} not found`,
    );
  if (division.commanderOfficerId === VACANT)
    return rejectValidation(
      envelope,
      snapshot,
      "INVALID_COMMAND_PAYLOAD",
      `Division ${body.divisionId} has no commander to relieve`,
    );
  return { ok: true };
}

export function validateDissolveDivision(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as DissolveDivisionCommand;
  const division = divisionById(snapshot, body.nationId, body.divisionId);
  if (!division)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Division ${body.divisionId} not found`,
    );
  return { ok: true };
}

export function validateChangeDivisionFlagship(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as ChangeDivisionFlagshipCommand;
  const division = divisionById(snapshot, body.nationId, body.divisionId);
  if (!division)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_FLAGSHIP_INVALID",
      `Division ${body.divisionId} not found`,
    );
  if (!division["shipOrder"].includes(body.newFlagshipShipId))
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_FLAGSHIP_INVALID",
      `Ship ${body.newFlagshipShipId} not in division`,
    );
  return { ok: true };
}

/**
 * DESIGN-26 §8/§12. A reorder MUST be a permutation of the division's current
 * members with the flagship (canonical first ship) unmoved; anything else is a
 * membership change or a flagship change and belongs to another command. An
 * unchanged order is rejected so a no-op can never be charged the cohesion cost.
 */
export function validateReorderDivisionShips(
  envelope: CommandEnvelope<CommandBody>,
  snapshot: CampaignSnapshot,
): LifecycleStepResult {
  const body = envelope.body as ReorderDivisionShipsCommand;
  const division = divisionById(snapshot, body.nationId, body.divisionId);
  if (!division)
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      `Division ${body.divisionId} not found`,
    );
  const current = division["shipOrder"];
  const next = body.shipOrder;
  if (
    !Array.isArray(next) ||
    next.length !== current.length ||
    new Set(next).size !== next.length ||
    next.some((id) => !current.includes(id))
  )
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      "shipOrder must be a permutation of the division's current ships",
    );
  if (next[0] !== division["flagshipShipId"])
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_FLAGSHIP_INVALID",
      `shipOrder must keep flagship ${division["flagshipShipId"]} first`,
    );
  if (next.every((id, index) => id === current[index]))
    return rejectValidation(
      envelope,
      snapshot,
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
      "ship order is unchanged",
    );
  return { ok: true };
}
