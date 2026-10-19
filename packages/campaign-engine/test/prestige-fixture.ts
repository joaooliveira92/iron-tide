import { SafeInt } from "@bluewave/contracts";

// Test-only fixture prestige value set (S-2). These numbers exist only so test snapshots satisfy the
// required `prestigeRules` field; they are not prestige values and never reach production content.
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
