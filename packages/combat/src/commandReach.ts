import { BluewaveError } from "@bluewave/contracts";
import type { RandomEngine } from "@bluewave/random";

export const CommandReachPolicyId = "tactical_command_reach_v1" as const;
export type PathKind = "flag" | "lamp" | "early_radio" | "mature_radio" | "data_link" | "relay";

export interface CommunicationPath {
  kind: PathKind;
  maxRangeNm: number; // battle-wide = Infinity
  requiresVisibility: boolean;
  requiresLineOfSight: boolean;
  technologyRequirement?: string;
  baseTransmissionDelayMinutes: number;
  baseFailureBp: number;
  flagshipCondition: string;
  relayCondition?: string;
  supportedCommandTypes: string[];
}

export const SHIPPED_PATH_RANGES_NM: Record<PathKind, number> = {
  flag: 8,
  lamp: 12,
  early_radio: 100,
  mature_radio: 500,
  data_link: Infinity,
  relay: Infinity,
};
export const SHIPPED_BASE_DELAYS: Record<string, number> = {
  local_lead: 0,
  flag: 2,
  lamp: 1,
  early_radio: 2,
  mature_radio: 1,
  data_link: 0,
  allied_request: 2,
  relay_hop: 1,
};

export function getBaseDelay(
  path: PathKind,
  opts?: { isAlliedRequest?: boolean; relayHops?: number },
): number {
  let d =
    path === "flag"
      ? 2
      : path === "lamp"
        ? 1
        : path === "early_radio"
          ? 2
          : path === "mature_radio"
            ? 1
            : 0;
  if (opts?.isAlliedRequest) d += 2;
  if (opts?.relayHops) d += opts.relayHops * 1;
  return d;
}
export function isWithinReach(
  distanceNm: number,
  path: PathKind,
  opts?: { hasRelayConnectivity?: boolean; visibilityNm?: number; hasLOS?: boolean },
): boolean {
  const max = SHIPPED_PATH_RANGES_NM[path];
  if (path === "flag" && (opts?.visibilityNm ?? 10) < 2) return false;
  if (path === "lamp" && !opts?.hasLOS) return false;
  if (path === "data_link" && !opts?.hasRelayConnectivity) return false;
  return distanceNm <= max;
}

export function computeFailureProbabilityBp(p: {
  basePathFailureBp: number;
  visibilityPenaltyBp?: number;
  smokePenaltyBp?: number;
  jammingPenaltyBp?: number;
  flagshipDamagePenaltyBp?: number;
  confusionPenaltyBp?: number;
  commanderBonusBp?: number;
  divisionExperienceBonusBp?: number;
}): number {
  const v =
    p.basePathFailureBp +
    (p.visibilityPenaltyBp ?? 0) +
    (p.smokePenaltyBp ?? 0) +
    (p.jammingPenaltyBp ?? 0) +
    (p.flagshipDamagePenaltyBp ?? 0) +
    (p.confusionPenaltyBp ?? 0) -
    (p.commanderBonusBp ?? 0) -
    (p.divisionExperienceBonusBp ?? 0);
  return Math.max(0, Math.min(10_000, v));
}

export function evaluateTransmission(opts: {
  battleId: string;
  commandId: string;
  path: PathKind;
  attempt: number;
  failureProbabilityBp: number;
  engine: RandomEngine;
}): boolean {
  const stream = opts.engine.stream(
    `battle/command/path/transmission:${opts.battleId}:${opts.commandId}:${opts.path}:${opts.attempt}`,
  );
  // drawUniform 0..9999 inclusive -> fail if roll < probability
  const roll = Math.floor(stream.next() * 10_000);
  const failed = roll < opts.failureProbabilityBp;
  if (failed)
    throw new BluewaveError("TACTICAL_COMMAND_TRANSMISSION_FAILED", {
      code: "TACTICAL_COMMAND_TRANSMISSION_FAILED",
      battleId: opts.battleId,
      commandId: opts.commandId,
      path: opts.path,
    });
  return true;
}
