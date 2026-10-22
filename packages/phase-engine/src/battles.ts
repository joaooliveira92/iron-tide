import type {
  BattleInstance,
  BattleResult,
  CampaignSnapshot,
  LostShipRecord,
  NationState,
  Ship,
} from "@bluewave/campaign";
import {
  battleReadiness,
  isShipOperational,
  MAXIMUM_CONCURRENT_WARS,
  SURRENDER_SCORE,
  VICTORY_MAJOR_MAX_FRACTION,
  VICTORY_MINOR_MAX_FRACTION,
  WAR_SCORE_DECISIVE,
  WAR_SCORE_MAJOR,
  WAR_SCORE_MINOR,
} from "@bluewave/campaign";
import { resolve, type BattleResolutionResult } from "@bluewave/combat";
import { BattleResolver } from "@bluewave/combat/battleResolution";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { countActiveWarsFor, settleWar } from "./diplomacy.js";

type AutoResolutionManifest = Parameters<typeof resolve>[0]["manifest"];

export function resolveGenerationShipType(): string {
  return "BB";
}

export function resolveShipStrength(snapshot: CampaignSnapshot, shipId: string): number {
  for (const [, nation] of snapshot["nations"]) {
    for (const fleet of nation["fleets"]) {
      const ship = fleet["ships"].find((s) => s["id"] === shipId);
      if (ship) return ship["firepower"] as number;
    }
  }
  return 0;
}

export function resolveCampaignBattleReadiness(snapshot: CampaignSnapshot, shipId: string): number {
  for (const [, nation] of snapshot["nations"]) {
    for (const fleet of nation["fleets"]) {
      const ship = fleet["ships"].find((s) => s["id"] === shipId);
      if (ship) return battleReadiness(ship["crewQuality"]);
    }
  }
  return 0;
}

const clampWarScore = (value: number): number => Math.max(-100, Math.min(100, value));

function settleOnSurrender(
  snapshot: CampaignSnapshot,
  war: {
    readonly id: string;
    readonly attackerWarScore: number;
    readonly defenderWarScore: number;
  },
  campaignMonth: string,
): CampaignSnapshot {
  return war["attackerWarScore"] >= SURRENDER_SCORE || war["defenderWarScore"] >= SURRENDER_SCORE
    ? settleWar(snapshot, war["id"], campaignMonth)
    : snapshot;
}

export function applyWarScoreDelta(
  snapshot: CampaignSnapshot,
  warId: string,
  delta: { readonly attacker: number; readonly defender: number },
  campaignMonth: string,
): CampaignSnapshot {
  const war = snapshot["wars"]["wars"].find((w) => w["id"] === warId);
  if (war === undefined) return snapshot;
  const moved = {
    ...war,
    attackerWarScore: clampWarScore(war["attackerWarScore"] + delta.attacker),
    defenderWarScore: clampWarScore(war["defenderWarScore"] + delta.defender),
  };
  const wars = snapshot["wars"]["wars"].map((w) => (w["id"] === warId ? moved : w));
  return settleOnSurrender(
    { ...snapshot, wars: { ...snapshot["wars"], wars } },
    moved,
    campaignMonth,
  );
}

