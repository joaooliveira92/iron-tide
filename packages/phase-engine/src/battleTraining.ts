import { isTrainingProficient, type NationState } from "@bluewave/campaign";
import type { BattleTrainingEffects } from "@bluewave/combat/battleResolution";
import type { FleetManagementRules } from "@bluewave/content-schema";

const EFFECT_FIELD = {
  GUNNERY: "gunneryBp",
  NIGHT_FIGHTING: "nightFightingBp",
  TORPEDO_TACTICS: "torpedoTacticsBp",
  DAMAGE_CONTROL: "damageControlBp",
} as const satisfies Record<string, keyof BattleTrainingEffects>;

export function trainingEffectsFor(
  nation: NationState,
  rules: FleetManagementRules | undefined,
): BattleTrainingEffects {
  const effects = { gunneryBp: 0, nightFightingBp: 0, torpedoTacticsBp: 0, damageControlBp: 0 };
  if (rules === undefined) return effects;
  for (const entry of nation["specialTraining"] ?? []) {
    if (!isTrainingProficient(entry, rules.training.proficiencyMonths)) continue;
    effects[EFFECT_FIELD[entry.subject]] = rules.training.subjects[entry.subject].effectBp;
  }
  return effects;
}
