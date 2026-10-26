import { SafeInt } from "@bluewave/contracts";

import { divisionAggregateHash, type PermanentDivision } from "./division.js";

export const DIVISION_EXPERIENCE_REASONS = ["BATTLE_PARTICIPATION"] as const;
export type DivisionExperienceReason = (typeof DIVISION_EXPERIENCE_REASONS)[number];

export interface DivisionExperienceRequest {
  readonly nationId: string;
  readonly divisionId: string;
  readonly reason: DivisionExperienceReason;
  readonly sourceId: string;
  readonly points: number;
}

export interface DivisionExperienceApplied {
  readonly division: PermanentDivision;
  readonly before: SafeInt;
  readonly after: SafeInt;
}

export function applyDivisionExperienceRequest(
  division: PermanentDivision,
  request: Pick<DivisionExperienceRequest, "points">,
): DivisionExperienceApplied {
  const before = division.experience;
  const after = SafeInt(Math.min(100, Math.max(0, (before as number) + request.points)));
  if (after === before) return { division, before, after };
  const next: PermanentDivision = { ...division, experience: after, aggregateHash: "" };
  next.aggregateHash = divisionAggregateHash(next);
  return { division: next, before, after };
}

export function battleExperienceRequests(input: {
  readonly battleId: string;
  readonly participantShipIds: ReadonlySet<string>;
  readonly divisions: readonly PermanentDivision[];
  readonly points: number;
}): DivisionExperienceRequest[] {
  if (input.points <= 0) return [];
  return input.divisions
    .filter((division) => division.shipOrder.some((shipId) => input.participantShipIds.has(shipId)))
    .map((division) => ({
      nationId: division.nationId,
      divisionId: division.divisionId,
      reason: "BATTLE_PARTICIPATION" as const,
      sourceId: input.battleId,
      points: input.points,
    }))
    .sort((a, b) =>
      a.nationId === b.nationId
        ? a.divisionId < b.divisionId
          ? -1
          : a.divisionId > b.divisionId
            ? 1
            : 0
        : a.nationId < b.nationId
          ? -1
          : 1,
    );
}
