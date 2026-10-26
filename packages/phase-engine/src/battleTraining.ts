import { isTrainingProficient, type NationState } from "@bluewave/campaign";
import type { FleetManagementRules } from "@bluewave/content-schema";

export function gunneryTrainingBpFor(
  nation: NationState,
  rules: FleetManagementRules | undefined,
): number {
  if (rules === undefined) return 0;
  const entry = nation["specialTraining"]?.find((candidate) => candidate.subject === "GUNNERY");
  if (entry === undefined) return 0;
  return isTrainingProficient(entry, rules.training.proficiencyMonths)
    ? rules.training.subjects.GUNNERY.effectBp
    : 0;
}
