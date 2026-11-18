import type { ForceRuntime } from "../orders/force.js";
import type { DivisionAiContact, DivisionAiDivision } from "./contracts.js";
import { ceilDivide, distanceMetres, interceptPoint, nearestContact } from "./geometry.js";
import {
  allDestroyers,
  legalFormation,
  preset,
  waypoint,
  type DivisionPlan,
  type PlanContext,
} from "./plan.js";

const SIGNALING_SCALE_BP = 10_000;

export function flotillaAttackIssuedAtMinute(runtime: ForceRuntime): number | null {
  if (!runtime.state.flotillaAttackActive) return null;
  let issuedAt: number | null = null;
  for (const order of runtime.deferred) {
    if (order.kind === "FLOTILLA_ATTACK") issuedAt = order.issuedAtMinute;
    else if (order.kind === "FLOTILLA_RECALL") issuedAt = null;
  }
  return issuedAt;
}

export function flotillaDelayMinutes(signalingBp: number, baseMinutes: number): number {
  return ceilDivide(baseMinutes * SIGNALING_SCALE_BP, signalingBp);
}

export function flotillaCharging(ctx: PlanContext, division: DivisionAiDivision): boolean {
  const issuedAt = ctx.view.flotillaAttackIssuedAtMinute;
  if (issuedAt === null || !allDestroyers(division) || division.salvosLeft <= 0) return false;
  const delay = flotillaDelayMinutes(division.signalingBp, ctx.rules.flotillaBaseDelayMinutes);
  return ctx.view.minute >= issuedAt + delay;
}

export function flotillaPlan(ctx: PlanContext, division: DivisionAiDivision): DivisionPlan | null {
  if (!flotillaCharging(ctx, division)) return null;
  const guard = nearestContact(division.position, ctx.view.contacts, "DESTROYER");
  const defending =
    guard !== null &&
    distanceMetres(division.position, guard.position) < ctx.rules.selfDefenceRangeMetres;
  const target: DivisionAiContact | null = defending
    ? guard
    : (nearestContact(division.position, ctx.view.contacts, "CAPITAL") ??
      nearestContact(division.position, ctx.view.contacts));
  if (target === null) return null;
  return {
    mode: defending ? "FLOTILLA_SELF_DEFENCE" : "FLOTILLA_ATTACK",
    navigation: waypoint(interceptPoint(division.position, division.maxSpeedKnots, target)),
    speed: preset("SQUADRON_MAX"),
    formation: legalFormation(division, "LINE_ABREAST"),
  };
}
