import type {
  BlockadeState,
  CampaignSnapshot,
  NationState,
  WarDeclaration,
  WarParticipantMembership,
} from "@bluewave/campaign";
import {
  BLOCKADE_WAR_SCORE_PER_MONTH,
  NAP_VIOLATION_PENALTY,
  TENSION_PEACE,
  TENSION_WAR,
} from "@bluewave/campaign";
import type {
  AcceptPeaceCommand,
  DeclareBlockadeCommand,
  DeclareWarCommand,
} from "@bluewave/commands";
import { SafeInt } from "@bluewave/contracts";
import type { PhaseDescriptor } from "./registry.js";
import { PhaseResource } from "./phase-resource.js";

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("\u0000");
}

export function getPairRelation(snapshot: CampaignSnapshot, a: string, b: string) {
  const key = pairKey(a, b);
  return (
    snapshot["politics"]["relations"].find((r) => pairKey(r["nationA"], r["nationB"]) === key) ??
    null
  );
}

export function updateRelation(
  snapshot: CampaignSnapshot,
  a: string,
  b: string,
  patch: Partial<{
    relation: "neutral" | "allied" | "at_war" | "trade_agreement";
    tension: number;
    nap: boolean;
  }>,
): CampaignSnapshot {
  const key = pairKey(a, b);
  const relations = snapshot["politics"]["relations"].map((r) =>
    pairKey(r["nationA"], r["nationB"]) === key
      ? {
          ...r,
          ...patch,
          relation: patch["relation"] ?? r["relation"],
        }
      : r,
  );
  return {
    ...snapshot,
    politics: { ...snapshot["politics"], relations },
  };
}

export function applyDeclareWar(
  snapshot: CampaignSnapshot,
  body: DeclareWarCommand,
  campaignMonth: string,
): CampaignSnapshot {
  const declarer = body["nationId"];
  const target = body["targetNationId"];
  const warId = `war_${declarer}_${target}_${campaignMonth}`;
  const attackerSideId = `side_${declarer}`;
  const defenderSideId = `side_${target}`;

  const pair = getPairRelation(snapshot, declarer, target);
  let napPenaltyNations = snapshot["nations"];
  if (pair && pair["nap"]) {
    const current = snapshot["nations"].get(declarer);
    if (current) {
      const penalty = NAP_VIOLATION_PENALTY as number;
      const newTreasury = Math.max(0, (current["treasury"] as number) - penalty);
      const updatedNation: NationState = { ...current, treasury: SafeInt(newTreasury) };
      napPenaltyNations = new Map(snapshot["nations"]);
      napPenaltyNations.set(declarer, updatedNation);
    }
  }

  const war: WarDeclaration = {
    id: warId,
    attackerSideId,
    defenderSideId,
    attackerSideMembers: [declarer],
    defenderSideMembers: [target],
    attackerWarScore: 0,
    defenderWarScore: 0,
    attackerId: declarer,
    defenderId: target,
    startDate: campaignMonth,
    status: "DECLARED_NOT_ACTIVE",
  };

  const attackerMembership: WarParticipantMembership = {
    warId,
    nationId: declarer,
    sideId: attackerSideId,
    entryMonth: campaignMonth,
    status: "ACTIVE",
    nationalContributionPoints: 0,
  };
  const defenderMembership: WarParticipantMembership = {
    warId,
    nationId: target,
    sideId: defenderSideId,
    entryMonth: campaignMonth,
    status: "ACTIVE",
    nationalContributionPoints: 0,
  };

  let baseSnapshot = { ...snapshot, nations: napPenaltyNations };

  let next = {
    ...baseSnapshot,
    wars: {
      ...baseSnapshot["wars"],
      wars: [...baseSnapshot["wars"]["wars"], war],
      participantMemberships: [
        ...baseSnapshot["wars"]["participantMemberships"],
        attackerMembership,
        defenderMembership,
      ],
    },
  };

  next = updateRelation(next, declarer, target, {
    relation: "at_war",
    tension: TENSION_WAR,
    nap: false,
  });

  return next;
}

export function applyAcceptPeace(
  snapshot: CampaignSnapshot,
  body: AcceptPeaceCommand,
  campaignMonth: string,
): CampaignSnapshot {
  const war = snapshot["wars"]["wars"].find((w) => w["id"] === body["warId"]);
  if (!war) return snapshot;

  const wars = snapshot["wars"]["wars"].map((w) =>
    w["id"] === war["id"] ? { ...w, status: "ENDED" as const, endDate: campaignMonth } : w,
  );

  const participantMemberships = snapshot["wars"]["participantMemberships"].map((m) =>
    m["warId"] === war["id"] && m["status"] === "ACTIVE"
      ? { ...m, status: "EXITED" as const, exitMonth: campaignMonth }
      : m,
  );

  let next = {
    ...snapshot,
    wars: { ...snapshot["wars"], wars, participantMemberships },
  };

  next = updateRelation(next, war["attackerId"], war["defenderId"], {
    relation: "neutral",
    tension: TENSION_PEACE,
    nap: false,
  });

  return next;
}

