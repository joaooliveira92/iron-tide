import type { DivisionAiDivision, Point } from "./contracts.js";
import { distanceMetres, nearestContact, offsetPoint, bearingDegrees } from "./geometry.js";
import { PATROL_WAYPOINT_COUNT } from "./memory.js";
import {
  awayPoint,
  knots,
  preset,
  waypoint,
  type DivisionDraft,
  type DivisionPlan,
  type PlanContext,
} from "./plan.js";
import type { DivisionAiMode } from "./reasonCodes.js";
import type { RoleBehaviour } from "./roleBehaviour.js";

function patrolCorners(anchor: Point, radius: number): readonly Point[] {
  return [
    { xMetres: anchor.xMetres + radius, yMetres: anchor.yMetres },
    { xMetres: anchor.xMetres, yMetres: anchor.yMetres + radius },
    { xMetres: anchor.xMetres - radius, yMetres: anchor.yMetres },
    { xMetres: anchor.xMetres, yMetres: anchor.yMetres - radius },
  ];
}

function patrolChoose(
  ctx: PlanContext,
  division: DivisionAiDivision,
  draft: DivisionDraft,
): DivisionAiMode {
  draft.patrolAnchor ??= ctx.view.objective ?? ctx.lead.position;
  const foe = nearestContact(division.position, ctx.view.contacts);
  if (
    foe !== null &&
    distanceMetres(division.position, foe.position) < ctx.rules.patrolAvoidRangeMetres
  ) {
    return "PATROL_AVOID";
  }
  const corners = patrolCorners(draft.patrolAnchor, ctx.rules.patrolRadiusMetres);
  if (
    distanceMetres(division.position, corners[draft.waypointIndex]!) < ctx.rules.patrolArrivalMetres
  ) {
    draft.waypointIndex = (draft.waypointIndex + 1) % PATROL_WAYPOINT_COUNT;
  }
  return "PATROL_LOITER";
}

function patrolBuild(
  ctx: PlanContext,
  division: DivisionAiDivision,
  draft: DivisionDraft,
  mode: DivisionAiMode,
): DivisionPlan | null {
  if (mode === "PATROL_AVOID") {
    const foe = nearestContact(division.position, ctx.view.contacts);
    if (foe === null) return null;
    return {
      mode,
      navigation: waypoint(awayPoint(ctx, division, foe)),
      speed: preset("SQUADRON_MAX"),
      formation: division.formation,
    };
  }
  if (mode !== "PATROL_LOITER") return null;
  draft.patrolAnchor ??= ctx.view.objective ?? ctx.lead.position;
  const corner = patrolCorners(draft.patrolAnchor, ctx.rules.patrolRadiusMetres)[
    draft.waypointIndex
  ]!;
  return {
    mode,
    navigation: waypoint(corner),
    speed: knots(division, ctx.rules.patrolKnots),
    formation: division.formation,
  };
}

export const PATROL_BEHAVIOUR: RoleBehaviour = {
  modes: ["PATROL_LOITER", "PATROL_AVOID"],
  choose: patrolChoose,
  build: patrolBuild,
};

function independentChoose(ctx: PlanContext, division: DivisionAiDivision): DivisionAiMode {
  const foe = nearestContact(division.position, ctx.view.contacts);
  if (
    foe !== null &&
    distanceMetres(division.position, foe.position) < ctx.rules.independentEngageRangeMetres
  ) {
    return "INDEPENDENT_ENGAGE";
  }
  if (distanceMetres(division.position, ctx.lead.position) > ctx.rules.independentLeashMetres) {
    return "INDEPENDENT_CLOSE_ON_FLAG";
  }
  return "INDEPENDENT_PARALLEL";
}

function independentBuild(
  ctx: PlanContext,
  division: DivisionAiDivision,
  mode: DivisionAiMode,
): DivisionPlan | null {
  const { lead, rules } = ctx;
  switch (mode) {
    case "INDEPENDENT_ENGAGE": {
      const foe = nearestContact(division.position, ctx.view.contacts);
      if (foe === null) return null;
      const standoff = offsetPoint(
        foe.position,
        bearingDegrees(foe.position, division.position),
        rules.independentStandoffMetres,
      );
      return {
        mode,
        navigation: waypoint(standoff),
        speed: preset("SQUADRON_MAX"),
        formation: division.formation,
      };
    }
    case "INDEPENDENT_CLOSE_ON_FLAG":
      return {
        mode,
        navigation: waypoint(
          offsetPoint(lead.position, lead.headingDeg, rules.independentStandoffMetres),
        ),
        speed: preset("SQUADRON_MAX"),
        formation: division.formation,
      };
    case "INDEPENDENT_PARALLEL":
      return {
        mode,
        navigation: { kind: "COURSE", headingDeg: lead.headingDeg },
        speed: knots(division, lead.speedKnots),
        formation: division.formation,
      };
    default:
      return null;
  }
}

export const INDEPENDENT_BEHAVIOUR: RoleBehaviour = {
  modes: ["INDEPENDENT_ENGAGE", "INDEPENDENT_CLOSE_ON_FLAG", "INDEPENDENT_PARALLEL"],
  choose: (ctx, division) => independentChoose(ctx, division),
  build: (ctx, division, _draft, mode) => independentBuild(ctx, division, mode),
};
