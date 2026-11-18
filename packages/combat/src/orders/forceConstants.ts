export const FORCE_ORDER_VERSION = "force_order_v1" as const;

export const FORCE_ORDER_KINDS = [
  "FLOTILLA_ATTACK",
  "FLOTILLA_RECALL",
  "RALLY",
  "DISENGAGE",
  "CHANGE_LEAD_DIVISION",
  "BATTLE_TURN_AWAY",
] as const;

export const FORCE_MORALE_MAX_BP = 10_000 as const;

export interface ForceOrderRuleset {
  readonly neutralMoraleBp: number;
  readonly rallyAmountBp: number;
  readonly rallyDecayMinutes: number;
  readonly heavyCasualtyBp: number;
  readonly heavyCasualtyRallyBp: number;
  readonly lowAmmunitionBp: number;
  readonly lowAmmunitionRallyBp: number;
  readonly confusionMinutes: number;
  readonly confusionPenaltyBp: number;
}

export const PROVISIONAL_FORCE_ORDER_RULESET: ForceOrderRuleset = {
  neutralMoraleBp: 5_000,
  rallyAmountBp: 1_500,
  rallyDecayMinutes: 10,
  heavyCasualtyBp: 3_000,
  heavyCasualtyRallyBp: 5_000,
  lowAmmunitionBp: 2_500,
  lowAmmunitionRallyBp: 5_000,
  confusionMinutes: 5,
  confusionPenaltyBp: 1_500,
};
