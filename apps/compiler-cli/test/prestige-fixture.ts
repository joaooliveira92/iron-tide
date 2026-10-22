import { SafeInt } from "@bluewave/contracts";

export const FIXTURE_PRESTIGE_RULES = {
  lowerBound: SafeInt(0),
  upperBound: SafeInt(100),
  sackingThreshold: SafeInt(10),
  sackingProbabilityBp: SafeInt(2_500),
  rules: {
    UNPAID_FUNDS: { kind: "PROPORTIONAL_LOSS" as const, basisPoints: SafeInt(300) },
    BATTLE_LOST: { kind: "PROPORTIONAL_LOSS" as const, basisPoints: SafeInt(500) },
    BATTLE_WON: { kind: "FIXED_GAIN" as const, amount: SafeInt(1) },
  },
};
