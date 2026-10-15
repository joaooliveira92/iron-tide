/**
 * The TREASURY + CAPACITY reservation requirements one construction order
 * commits — the exact shape `ReservationManager.reserve` checks, shared by
 * the submit/replace/cancel paths and the post-restart reconstruction so the
 * amounts and units can never drift apart.
 */
export function reservationRequirementsFor(
  playerSlotId: string,
  costs: { projectedCost: number; projectedCapacityUnits: number },
): Array<{
  resourceTypeId: string;
  resourceId: string;
  quantity: number;
  canonicalUnit: string;
  priority: number;
}> {
  return [
    {
      resourceTypeId: "TREASURY",
      resourceId: playerSlotId,
      quantity: costs.projectedCost,
      canonicalUnit: "TREASURY",
      priority: 1,
    },
    {
      resourceTypeId: "CAPACITY",
      resourceId: playerSlotId,
      quantity: costs.projectedCapacityUnits,
      canonicalUnit: "CAPACITY_UNITS",
      priority: 1,
    },
  ];
}
