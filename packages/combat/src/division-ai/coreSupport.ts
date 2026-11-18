import type { DivisionAiContact, DivisionAiDivision } from "./contracts.js";
import {
  directionOf,
  distanceMetres,
  interceptPoint,
  nearestContact,
  relativeDegrees,
  stationPoint,
  trackPointBehind,
} from "./geometry.js";
import {
  allDestroyers,
  followSpeed,
  preset,
  waypoint,
  type DivisionDraft,
  type DivisionPlan,
  type PlanContext,
} from "./plan.js";
import type { DivisionAiMode } from "./reasonCodes.js";
import type { RoleBehaviour } from "./roleBehaviour.js";

function corePlan(
  ctx: PlanContext,
  division: DivisionAiDivision,
  mode: DivisionAiMode,
): DivisionPlan | null {
  if (mode !== "CORE_STATION") return null;
  const { lead, rules } = ctx;
  const behind = rules.columnSpacingMetres * (ctx.leadShipCount - 1) + rules.coreGapMetres;
  const station =
    lead.track.length === 0
      ? stationPoint(lead.position, lead.headingDeg, -behind, 0)
      : trackPointBehind(lead.track, lead.position, behind);
  return {
    mode,
    navigation: waypoint(station),
    speed: followSpeed(ctx, division, station, lead.speedKnots, rules.coreCatchUpMaxKnots),
    formation: division.formation,
  };
}

export const CORE_BEHAVIOUR: RoleBehaviour = {
  modes: ["CORE_STATION"],
  choose: () => "CORE_STATION",
  build: (ctx, division, _draft, mode) => corePlan(ctx, division, mode),
};

interface SupportTargets {
  readonly destroyer: DivisionAiContact | null;
  readonly destroyerRange: number;
  readonly capital: DivisionAiContact | null;
  readonly capitalRange: number;
}

function supportTargets(ctx: PlanContext, division: DivisionAiDivision): SupportTargets {
  const destroyer = nearestContact(ctx.lead.position, ctx.view.contacts, "DESTROYER");
  const capital = nearestContact(division.position, ctx.view.contacts, "CAPITAL");
  return {
    destroyer,
    destroyerRange:
      destroyer === null
        ? Number.POSITIVE_INFINITY
        : distanceMetres(ctx.lead.position, destroyer.position),
    capital,
    capitalRange:
      capital === null
        ? Number.POSITIVE_INFINITY
        : distanceMetres(division.position, capital.position),
  };
}

function updateSupportSide(ctx: PlanContext, draft: DivisionDraft): void {
  const sine = directionOf(relativeDegrees(ctx.threatBearingDeg, ctx.lead.headingDeg))[1];
  const flip = ctx.rules.supportSideFlipSineBp;
  if (draft.supportSide === 0) draft.supportSide = sine >= 0 ? -1 : 1;
  else if (draft.supportSide === -1 && sine < -flip) draft.supportSide = 1;
  else if (draft.supportSide === 1 && sine > flip) draft.supportSide = -1;
}

function updateAttackLatch(
  ctx: PlanContext,
  division: DivisionAiDivision,
  draft: DivisionDraft,
  targets: SupportTargets,
): void {
  const { rules } = ctx;
  const counterAvailable = targets.destroyerRange < rules.supportBreakRangeMetres;
  const torpedoAvailable =
    targets.capitalRange < rules.supportBreakRangeMetres && division.salvosLeft > 0;
  if (draft.attacking && !counterAvailable && !torpedoAvailable) draft.attacking = false;
  if (draft.attacking || ctx.tier !== 0 || !allDestroyers(division)) return;
  const startCounter = targets.destroyerRange < rules.supportAttackRangeMetres;
  const startTorpedo =
    targets.capitalRange < rules.supportTorpedoRangeMetres && division.salvosLeft > 0;
  if (startCounter || startTorpedo) draft.attacking = true;
}

function attackTarget(targets: SupportTargets, breakRange: number): DivisionAiContact | null {
  if (targets.destroyer !== null && targets.destroyerRange < breakRange) return targets.destroyer;
  return targets.capital;
}

export const SUPPORT_BEHAVIOUR: RoleBehaviour = {
  modes: ["SUPPORT_STATION", "SUPPORT_COUNTERATTACK_DD", "SUPPORT_TORPEDO_ATTACK"],
  choose(ctx, division, draft) {
    updateSupportSide(ctx, draft);
    const targets = supportTargets(ctx, division);
    updateAttackLatch(ctx, division, draft, targets);
    if (!draft.attacking) return "SUPPORT_STATION";
    const target = attackTarget(targets, ctx.rules.supportBreakRangeMetres);
    return target?.kind === "DESTROYER" ? "SUPPORT_COUNTERATTACK_DD" : "SUPPORT_TORPEDO_ATTACK";
  },
  build(ctx, division, draft, mode) {
    const { lead, rules } = ctx;
    if (mode === "SUPPORT_STATION") {
      const side = draft.supportSide === 0 ? 1 : draft.supportSide;
      const station = stationPoint(
        lead.position,
        lead.headingDeg,
        -(rules.supportAsternMetres + rules.columnSpacingMetres * (ctx.leadShipCount - 1)),
        side * rules.supportAbeamMetres,
      );
      return {
        mode,
        navigation: waypoint(station),
        speed: followSpeed(ctx, division, station, lead.speedKnots, rules.coreCatchUpMaxKnots),
        formation: division.formation,
      };
    }
    if (mode !== "SUPPORT_COUNTERATTACK_DD" && mode !== "SUPPORT_TORPEDO_ATTACK") return null;
    if (!draft.attacking) return null;
    const targets = supportTargets(ctx, division);
    const target = attackTarget(targets, rules.supportBreakRangeMetres);
    if (target === null) return null;
    const wanted =
      target.kind === "DESTROYER" ? "SUPPORT_COUNTERATTACK_DD" : "SUPPORT_TORPEDO_ATTACK";
    if (wanted !== mode) return null;
    return {
      mode,
      navigation: waypoint(interceptPoint(division.position, division.maxSpeedKnots, target)),
      speed: preset("SQUADRON_MAX"),
      formation: division.formation,
    };
  },
};
