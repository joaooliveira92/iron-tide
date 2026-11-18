import type { TacticalDivision } from "../tactical/division.js";
import { EFFECT_CLAMP_MAX, EFFECT_CLAMP_MIN } from "../tactical/division.js";
import type { DivisionOrder, DivisionOrderControl, DivisionOrderSet } from "./contracts.js";
import type { ForceOrderRuleset } from "./forceConstants.js";
import type { ForceOrder, ForceOrderSet, ForceState } from "./forceContracts.js";
import {
  applyRally,
  decayRally,
  type ForceMoraleTrack,
  type ForceSituation,
  type RallyBoost,
} from "./forceMorale.js";
import { orderPermitted, type RealismMode } from "./realism.js";
import {
  FORCE_ORDER_LEAD_ALREADY,
  FORCE_ORDER_LEAD_CHANGE_USED,
  FORCE_ORDER_NOT_PLAYER_CONTROLLED,
  FORCE_ORDER_TURN_AWAY_USED,
  FORCE_ORDER_UNKNOWN_DIVISION,
  FORCE_ORDER_UNKNOWN_FORCE,
  ORDER_NOT_PERMITTED_AT_REALISM,
  type ForceOrderIssueCode,
} from "./reasonCodes.js";

export interface ForceLead {
  readonly divisionId: string;
  readonly dependantIds: readonly string[];
}

export interface ForceConfusion {
  readonly untilMinute: number;
  readonly penaltyBp: number;
}

export interface ForceRuntime {
  readonly state: ForceState;
  readonly lead: ForceLead | null;
  readonly rallyBoosts: readonly RallyBoost[];
  readonly confusion: ForceConfusion | null;
  readonly deferred: readonly ForceOrder[];
}

export interface ForceOrderIssue {
  readonly code: ForceOrderIssueCode;
  readonly forceId: string;
  readonly kind: ForceOrder["kind"];
  readonly divisionId?: string;
}

export interface AdvanceForceInput {
  readonly forceId: string;
  readonly orders: ForceOrderSet;
  readonly runtime: ForceRuntime;
  readonly minute: number;
  readonly realismMode: RealismMode;
  readonly control: DivisionOrderControl;
  readonly divisions: readonly TacticalDivision[];
  readonly divisionOrders: DivisionOrderSet;
  readonly situation: ForceSituation;
  readonly ruleset: ForceOrderRuleset;
}

export interface AdvanceForceResult {
  readonly runtime: ForceRuntime;
  readonly divisionOrders: DivisionOrderSet;
  readonly issues: readonly ForceOrderIssue[];
}

export function createForceRuntime(ruleset: ForceOrderRuleset): ForceRuntime {
  return {
    state: {
      moraleBp: ruleset.neutralMoraleBp,
      flotillaAttackActive: false,
      leadChangeUsed: false,
      turnAwayUsed: false,
    },
    lead: null,
    rallyBoosts: [],
    confusion: null,
    deferred: [],
  };
}

export function forceFormationCohesionBp(
  baseBp: number,
  runtime: ForceRuntime,
  minute: number,
): number {
  const confusion = runtime.confusion;
  if (confusion === null || minute >= confusion.untilMinute) return baseBp;
  return Math.min(EFFECT_CLAMP_MAX, Math.max(EFFECT_CLAMP_MIN, baseBp - confusion.penaltyBp));
}

function effectiveRole(order: DivisionOrder, division: TacticalDivision): string {
  return order.role ?? division.role;
}

function currentLead(
  runtime: ForceRuntime,
  forceDivisions: readonly TacticalDivision[],
  byId: ReadonlyMap<string, DivisionOrder>,
): string | null {
  if (runtime.lead !== null) return runtime.lead.divisionId;
  for (const division of forceDivisions) {
    const order = byId.get(division.tacticalDivisionId);
    if (order === undefined) continue;
    if (effectiveRole(order, division) === "INDEPENDENT" && order.leadDivisionId === null) {
      return division.tacticalDivisionId;
    }
  }
  return null;
}

function dependantsOf(
  lead: string | null,
  target: string,
  forceDivisions: readonly TacticalDivision[],
  byId: ReadonlyMap<string, DivisionOrder>,
): readonly string[] {
  const ids: string[] = [];
  for (const division of forceDivisions) {
    const id = division.tacticalDivisionId;
    if (id === target) continue;
    const order = byId.get(id);
    if (order === undefined) continue;
    const followsLead =
      lead === null
        ? order.leadDivisionId === null && effectiveRole(order, division) !== "INDEPENDENT"
        : id === lead || order.leadDivisionId === lead;
    if (followsLead) ids.push(id);
  }
  return ids;
}