export function applySetRelation(
  snapshot: CampaignSnapshot,
  nationId: string,
  partnerNationId: string,
  relation: "allied" | "neutral",
  tension: number,
): CampaignSnapshot {
  return updateRelation(snapshot, nationId, partnerNationId, { relation, tension });
}

export function applySetNap(
  snapshot: CampaignSnapshot,
  nationId: string,
  partnerNationId: string,
  nap: boolean,
): CampaignSnapshot {
  return updateRelation(snapshot, nationId, partnerNationId, { nap, tension: TENSION_PEACE });
}

export function applyDeclareBlockade(
  snapshot: CampaignSnapshot,
  body: DeclareBlockadeCommand,
  campaignMonth: string,
): CampaignSnapshot {
  const blockade: BlockadeState = {
    blockaderId: body["nationId"],
    blockadedNationId: body["targetNationId"],
    areaId: body["areaId"],
    establishedMonth: campaignMonth,
  };
  return {
    ...snapshot,
    wars: {
      ...snapshot["wars"],
      blockadeState: [...snapshot["wars"]["blockadeState"], blockade],
    },
  };
}

export function resolveDiplomacyPhase(
  snapshot: CampaignSnapshot,
  campaignMonth: string,
): CampaignSnapshot {
  let wars = snapshot["wars"]["wars"];
  let changed = false;

  const atWarWars = new Set(wars.filter((w) => w["status"] !== "ENDED").map((w) => w["id"]));

  for (const blockade of snapshot["wars"]["blockadeState"]) {
    if (blockade["establishedMonth"] > campaignMonth) continue;
    const war = wars.find(
      (w) =>
        atWarWars.has(w["id"]) &&
        (w["status"] === "ACTIVE" || w["status"] === "DECLARED_NOT_ACTIVE") &&
        w["attackerSideMembers"].includes(blockade["blockaderId"]),
    );
    if (!war) continue;
    const side = war["attackerSideMembers"].includes(blockade["blockaderId"])
      ? "attacker"
      : "defender";
    const gain = BLOCKADE_WAR_SCORE_PER_MONTH as number;
    const increment = (current: number) => Math.max(-100, Math.min(100, current + gain));
    const updated =
      side === "attacker"
        ? { ...war, attackerWarScore: increment(war["attackerWarScore"] as number) }
        : { ...war, defenderWarScore: increment(war["defenderWarScore"] as number) };
    wars = wars.map((w) => (w["id"] === war["id"] ? updated : w));
    changed = true;
  }

  if (!changed) return snapshot;
  return { ...snapshot, wars: { ...snapshot["wars"], wars } };
}

export function countActiveWarsFor(snapshot: CampaignSnapshot, nationId: string): number {
  return snapshot["wars"]["wars"].filter(
    (w) =>
      w["status"] !== "ENDED" &&
      (w["attackerSideMembers"].includes(nationId) || w["defenderSideMembers"].includes(nationId)),
  ).length;
}

export function settleWar(
  snapshot: CampaignSnapshot,
  warId: string,
  campaignMonth: string,
): CampaignSnapshot {
  const war = snapshot["wars"]["wars"].find((w) => w["id"] === warId);
  if (!war) return snapshot;
  const wars = snapshot["wars"]["wars"].map((w) =>
    w["id"] === warId ? { ...w, status: "ENDED" as const, endDate: campaignMonth } : w,
  );
  const participantMemberships = snapshot["wars"]["participantMemberships"].map((m) =>
    m["warId"] === warId && m["status"] === "ACTIVE"
      ? { ...m, status: "EXITED" as const, exitMonth: campaignMonth }
      : m,
  );
  let next = {
    ...snapshot,
    wars: { ...snapshot["wars"], wars, participantMemberships },
  };
  next = updateRelation(next, war["attackerId"], war["defenderId"], {
    relation: "neutral",
    tension: TENSION_PEACE,
    nap: false,
  });
  return next;
}

export const diplomacyPhase: PhaseDescriptor = {
  id: "resolve_diplomacy",
  name: "Diplomacy Resolution",
  order: 65,
  readPermissions: ["wars", "politics", "fleets"],
  writePermissions: ["wars", "politics"],
  rngAllowed: false,
  footprint: {
    reads: [PhaseResource.WARS, PhaseResource.POLITICS],
    writes: [PhaseResource.WARS],
    usesRng: false,
  },
  run: (ctx) => {
    ctx.currentSnapshot = resolveDiplomacyPhase(ctx.currentSnapshot, ctx.campaignMonth);
    return { status: "continue" };
  },
};
