import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { MINE_SOURCE_KINDS, type MineSourceKind } from "./constants.js";
import { mineTypeDefinitionById, type MineTypeDefinition } from "./model.js";
import { MINE_LAYING_SOURCE_INELIGIBLE } from "./reasonCodes.js";

export type MineLayingInventory =
  | { kind: "DECLARED"; quantity: SafeInt }
  | { kind: "SCENARIO_ALLOCATION"; quantity: SafeInt; allocationId: string };

export interface MineLayingAction {
  sourceKind: MineSourceKind;
  sourceId: string;
  inventory: MineLayingInventory;
  targetBelligerentIds: readonly string[];
  areaId: string;
  campaignMonth: SafeInt;
  layingPolicyId: string;
}

export interface MineSource {
  sourceKind: MineSourceKind;
  sourceId: string;
  layingParticipantId: string;
  technologyReadiness: boolean;
  availableTechnologyIds: readonly string[];
  availableMineCount: SafeInt;
  hasAccess: boolean;
  hasControl: boolean;
  hasMission: boolean;
}

export interface EligibleMineLayingSource {
  sourceKind: MineSourceKind;
  sourceId: string;
  layingParticipantId: string;
  mineTypeId: string;
  mineTypeDefinition: MineTypeDefinition;
  allocatedQuantity: SafeInt;
  allocationKind: MineLayingInventory["kind"];
  targetBelligerentIds: readonly string[];
  areaId: string;
  campaignMonth: SafeInt;
  layingPolicyId: string;
}

function ineligible(
  source: MineSource,
  action: MineLayingAction,
  field: string,
  reason: string,
  value: unknown,
): never {
  throw new BluewaveError(MINE_LAYING_SOURCE_INELIGIBLE, {
    code: MINE_LAYING_SOURCE_INELIGIBLE,
    sourceId: source.sourceId,
    sourceKind: source.sourceKind,
    field,
    reason,
    value,
  });
}

function isPositiveSafeInt(v: unknown): v is SafeInt {
  return SafeInt.isSafeInt(v as number) && (v as number) > 0;
}

export function mineLayingSourceEligible(
  source: MineSource,
  action: MineLayingAction,
  mineTypeId: string,
): EligibleMineLayingSource {
  if (action.sourceKind !== source.sourceKind) {
    ineligible(
      source,
      action,
      "sourceKind",
      "action source kind must match the referenced source's kind",
      { actionSourceKind: action.sourceKind, sourceKind: source.sourceKind },
    );
  }

  const mineType = mineTypeDefinitionById(mineTypeId);
  if (!(mineType.eligibleLayingSourceKinds as readonly string[]).includes(action.sourceKind)) {
    ineligible(
      source,
      action,
      "sourceKind",
      "mine type does not permit this source kind for laying",
      { mineTypeId, sourceKind: action.sourceKind },
    );
  }

  if (!source.technologyReadiness) {
    ineligible(source, action, "technology", "source is not technology-ready", {
      technologyReadiness: source.technologyReadiness,
    });
  }
  for (const prereq of mineType.technologyPrerequisiteIds) {
    if (!source.availableTechnologyIds.includes(prereq)) {
      ineligible(source, action, "technology", "source lacks a required technology prerequisite", {
        missingPrerequisite: prereq,
        mineTypeId,
      });
    }
  }

  let allocatedQuantity: SafeInt;
  if (action.inventory.kind === "DECLARED") {
    if (!isPositiveSafeInt(action.inventory.quantity)) {
      ineligible(source, action, "inventory", "declared inventory must be a positive integer", {
        quantity: action.inventory.quantity,
      });
    }
    if (source.availableMineCount < action.inventory.quantity) {
      ineligible(
        source,
        action,
        "inventory",
        "available mine inventory is below the declared quantity",
        {
          availableMineCount: source.availableMineCount,
          declaredQuantity: action.inventory.quantity,
        },
      );
    }
    allocatedQuantity = action.inventory.quantity;
  } else {
    if (
      typeof action.inventory.allocationId !== "string" ||
      action.inventory.allocationId.length === 0
    ) {
      ineligible(source, action, "inventory", "scenario allocation id is required", {
        allocationId: action.inventory.allocationId,
      });
    }
    if (!isPositiveSafeInt(action.inventory.quantity)) {
      ineligible(source, action, "inventory", "scenario allocation must be positive", {
        quantity: action.inventory.quantity,
      });
    }
    allocatedQuantity = action.inventory.quantity;
  }

  if (!source.hasAccess) {
    ineligible(source, action, "access", "source lacks access to the laying area", {
      hasAccess: source.hasAccess,
    });
  }
  if (!source.hasControl) {
    ineligible(source, action, "control", "source lacks control over the laying area/facilities", {
      hasControl: source.hasControl,
    });
  }
  if (!source.hasMission) {
    ineligible(source, action, "mission", "no validated laying mission is active", {
      hasMission: source.hasMission,
    });
  }

  if (!Array.isArray(action.targetBelligerentIds) || action.targetBelligerentIds.length === 0) {
    ineligible(
      source,
      action,
      "targetBelligerents",
      "ordered target belligerents must be non-empty",
      {
        targetBelligerents: action.targetBelligerentIds,
      },
    );
  }
  for (const id of action.targetBelligerentIds) {
    if (typeof id !== "string" || id.length === 0) {
      ineligible(
        source,
        action,
        "targetBelligerents",
        "every target belligerent id must be non-empty",
        {
          targetBelligerentIds: action.targetBelligerentIds,
        },
      );
    }
  }

  return {
    sourceKind: source.sourceKind,
    sourceId: source.sourceId,
    layingParticipantId: source.layingParticipantId,
    mineTypeId,
    mineTypeDefinition: mineType,
    allocatedQuantity,
    allocationKind: action.inventory.kind,
    targetBelligerentIds: [...action.targetBelligerentIds],
    areaId: action.areaId,
    campaignMonth: action.campaignMonth,
    layingPolicyId: action.layingPolicyId,
  };
}

export const CANONICAL_MINE_SOURCE_KINDS: readonly MineSourceKind[] = MINE_SOURCE_KINDS;
