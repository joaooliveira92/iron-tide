import type { CampaignSnapshot } from "@bluewave/campaign";

export function promotePlayerSlotForExecution(
  snapshot: CampaignSnapshot,
  playerSlotId: string,
): CampaignSnapshot {
  const playerIndex = snapshot.slots.findIndex((slot) => slot.nationId === playerSlotId);
  if (playerIndex <= 0) return snapshot;
  const playerSlot = snapshot.slots[playerIndex]!;
  return {
    ...snapshot,
    slots: [
      playerSlot,
      ...snapshot.slots.slice(0, playerIndex),
      ...snapshot.slots.slice(playerIndex + 1),
    ],
  };
}