export function applyBattleResult(
  snapshot: CampaignSnapshot,
  battle: {
    attackerId: string;
    defenderId: string;
    attackerFleetIds: string[];
    defenderFleetIds: string[];
  },
  result: { winnerId: string; loserId: string; damageReport: Record<string, SafeInt> },
  campaignMonth: string,
  _collector: DiagnosticCollector,
): CampaignSnapshot {
  let wars = snapshot["wars"]["wars"];
  let participantMemberships = snapshot["wars"]["participantMemberships"];

  const warIdx = wars.findIndex(
    (w) =>
      (w["attackerId"] === battle["attackerId"] && w["defenderId"] === battle["defenderId"]) ||
      (w["attackerId"] === battle["defenderId"] && w["defenderId"] === battle["attackerId"]),
  );

  if (warIdx === -1) return snapshot;

  let war = wars[warIdx]!;
  if (war["status"] === "DECLARED_NOT_ACTIVE") {
    war = { ...war, status: "ACTIVE" as const };
  }

  let attackerSideMembers = [...war["attackerSideMembers"]];
  let defenderSideMembers = [...war["defenderSideMembers"]];

  for (const [sideNationId, sideMembers, targetMembers] of [
    [battle["defenderId"], defenderSideMembers, attackerSideMembers] as const,
    [battle["attackerId"], attackerSideMembers, defenderSideMembers] as const,
  ]) {
    void sideNationId;
    for (const memberNationId of sideMembers) {
      const allies = snapshot["politics"]["relations"]
        .filter(
          (r) =>
            (r["nationA"] === memberNationId || r["nationB"] === memberNationId) &&
            r["relation"] === "allied",
        )
        .map((r) => (r["nationA"] === memberNationId ? r["nationB"] : r["nationA"]));
      for (const ally of allies) {
        if (targetMembers.includes(ally) || sideMembers.includes(ally)) continue;
        if (sideMembers.length + targetMembers.length >= MAXIMUM_CONCURRENT_WARS * 2) continue;
        if (countActiveWarsFor(snapshot, ally) >= MAXIMUM_CONCURRENT_WARS) continue;
        const warId = war["id"];
        if (sideMembers === defenderSideMembers) {
          defenderSideMembers = [...defenderSideMembers, ally];
        } else {
          attackerSideMembers = [...attackerSideMembers, ally];
        }
        participantMemberships = [
          ...participantMemberships,
          {
            warId,
            nationId: ally,
            sideId:
              sideMembers === defenderSideMembers ? war["defenderSideId"] : war["attackerSideId"],
            entryMonth: campaignMonth,
            status: "ACTIVE" as const,
            nationalContributionPoints: 0,
          },
        ];
      }
    }
  }

  war = {
    ...war,
    attackerSideMembers,
    defenderSideMembers,
    status: war["status"],
  };

  const loserId = result["loserId"];
  const attackerWins = result["winnerId"] === battle["attackerId"];
  const loserIsAttacker = loserId === battle["attackerId"];
  const loserFleetIds = loserIsAttacker ? battle["attackerFleetIds"] : battle["defenderFleetIds"];
  const loserNation = snapshot["nations"].get(loserId);
  const loserShips = loserNation
    ? loserNation["fleets"]
        .filter((f) => loserFleetIds.includes(f["id"]))
        .flatMap((f) => f["ships"])
        .filter((s) => isShipOperational(s))
    : [];

  const totalHp = loserShips.reduce((sum, s) => sum + (s["hitPoints"] as number), 0);
  const lossHp = loserShips.reduce(
    (sum, s) => sum + Number(result["damageReport"][s["id"]] ?? 0),
    0,
  );
  const lossFraction = totalHp > 0 ? lossHp / totalHp : 1;

  const level =
    lossFraction >= VICTORY_MAJOR_MAX_FRACTION
      ? "decisive"
      : lossFraction >= VICTORY_MINOR_MAX_FRACTION
        ? "major"
        : "minor";
  const magnitude =
    level === "decisive"
      ? (WAR_SCORE_DECISIVE as number)
      : level === "major"
        ? (WAR_SCORE_MAJOR as number)
        : (WAR_SCORE_MINOR as number);

  const winnerSide = attackerWins ? "attacker" : "defender";
  const clamp = clampWarScore;

  const winnerScore = winnerSide === "attacker" ? war["attackerWarScore"] : war["defenderWarScore"];
  const loserScore = winnerSide === "attacker" ? war["defenderWarScore"] : war["attackerWarScore"];
  const newWinnerScore = clamp((winnerScore as number) + magnitude);
  const newLoserScore = clamp((loserScore as number) - magnitude);

  war = {
    ...war,
    attackerWarScore: winnerSide === "attacker" ? newWinnerScore : newLoserScore,
    defenderWarScore: winnerSide === "defender" ? newWinnerScore : newLoserScore,
  };

  const contributionDelta = Math.floor(lossHp / 1000);
  const winnerMembers =
    winnerSide === "attacker" ? war["attackerSideMembers"] : war["defenderSideMembers"];
  if (contributionDelta > 0) {
    participantMemberships = participantMemberships.map((m) =>
      m["warId"] === war["id"] && winnerMembers.includes(m["nationId"])
        ? {
            ...m,
            nationalContributionPoints:
              (m["nationalContributionPoints"] as number) + contributionDelta,
          }
        : m,
    );
  }

  wars = wars.map((w) => (w["id"] === war["id"] ? war : w));

  const next: CampaignSnapshot = {
    ...snapshot,
    wars: { ...snapshot["wars"], wars, participantMemberships },
  };

  return settleOnSurrender(next, war, campaignMonth);
}

export function resolveBattleManifest(
  snapshot: CampaignSnapshot,
  battle: BattleInstance,
): AutoResolutionManifest | null {
  if (battle["manifestHash"] === undefined) return null;
  const manifests = snapshot["wars"]["battleManifests"] ?? [];
  const found = manifests.find((m) => m["manifestHash"] === battle["manifestHash"]);
  return found ? (found as unknown as AutoResolutionManifest) : null;
}

