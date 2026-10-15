import type { CampaignSnapshot } from "@bluewave/campaign";

/**
 * A copy of `snapshot` with the player's slot promoted to index 0, keeping
 * every other slot (including all AI slots) in its original relative order.
 * `MonthExecutor`'s command_collection authorizes human commands against
 * `slots[0]` only, so this is the delivery-seam fix for the desktop's
 * any-nation player choice. Returns the SAME snapshot when the player is
 * already first (no-op), and never mutates the input.
 */
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
