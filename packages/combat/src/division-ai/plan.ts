import type { DivisionFormation } from "@bluewave/campaign";
import type { DivisionNavigation, DivisionSpeed } from "../orders/contracts.js";
import { formationLegality } from "../tactical/division.js";
import type { DivisionAiContact, DivisionAiDivision, DivisionAiView, Point } from "./contracts.js";
import {
  bearingDegrees,
  clampInt,
  clampKnots,
  clampPoint,
  directionOf,
  distanceMetres,
  nearestContact,
  offsetPoint,
  relativeDegrees,
  roundedDivide,
} from "./geometry.js";
import type { DivisionAiMemoryEntry } from "./memory.js";
import type { DivisionAiRules } from "./rules.js";
import type { DivisionAiMode } from "./reasonCodes.js";

export interface DivisionPlan {
  readonly mode: DivisionAiMode;
  readonly navigation: DivisionNavigation;
  readonly speed: DivisionSpeed;
  readonly formation: DivisionFormation;
}

export interface DivisionDraft {
  supportSide: DivisionAiMemoryEntry["supportSide"];
  attacking: boolean;
  patrolAnchor: Point | null;
  waypointIndex: number;
}

export interface PlanContext {
  readonly view: DivisionAiView;
  readonly rules: DivisionAiRules;
  readonly lead: DivisionAiDivision;
  readonly leadIsPlayer: boolean;
  readonly tier: 0 | 1 | 2;
  readonly leadShipCount: number;
  readonly leadThreat: DivisionAiContact | null;
  readonly threatBearingDeg: number;
}

export function createPlanContext(view: DivisionAiView, rules: DivisionAiRules): PlanContext {
  const lead = view.divisions.find((division) => division.divisionId === view.leadDivisionId)!;
  const leadThreat = nearestContact(lead.position, view.contacts);
  const tier =
    view.moraleBp < rules.withdrawBelowBp ? 2 : view.moraleBp < rules.openRangeBelowBp ? 1 : 0;
  return {
    view,
    rules,
    lead,
    leadIsPlayer: lead.control === "PLAYER",
    tier,
    leadShipCount: lead.shipTypes.length,
    leadThreat,
    threatBearingDeg:
      leadThreat === null ? lead.headingDeg : bearingDegrees(lead.position, leadThreat.position),
  };
}

export function waypoint(point: Point): DivisionNavigation {
  const clamped = clampPoint(point);
  return {
    kind: "WAYPOINT",
    xMetres: clamped.xMetres,
    yMetres: clamped.yMetres,
    pauseOnArrival: false,
  };
}

export function knots(division: DivisionAiDivision, value: number): DivisionSpeed {
  return { kind: "KNOTS", knots: clampKnots(value, division.maxSpeedKnots) };
}

export function preset(value: "MAX_MINUS_2" | "SQUADRON_MAX"): DivisionSpeed {
  return { kind: "PRESET", preset: value };
}

export function followSpeed(
  ctx: PlanContext,
  division: DivisionAiDivision,
  target: Point,
  baseKnots: number,
  catchUpMaxKnots: number,
): DivisionSpeed {
  const [cos, sin] = directionOf(ctx.lead.headingDeg);
  const forwardError = roundedDivide(
    (target.xMetres - division.position.xMetres) * cos +
      (target.yMetres - division.position.yMetres) * sin,
    10_000,
  );
  const adjustment = clampInt(roundedDivide(forwardError, 400), -4, catchUpMaxKnots);
  return knots(division, baseKnots + adjustment);
}

export function awayPoint(
  ctx: PlanContext,
  division: DivisionAiDivision,
  from: DivisionAiContact,
): Point {
  return offsetPoint(
    division.position,
    bearingDegrees(from.position, division.position),
    ctx.rules.awayDistanceMetres,
  );
}

export function legalFormation(
  division: DivisionAiDivision,
  wanted: DivisionFormation,
): DivisionFormation {
  const legal = formationLegality(wanted, {
    role: division.role,
    shipCount: division.shipTypes.length,
    allDestroyers: allDestroyers(division),
    searchCapable: division.searchCapable,
  });
  return legal ? wanted : division.formation;
}

export function allDestroyers(division: DivisionAiDivision): boolean {
  return division.shipTypes.every((type) => type === "DD");
}

export function disengagedSide(ctx: PlanContext): -1 | 1 {
  const relative = relativeDegrees(ctx.threatBearingDeg, ctx.lead.headingDeg);
  return directionOf(relative)[1] >= 0 ? -1 : 1;
}

export function reversalOffArc(
  ctx: PlanContext,
  division: DivisionAiDivision,
  headingDeg: number,
  keepWithinMetres: number,
): boolean {
  const off = Math.abs(
    relativeDegrees(bearingDegrees(ctx.lead.position, division.position), headingDeg),
  );
  return (
    off > ctx.rules.reversalArcDegrees &&
    distanceMetres(division.position, ctx.lead.position) <
      keepWithinMetres + ctx.rules.reversalSlackMetres
  );
}
