import {
  evaluateShipGates,
  type BattleAbsence,
  type CampaignSnapshot,
  type Ship,
} from "@bluewave/campaign";
import { compareCodePoints } from "@bluewave/deterministic";

import type { GeneratedManifest } from "./battleOffer.js";

export function battleAbsencesFor(
  snapshot: CampaignSnapshot,
  playerNationId: string,
  manifest: GeneratedManifest,
  manifests: readonly GeneratedManifest[],
): BattleAbsence[] {
  const nation = snapshot["nations"].get(playerNationId);
  if (nation === undefined) return [];

  const takenElsewhere = new Map<string, string>();
  for (const other of manifests) {
    if (other.battleId === manifest.battleId) continue;
    for (const shipId of other.persistentAssets) {
      if (!takenElsewhere.has(shipId)) takenElsewhere.set(shipId, other.battleId);
    }
  }
  const participants = new Set(manifest.persistentAssets);

  const absences: BattleAbsence[] = [];
  for (const ship of nation["fleets"].flatMap((fleet) => fleet["ships"])) {
    if (ship.isUnderConstruction) continue;
    if (ship.locationAreaId !== manifest.areaId) continue;
    if (participants.has(ship.id)) continue;
    const subject: Ship = {
      ...ship,
      inBattleId: ship.inBattleId ?? takenElsewhere.get(ship.id),
    };
    const reasons = evaluateShipGates(subject, "ENTER_BATTLE").map((reason) => reason._tag);
    if (reasons.length === 0) continue;
    absences.push({ shipId: ship.id, reasons });
  }
  return absences.sort((a, b) => compareCodePoints(a.shipId, b.shipId));
}
