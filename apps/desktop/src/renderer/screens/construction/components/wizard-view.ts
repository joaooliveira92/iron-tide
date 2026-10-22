import type { CompiledDesignVersion } from "@bluewave/campaign-engine";

export interface ConstructionWizardEconomy {
  readonly treasury: number;
  readonly shipyardCapacity: number;
}

export interface ConstructionWizardWorkspace {
  readonly treasuryReserved: number;
  readonly capacityReserved: number;
}

export interface ConstructionWizardView {
  readonly projectedCost: number;
  readonly projectedCapacityUnits: number;
  readonly treasury: number;
  readonly capacity: number;
  readonly reservedTreasury: number;
  readonly reservedCapacity: number;
  readonly afterTreasury: number;
  readonly afterCapacity: number;
  readonly treasuryOver: boolean;
  readonly capacityOver: boolean;
}

export function constructionWizardView(
  design: CompiledDesignVersion,
  economy: ConstructionWizardEconomy | null,
  workspace: ConstructionWizardWorkspace | null,
): ConstructionWizardView {
  const treasury = economy?.treasury ?? 0;
  const capacity = economy?.shipyardCapacity ?? 0;
  const reservedTreasury = workspace?.treasuryReserved ?? 0;
  const reservedCapacity = workspace?.capacityReserved ?? 0;
  const afterTreasury = reservedTreasury + design.projectedCost;
  const afterCapacity = reservedCapacity + design.projectedCapacityUnits;
  return {
    projectedCost: design.projectedCost,
    projectedCapacityUnits: design.projectedCapacityUnits,
    treasury,
    capacity,
    reservedTreasury,
    reservedCapacity,
    afterTreasury,
    afterCapacity,
    treasuryOver: afterTreasury > treasury,
    capacityOver: afterCapacity > capacity,
  };
}