export function applyBattleConsequences(
  snapshot: CampaignSnapshot,
  battle: BattleInstance,
  result: Pick<BattleResolutionResult, "damageReport" | "attackerSunkIds" | "defenderSunkIds">,
): CampaignSnapshot {
  const sunkIds = new Set<string>([...result.attackerSunkIds, ...result.defenderSunkIds]);
  const battleFleetIds = new Set<string>([...battle.attackerFleetIds, ...battle.defenderFleetIds]);
  const updatedNations = new Map<string, NationState>();
  let changed = false;

  for (const [nationId, nation] of snapshot["nations"]) {
    let fleetsChanged = false;
    const fleets = nation["fleets"].map((fleet) => {
      if (!battleFleetIds.has(fleet["id"])) return fleet;
      const ships: Ship[] = [];
      let fleetChanged = false;
      for (const ship of fleet["ships"]) {
        const loss = Number(result.damageReport[ship["id"]] ?? 0);
        const newHp = Math.max(0, (ship["hitPoints"] as number) - loss);
        const isSunk = sunkIds.has(ship["id"]) || newHp <= 0;
        if (isSunk) {
          fleetChanged = true;
          continue;
        }
        if (newHp === (ship["hitPoints"] as number) && ship["inBattleId"] === undefined) {
          ships.push(ship);
          continue;
        }
        fleetChanged = true;
        const { inBattleId: _reservation, ...rest } = ship;
        ships.push({ ...rest, hitPoints: SafeInt(newHp) });
      }
      if (fleetChanged) fleetsChanged = true;
      return fleetChanged ? { ...fleet, ships } : fleet;
    });
    if (fleetsChanged) {
      changed = true;
      updatedNations.set(nationId, { ...nation, fleets });
    } else {
      updatedNations.set(nationId, nation);
    }
  }

  return changed ? { ...snapshot, nations: updatedNations } : snapshot;
}

export function toCampaignBattleResult(
  auto: BattleResolutionResult,
  lostShips: LostShipRecord[] = [],
): BattleResult {
  return {
    winnerId: auto.winnerId,
    loserId: auto.loserId,
    attackerLosses: [...auto.attackerSunkIds].sort(),
    defenderLosses: [...auto.defenderSunkIds].sort(),
    damageReport: auto.damageReport,
    explanation: [
      `auto-resolved (${auto.battleEndReason}) after ${String(auto.elapsedMinutes)} battle minutes`,
    ],
    ...(lostShips.length > 0 ? { lostShips } : {}),
  };
}

export function collectLostShips(
  snapshot: CampaignSnapshot,
  battle: BattleInstance,
  result: Pick<
    BattleResolutionResult,
    "damageReport" | "attackerSunkIds" | "defenderSunkIds" | "causeOfLoss"
  >,
  campaignMonth: string,
): LostShipRecord[] {
  const sunkIds = new Set<string>([...result.attackerSunkIds, ...result.defenderSunkIds]);
  const battleFleetIds = new Set<string>([...battle.attackerFleetIds, ...battle.defenderFleetIds]);
  const lost: LostShipRecord[] = [];
  for (const nation of snapshot["nations"].values()) {
    for (const fleet of nation["fleets"]) {
      if (!battleFleetIds.has(fleet["id"])) continue;
      for (const ship of fleet["ships"]) {
        const loss = Number(result.damageReport[ship["id"]] ?? 0);
        const newHp = Math.max(0, (ship["hitPoints"] as number) - loss);
        if (!sunkIds.has(ship["id"]) && newHp > 0) continue;
        const cause = result.causeOfLoss?.[ship["id"]];
        lost.push({
          shipId: ship["id"],
          name: ship["name"],
          classId: ship["classId"],
          nationId: ship["nationId"],
          month: campaignMonth,
          ...(cause !== undefined ? { cause } : {}),
        });
      }
    }
  }
  return lost;
}

export function recordResolvedBattle(
  snapshot: CampaignSnapshot,
  battle: BattleInstance,
  result: BattleResult,
): CampaignSnapshot {
  const battles = snapshot["wars"]["battles"].map((b) =>
    b["id"] === battle["id"] ? { ...b, phase: "resolved" as const, result } : b,
  );
  return { ...snapshot, wars: { ...snapshot["wars"], battles } };
}

export function resolveLegacyBattle(
  snapshot: CampaignSnapshot,
  battle: BattleInstance,
  attacker: NationState,
  defender: NationState,
  randomEngine: import("@bluewave/random").RandomEngine,
  resolver: BattleResolver,
  campaignMonth: string,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const result = resolver.resolve(battle, attacker, defender, randomEngine);
  let next = applyBattleResult(
    snapshot,
    battle,
    { winnerId: result.winnerId!, loserId: result.loserId!, damageReport: result.damageReport },
    campaignMonth,
    collector,
  );
  next = recordResolvedBattle(next, battle, result);
  return next;
}
