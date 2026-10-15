//packages/combat/src/mines/sources.ts
// DESIGN-35 §3 mine sources (INC-2). A laying action references exactly one
// source kind + source id + declared inventory (or generated canonical scenario
// allocation) + ordered target belligerents + area + campaign month + laying
// policy. A source without required technology, inventory, access, control, or
// mission fails with MINE_LAYING_SOURCE_INELIGIBLE — never a silent default.
// Every source kind is a canonical §3 MineSourceKind (all six already shipped
// in constants.ts); the eligibility predicate pulls the mine type's technology
// prerequisites + eligible source kinds from mineTypeDefinitionById, so an
// unknown mine type id still fails closed with INVALID_MINE_TYPE_DEFINITION.
// Pure/deterministic: no I/O/clock/random.
import { BluewaveError, SafeInt } from "@bluewave/contracts";
import { MINE_SOURCE_KINDS, type MineSourceKind } from "./constants.js";
import { mineTypeDefinitionById, type MineTypeDefinition } from "./model.js";
import { MINE_LAYING_SOURCE_INELIGIBLE } from "./reasonCodes.js";

// Authoritative laying-inventory reference for an action: either the source
// declares an exact mine count drawn from its own availableMineCount, or a
// canonical scenario allocation (scenario-generated stock; authoritative on its
// own, DESIGN-35 §3 "exact mine inventory or generated canonical scenario
// allocation").
export type MineLayingInventory =
  | { kind: "DECLARED"; quantity: SafeInt }
  | { kind: "SCENARIO_ALLOCATION"; quantity: SafeInt; allocationId: string };

export interface MineLayingAction {
  sourceKind: MineSourceKind;
  sourceId: string;
  inventory: MineLayingInventory;
  /** Ordered target belligerent ids; MUST be non-empty (§3). */
  targetBelligerentIds: readonly string[];
  areaId: string;
  /** Campaign month as an integer (SafeInt branded). */
  campaignMonth: SafeInt;
  layingPolicyId: string;
}

// DESIGN-35 §3 source record: the five eligibility axes a laying source must
// satisfy (technology, inventory, access, control, mission). Inventory is the
// exact on-hand mine count (declared-laying axis); scenario kinds carry
// authoritative generated allocations instead (see mineLayingSourceEligible).
export interface MineSource {
  sourceKind: MineSourceKind;
  sourceId: string;
  layingParticipantId: string;
  /** Declared technology readiness (true when the source is tech-capable). */
  technologyReadiness: boolean;
  /** Technology ids the source possesses (judged against the mine type's technologyPrerequisiteIds). */
  availableTechnologyIds: readonly string[];
  /** Exact on-hand mine inventory (declared-laying axis). */
  availableMineCount: SafeInt;
  hasAccess: boolean;
  hasControl: boolean;
  hasMission: boolean;
}

// Normalized result of a successful §3 eligibility check; carries the exact
// allocated quantity (declared or scenario) the laying layer must consume.
export interface EligibleMineLayingSource {
  sourceKind: MineSourceKind;
  sourceId: string;
  layingParticipantId: string;
  mineTypeId: string;
  mineTypeDefinition: MineTypeDefinition;
  /** Inventory quantity to be laid + consumed (declared or scenario allocation). */
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

// AC-3: §3 eligibility predicate. Every axis must pass; the first failing axis
// throws MINE_LAYING_SOURCE_INELIGIBLE (field-tagged, never a silent default).
// - sourceKind: the action's kind must match the source and the mine type's
//   eligibleLayingSourceKinds (fail-closed via mineTypeDefinitionById).
// - technology: source declared ready AND holds every technologyPrerequisiteIds.
// - inventory: declared quantity must be covered by availableMineCount; a
//   scenario allocation must be present (non-empty allocationId) and positive
//   (canonical generated stock — not drawn from availableMineCount).
// - access / control / mission: booleans on the source record.
// Returns the normalized EligibleMineLayingSource when every axis passes.
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

  const mineType = mineTypeDefinitionById(mineTypeId); // fails closed on unknown id
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

// Convenience: the canonical §3 source kinds (closed vocabulary from
// constants.ts), useful to callers iterating eligibility across kinds.
export const CANONICAL_MINE_SOURCE_KINDS: readonly MineSourceKind[] = MINE_SOURCE_KINDS;
