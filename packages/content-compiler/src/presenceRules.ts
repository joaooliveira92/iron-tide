import { decodePresenceRules } from "@bluewave/content-schema";

export interface PresenceValues {
  readonly colonialServiceDisplacementBp: number;
  readonly requiredTonsPerPossessionWeight: number;
  readonly noPortValueWeight: number;
  readonly crampedOrShortRangeCountBp: number;
  readonly penaltyRequests?: true;
  readonly baseLimits?: {
    readonly limitByBaseLevel: readonly number[];
    readonly noBaseLimit: number;
    readonly occupyingStates: readonly (
      | "ACTIVE"
      | "RESERVE"
      | "MOTHBALLED"
      | "WORKING_UP"
      | "REPAIR"
    )[];
    readonly maintenanceAdderBp: number;
    readonly crewQualityReduction: number;
  };
}

export function presenceFromRulesets(rulesets: readonly unknown[]): PresenceValues | undefined {
  for (const ruleset of rulesets) {
    const section = (ruleset as { readonly presence?: unknown } | null)?.presence;
    if (section === undefined) continue;
    const decoded = decodePresenceRules(section);
    if (!decoded.ok)
      throw new Error(
        `ruleset presence section is invalid at '${decoded.field}': ${decoded.message}`,
      );
    const { value } = decoded;
    return {
      colonialServiceDisplacementBp: value.colonialServiceDisplacementBp,
      requiredTonsPerPossessionWeight: value.requiredTonsPerPossessionWeight,
      noPortValueWeight: value.noPortValueWeight,
      crampedOrShortRangeCountBp: value.crampedOrShortRangeCountBp,
      ...(value.penaltyRequests === true ? { penaltyRequests: true as const } : {}),
      ...(value.baseLimits === undefined
        ? {}
        : {
            baseLimits: {
              limitByBaseLevel: [...value.baseLimits.limitByBaseLevel],
              noBaseLimit: value.baseLimits.noBaseLimit,
              occupyingStates: [...value.baseLimits.occupyingStates],
              maintenanceAdderBp: value.baseLimits.maintenanceAdderBp,
              crewQualityReduction: value.baseLimits.crewQualityReduction,
            },
          }),
    };
  }
  return undefined;
}