function overlayLead(set: DivisionOrderSet, lead: ForceLead | null): DivisionOrderSet {
  if (lead === null) return set;
  const dependants = new Set(lead.dependantIds);
  return {
    ...set,
    divisions: set.divisions.map((order) => {
      if (order.divisionId === lead.divisionId) {
        return { ...order, role: "INDEPENDENT", leadDivisionId: null };
      }
      return dependants.has(order.divisionId)
        ? { ...order, leadDivisionId: lead.divisionId }
        : order;
    }),
  };
}

export function advanceForce(input: AdvanceForceInput): AdvanceForceResult {
  const issues: ForceOrderIssue[] = [];
  const decayed: ForceMoraleTrack = decayRally({
    moraleBp: input.runtime.state.moraleBp,
    boosts: input.runtime.rallyBoosts,
  });
  let track = decayed;
  let state: ForceState = { ...input.runtime.state, moraleBp: track.moraleBp };
  let lead = input.runtime.lead;
  let confusion = input.runtime.confusion;
  const deferred: ForceOrder[] = [...input.runtime.deferred];

  const forceDivisions = input.divisions
    .filter((division) => division.sideId === input.forceId)
    .sort((a, b) => (a.tacticalDivisionId < b.tacticalDivisionId ? -1 : 1));
  const byId = new Map(input.divisionOrders.divisions.map((order) => [order.divisionId, order]));
  const reject = (order: ForceOrder, code: ForceOrderIssueCode): void => {
    issues.push({
      code,
      forceId: order.forceId,
      kind: order.kind,
      ...(order.kind === "CHANGE_LEAD_DIVISION" ? { divisionId: order.divisionId } : {}),
    });
  };

  for (const order of input.orders.orders) {
    if (order.issuedAtMinute !== input.minute) continue;
    if (input.control !== "PLAYER") {
      reject(order, FORCE_ORDER_NOT_PLAYER_CONTROLLED);
      continue;
    }
    if (order.forceId !== input.forceId) {
      reject(order, FORCE_ORDER_UNKNOWN_FORCE);
      continue;
    }
    if (!orderPermitted(input.realismMode, "FORCE_ORDERS")) {
      reject(order, ORDER_NOT_PERMITTED_AT_REALISM);
      continue;
    }
    switch (order.kind) {
      case "RALLY": {
        track = applyRally(track, input.situation, input.ruleset);
        state = { ...state, moraleBp: track.moraleBp };
        break;
      }
      case "FLOTILLA_ATTACK":
      case "FLOTILLA_RECALL": {
        state = { ...state, flotillaAttackActive: order.kind === "FLOTILLA_ATTACK" };
        deferred.push(order);
        break;
      }
      case "DISENGAGE": {
        deferred.push(order);
        break;
      }
      case "BATTLE_TURN_AWAY": {
        if (state.turnAwayUsed) {
          reject(order, FORCE_ORDER_TURN_AWAY_USED);
          break;
        }
        state = { ...state, turnAwayUsed: true };
        deferred.push(order);
        break;
      }
      case "CHANGE_LEAD_DIVISION": {
        if (state.leadChangeUsed) {
          reject(order, FORCE_ORDER_LEAD_CHANGE_USED);
          break;
        }
        if (!forceDivisions.some((division) => division.tacticalDivisionId === order.divisionId)) {
          reject(order, FORCE_ORDER_UNKNOWN_DIVISION);
          break;
        }
        const previous = currentLead({ ...input.runtime, lead }, forceDivisions, byId);
        if (previous === order.divisionId) {
          reject(order, FORCE_ORDER_LEAD_ALREADY);
          break;
        }
        lead = {
          divisionId: order.divisionId,
          dependantIds: dependantsOf(previous, order.divisionId, forceDivisions, byId),
        };
        confusion = {
          untilMinute: input.minute + input.ruleset.confusionMinutes,
          penaltyBp: input.ruleset.confusionPenaltyBp,
        };
        state = { ...state, leadChangeUsed: true };
        break;
      }
    }
  }

  return {
    runtime: {
      state,
      lead,
      rallyBoosts: track.boosts,
      confusion,
      deferred,
    },
    divisionOrders: overlayLead(input.divisionOrders, lead),
    issues,
  };
}
