export interface DivisionAiRules {
  readonly minimumDwellMinutes: number;
  readonly openRangeBelowBp: number;
  readonly withdrawBelowBp: number;
  readonly coreGapMetres: number;
  readonly columnSpacingMetres: number;
  readonly coreCatchUpMaxKnots: number;
  readonly supportAsternMetres: number;
  readonly supportAbeamMetres: number;
  readonly supportSideFlipSineBp: number;
  readonly supportAttackRangeMetres: number;
  readonly supportBreakRangeMetres: number;
  readonly supportTorpedoRangeMetres: number;
  readonly scoutAheadMetres: number;
  readonly scoutBreakContactRangeMetres: number;
  readonly scoutOpenRangeMetres: number;
  readonly scoutSpeedBonusKnots: number;
  readonly scoutTransitFlankMetres: number;
  readonly screenAheadMetres: number;
  readonly screenInterposeRangeMetres: number;
  readonly screenSpeedBonusKnots: number;
  readonly screenTransitFlankMetres: number;
  readonly reversalArcDegrees: number;
  readonly reversalSlackMetres: number;
  readonly fallBackAsternMetres: number;
  readonly patrolRadiusMetres: number;
  readonly patrolKnots: number;
  readonly patrolAvoidRangeMetres: number;
  readonly patrolArrivalMetres: number;
  readonly independentLeashMetres: number;
  readonly independentEngageRangeMetres: number;
  readonly independentStandoffMetres: number;
  readonly selfDefenceRangeMetres: number;
  readonly flotillaBaseDelayMinutes: number;
  readonly awayDistanceMetres: number;
}

export const PROVISIONAL_DIVISION_AI_RULES: DivisionAiRules = {
  minimumDwellMinutes: 3,
  openRangeBelowBp: 4_000,
  withdrawBelowBp: 2_000,
  coreGapMetres: 800,
  columnSpacingMetres: 400,
  coreCatchUpMaxKnots: 5,
  supportAsternMetres: 1_500,
  supportAbeamMetres: 2_500,
  supportSideFlipSineBp: 3_420,
  supportAttackRangeMetres: 6_000,
  supportBreakRangeMetres: 9_000,
  supportTorpedoRangeMetres: 5_000,
  scoutAheadMetres: 8_000,
  scoutBreakContactRangeMetres: 7_000,
  scoutOpenRangeMetres: 4_500,
  scoutSpeedBonusKnots: 4,
  scoutTransitFlankMetres: 6_000,
  screenAheadMetres: 3_000,
  screenInterposeRangeMetres: 14_000,
  screenSpeedBonusKnots: 3,
  screenTransitFlankMetres: 4_000,
  reversalArcDegrees: 100,
  reversalSlackMetres: 2_000,
  fallBackAsternMetres: 2_000,
  patrolRadiusMetres: 4_000,
  patrolKnots: 8,
  patrolAvoidRangeMetres: 7_000,
  patrolArrivalMetres: 800,
  independentLeashMetres: 6_000,
  independentEngageRangeMetres: 12_000,
  independentStandoffMetres: 3_000,
  selfDefenceRangeMetres: 6_000,
  flotillaBaseDelayMinutes: 3,
  awayDistanceMetres: 10_000,
};
