import { BluewaveError } from "@bluewave/contracts";
export const WITHDRAWAL_PERSISTENCE_MINUTES = 5 as const;
export interface ExitZone {
  id: string;
  side: string;
  polygon: [number, number][];
  eligibleSides: string[];
}
export function isInExitZone(pos: [number, number], zone: ExitZone): boolean {
  let inside = false;
  for (let i = 0, j = zone.polygon.length - 1; i < zone.polygon.length; j = i++) {
    const pi = zone.polygon[i]!;
    const pj = zone.polygon[j]!;
    const xi = pi[0]!,
      yi = pi[1]!,
      xj = pj[0]!,
      yj = pj[1]!;
    if (yi > pos[1] !== yj > pos[1] && pos[0] < ((xj - xi) * (pos[1] - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

export function assertWithdrawalSuccess(p: {
  inExitZone: boolean;
  hasDisengageOrder: boolean;
  involuntaryRetreat: boolean;
  enemyContactConfidenceBp: number;
  pursuitRangeNm: number;
  withinPursuit: boolean;
  speedOk: boolean;
  notBlocked: boolean;
  missionPermitsOrAccepted: boolean;
  minutesInZone: number;
  contactReset: boolean;
}) {
  if (!p.inExitZone)
    throw new BluewaveError("BATTLE_EXIT_ZONE_INELIGIBLE", { code: "BATTLE_EXIT_ZONE_INELIGIBLE" });
  if (!p.hasDisengageOrder && !p.involuntaryRetreat)
    throw new BluewaveError("BATTLE_WITHDRAWAL_INCOMPLETE", {
      code: "BATTLE_WITHDRAWAL_INCOMPLETE",
      reason: "order",
    });
  if (p.enemyContactConfidenceBp >= 6_000 && p.withinPursuit)
    throw new BluewaveError("BATTLE_WITHDRAWAL_INCOMPLETE", {
      code: "BATTLE_WITHDRAWAL_INCOMPLETE",
      reason: "pursuit",
    });
  if (!p.speedOk)
    throw new BluewaveError("BATTLE_WITHDRAWAL_INCOMPLETE", {
      code: "BATTLE_WITHDRAWAL_INCOMPLETE",
      reason: "speed",
    });
  if (!p.notBlocked)
    throw new BluewaveError("BATTLE_WITHDRAWAL_INCOMPLETE", {
      code: "BATTLE_WITHDRAWAL_INCOMPLETE",
      reason: "blocked",
    });
  if (!p.missionPermitsOrAccepted)
    throw new BluewaveError("BATTLE_WITHDRAWAL_INCOMPLETE", {
      code: "BATTLE_WITHDRAWAL_INCOMPLETE",
      reason: "mission",
    });
  if (p.minutesInZone < 5 || p.contactReset)
    throw new BluewaveError("BATTLE_WITHDRAWAL_INCOMPLETE", {
      code: "BATTLE_WITHDRAWAL_INCOMPLETE",
      reason: "persistence",
    });
}
