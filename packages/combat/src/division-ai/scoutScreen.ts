import type { DivisionAiDivision, Point } from "./contracts.js";
import { distanceMetres, nearestContact, stationPoint } from "./geometry.js";
import {
  awayPoint,
  disengagedSide,
  followSpeed,
  legalFormation,
  preset,
  reversalOffArc,
  waypoint,
  type DivisionPlan,
  type PlanContext,
} from "./plan.js";
import type { DivisionAiMode } from "./reasonCodes.js";
import type { RoleBehaviour } from "./roleBehaviour.js";

function fallBackStation(ctx: PlanContext): Point {
  return stationPoint(ctx.lead.position, ctx.lead.headingDeg, -ctx.rules.fallBackAsternMetres, 0);
}

function scoutChoose(ctx: PlanContext, division: DivisionAiDivision): DivisionAiMode {
  if (ctx.tier > 0) return "SCOUT_FALL_BACK";
  const { rules } = ctx;
  const seen = nearestContact(division.position, ctx.view.contacts);
  const seenRange =
    seen === null ? Number.POSITIVE_INFINITY : distanceMetres(division.position, seen.position);
  if (seenRange < rules.scoutOpenRangeMetres) return "SCOUT_OPEN_RANGE";
  if (reversalOffArc(ctx, division, ctx.lead.headingDeg, rules.scoutAheadMetres)) {
    return "SCOUT_TRANSIT_FLANK";
  }
  if (seenRange < rules.scoutBreakContactRangeMetres) return "SCOUT_BREAK_CONTACT";
  return "SCOUT_STATION";
}

function scoutBuild(
  ctx: PlanContext,
  division: DivisionAiDivision,
  mode: DivisionAiMode,
): DivisionPlan | null {
  const { lead, rules } = ctx;
  const formation = legalFormation(division, "SEARCH_LINE");
  const bonus = lead.speedKnots + rules.scoutSpeedBonusKnots;
  switch (mode) {
    case "SCOUT_FALL_BACK": {
      const station = fallBackStation(ctx);
      return {
        mode,
        navigation: waypoint(station),
        speed: followSpeed(ctx, division, station, lead.speedKnots, rules.coreCatchUpMaxKnots),
        formation,
      };
    }
    case "SCOUT_OPEN_RANGE": {
      const seen = nearestContact(division.position, ctx.view.contacts);
      if (seen === null) return null;
      return {
        mode,
        navigation: waypoint(awayPoint(ctx, division, seen)),
        speed: preset("SQUADRON_MAX"),
        formation,
      };
    }
    case "SCOUT_TRANSIT_FLANK": {
      const station = stationPoint(
        lead.position,
        lead.headingDeg,
        0,
        disengagedSide(ctx) * rules.scoutTransitFlankMetres,
      );
      return { mode, navigation: waypoint(station), speed: preset("SQUADRON_MAX"), formation };
    }
    case "SCOUT_BREAK_CONTACT":
    case "SCOUT_STATION": {
      const ahead =
        mode === "SCOUT_STATION" ? rules.scoutAheadMetres : Math.floor(rules.scoutAheadMetres / 2);
      const station = stationPoint(lead.position, lead.headingDeg, ahead, 0);
      return {
        mode,
        navigation: waypoint(station),
        speed: followSpeed(ctx, division, station, bonus, rules.coreCatchUpMaxKnots),
        formation,
      };
    }
    default:
      return null;
  }
}

export const SCOUT_BEHAVIOUR: RoleBehaviour = {
  modes: [
    "SCOUT_STATION",
    "SCOUT_BREAK_CONTACT",
    "SCOUT_TRANSIT_FLANK",
    "SCOUT_OPEN_RANGE",
    "SCOUT_FALL_BACK",
  ],
  choose: (ctx, division) => scoutChoose(ctx, division),
  build: (ctx, division, _draft, mode) => scoutBuild(ctx, division, mode),
};

function screenHeading(ctx: PlanContext, interpose: boolean): number {
  return interpose ? ctx.threatBearingDeg : ctx.lead.headingDeg;
}

function screenChoose(ctx: PlanContext, division: DivisionAiDivision): DivisionAiMode {
  if (ctx.tier > 0) return "SCREEN_FALL_BACK";
  const { rules, leadThreat, lead } = ctx;
  const interpose =
    leadThreat !== null &&
    distanceMetres(lead.position, leadThreat.position) < rules.screenInterposeRangeMetres;
  if (reversalOffArc(ctx, division, screenHeading(ctx, interpose), rules.screenAheadMetres)) {
    return "SCREEN_TRANSIT_FLANK";
  }
  return interpose ? "SCREEN_INTERPOSE" : "SCREEN_STATION";
}

function screenBuild(
  ctx: PlanContext,
  division: DivisionAiDivision,
  mode: DivisionAiMode,
): DivisionPlan | null {
  const { lead, rules } = ctx;
  const formation = legalFormation(division, "SCREEN");
  const bonus = lead.speedKnots + rules.screenSpeedBonusKnots;
  switch (mode) {
    case "SCREEN_FALL_BACK": {
      const station = fallBackStation(ctx);
      return {
        mode,
        navigation: waypoint(station),
        speed: followSpeed(ctx, division, station, lead.speedKnots, rules.coreCatchUpMaxKnots),
        formation,
      };
    }
    case "SCREEN_TRANSIT_FLANK": {
      const station = stationPoint(
        lead.position,
        lead.headingDeg,
        0,
        disengagedSide(ctx) * rules.screenTransitFlankMetres,
      );
      return {
        mode,
        navigation: waypoint(station),
        speed: followSpeed(ctx, division, station, bonus, rules.coreCatchUpMaxKnots),
        formation,
      };
    }
    case "SCREEN_INTERPOSE":
    case "SCREEN_STATION": {
      const heading = screenHeading(ctx, mode === "SCREEN_INTERPOSE");
      const station = stationPoint(lead.position, heading, rules.screenAheadMetres, 0);
      return {
        mode,
        navigation: waypoint(station),
        speed: followSpeed(ctx, division, station, bonus, rules.coreCatchUpMaxKnots),
        formation,
      };
    }
    default:
      return null;
  }
}

export const SCREEN_BEHAVIOUR: RoleBehaviour = {
  modes: ["SCREEN_STATION", "SCREEN_INTERPOSE", "SCREEN_TRANSIT_FLANK", "SCREEN_FALL_BACK"],
  choose: (ctx, division) => screenChoose(ctx, division),
  build: (ctx, division, _draft, mode) => screenBuild(ctx, division, mode),
};
