import type { BattleViewSeverity, DamageStars } from "./battleViewTypes.js";

export interface BattleViewTuning {
  readonly provisional: true;
  readonly sightingTier: {
    readonly scaleBp: number;
    readonly classMaxBp: number;
    readonly typeMaxBp: number;
  };
  readonly damageStars: {
    readonly scaleBp: number;
    readonly oneStarMinLossBp: number;
    readonly twoStarMinLossBp: number;
    readonly threeStarMinLossBp: number;
  };
  readonly logSeverity: Readonly<Record<string, BattleViewSeverity>>;
}

export const BATTLE_VIEW_TUNING: BattleViewTuning = {
  provisional: true,
  sightingTier: { scaleBp: 10_000, classMaxBp: 3_000, typeMaxBp: 6_000 },
  damageStars: {
    scaleBp: 10_000,
    oneStarMinLossBp: 1,
    twoStarMinLossBp: 3_500,
    threeStarMinLossBp: 7_000,
  },
  logSeverity: {
    gunnery_salvo: "INFO",
    torpedo_launch: "INFO",
    damage_impact: "WARNING",
    torpedo_hit: "WARNING",
    torpedo_damage: "WARNING",
    missile_impact: "WARNING",
    ship_sunk: "CRITICAL",
  },
};

export function starsForLoss(lossBp: number, tuning: BattleViewTuning): DamageStars {
  const { threeStarMinLossBp, twoStarMinLossBp, oneStarMinLossBp } = tuning.damageStars;
  if (lossBp >= threeStarMinLossBp) return 3;
  if (lossBp >= twoStarMinLossBp) return 2;
  if (lossBp >= oneStarMinLossBp) return 1;
  return 0;
}
