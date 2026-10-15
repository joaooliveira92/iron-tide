import type {
  BattleInstance,
  BattleResult,
  CampaignSnapshot,
  LostShipRecord,
  NationState,
  Ship,
} from "@bluewave/campaign";
import {
  isShipOperational,
  MAXIMUM_CONCURRENT_WARS,
  SURRENDER_SCORE,
  VICTORY_MAJOR_MAX_FRACTION,
  VICTORY_MINOR_MAX_FRACTION,
  WAR_SCORE_DECISIVE,
  WAR_SCORE_MAJOR,
  WAR_SCORE_MINOR,
} from "@bluewave/campaign";
import type { BattleResolutionResult } from "@bluewave/combat";
import { BattleResolver, resolveBattleAuto } from "@bluewave/combat";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { countActiveWarsFor, settleWar } from "./diplomacy.js";

// B-6 INC-3: the battle manifest shape `resolveBattleAuto` consumes. The
// snapshot stores manifests structurally (campaign-side mirror); the combat
// generation manifest is the authoritative runtime shape — the phase casts at
// the single lookup seam (never a deep cross-package import).
type AutoResolutionManifest = Parameters<typeof resolveBattleAuto>[0]["manifest"];

export function resolveShipStrength(snapshot: CampaignSnapshot, shipId: string): number {
  for (const [, nation] of snapshot["nations"]) {
    for (const fleet of nation["fleets"]) {
      const ship = fleet["ships"].find((s) => s["id"] === shipId);
      if (ship) return ship["firepower"] as number;
    }
  }
  return 0;
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

  // Find and promote the involved war.
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

  // Alliance / mutual-defense auto-entry for defender & attacker sides.
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
        // add to the current side
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

  // Victory classification + war score.
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
  const clamp = (v: number) => Math.max(-100, Math.min(100, v));

  const winnerScore = winnerSide === "attacker" ? war["attackerWarScore"] : war["defenderWarScore"];
  const loserScore = winnerSide === "attacker" ? war["defenderWarScore"] : war["attackerWarScore"];
  const newWinnerScore = clamp((winnerScore as number) + magnitude);
  const newLoserScore = clamp((loserScore as number) - magnitude);

  war = {
    ...war,
    attackerWarScore: winnerSide === "attacker" ? newWinnerScore : newLoserScore,
    defenderWarScore: winnerSide === "defender" ? newWinnerScore : newLoserScore,
  };

  // nationalContributionPoints for participating nations on the winning side.
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

  let next: CampaignSnapshot = {
    ...snapshot,
    wars: { ...snapshot["wars"], wars, participantMemberships },
  };

  // Surrender auto-check.
  const attackerScore = war["attackerWarScore"] as number;
  const defenderScore = war["defenderWarScore"] as number;
  if (attackerScore >= SURRENDER_SCORE || defenderScore >= SURRENDER_SCORE) {
    next = settleWar(next, war["id"], campaignMonth);
  }

  return next;
}

// B-6 INC-3: battle_resolution phase helpers (AC-8/AC-9). The tactical
// auto-resolution result (@bluewave/combat resolveBattleAuto, INC-2) is
// applied to the campaign through these pure, deterministic helpers. Never
// mutate a ship in place; every transition builds a new snapshot.

/**
 * Locate the accepted battle manifest for a battle instance. The canonical
 * match is by `manifestHash` (the battle's pre-seed content hash — DESIGN-37
 * §32); a battle with a `manifestHash` for which the snapshot carries NO
 * matching manifest is a corrupted/inconsistent state and fails closed (the
 * caller records a stable diagnostic and applies NO mutation).
 */
export function resolveBattleManifest(
  snapshot: CampaignSnapshot,
  battle: BattleInstance,
): AutoResolutionManifest | null {
  if (battle["manifestHash"] === undefined) return null;
  const manifests = snapshot["wars"]["battleManifests"] ?? [];
  const found = manifests.find((m) => m["manifestHash"] === battle["manifestHash"]);
  // The snapshot's manifests are produced by @bluewave/combat's generateBattles
  // (structurally identical); the cast only reconciles the campaign-side mirror
  // type with the combat manifest type at this single lookup seam.
  return found ? (found as unknown as AutoResolutionManifest) : null;
}

/**
 * Apply the tactical battle outcome to the campaign (AC-9): per-ship
 * accumulated battle hp loss (ADR-0026 damageReport mapping) applied to
 * `fleets[].ships[].hitPoints` clamped >= 0; terminal ships (in the result's
 * sunk lists OR derived hp == 0) REMOVED from their fleet; `inBattleId`
 * reservations cleared on every ship that fought (the battle's fleets).
 * Deterministic: ships iterate in fleet order (canonical id-sorted in the
 * battle generation); untouched ships keep their object identity.
 */
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
          // Authoritative loss (DESIGN-37 §19/§20): the ship is gone from its
          // fleet; survivors keep their damage (readiness harm is real).
          fleetChanged = true;
          continue;
        }
        if (newHp === (ship["hitPoints"] as number) && ship["inBattleId"] === undefined) {
          ships.push(ship); // untouched
          continue;
        }
        fleetChanged = true;
        // Clear the battle reservation; hitPoints carry the clamped loss.
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

/**
 * Map the tactical auto-resolution result onto the campaign `BattleResult`
 * shape (the shape `applyBattleResult` consumes for the DECIDED path and the
 * shape persisted on `BattleInstance.result`). Ties / time-limit battles carry
 * null winner/loser (ADR-0026 §7); sunk ids are canonical id-sorted.
 */
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

/**
 * The details of every ship the battle destroys (ADR-0061), taken BEFORE
 * `applyBattleConsequences` removes them from their fleets. Mirrors that function's
 * rule (in the sunk lists OR damage takes hp to 0) and fleet order, so the ledger
 * and the fleets can never disagree.
 */
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

/** Mark a battle resolved with its recorded campaign result (battles keep
 *  their canonical snapshot order — the array is mapped in place). */
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

/**
 * The M1 legacy battle-resolution path (strength-based, UNCHANGED): resolves
 * the battle via `BattleResolver`, feeds the A-3 `applyBattleResult`
 * (war score / ADR-0010 victory classification / nationalContributionPoints),
 * and records the legacy `BattleResult` with phase "resolved".
 */
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
  // The M1 BattleResolver ALWAYS decides (winner/loser non-null) — the A-3
  // war-score path keeps its exact `{ winnerId: string; loserId: string }`
  // contract; the nullable campaign BattleResult fields only carry null on the
  // auto-resolution tie/time-limit path.
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
