export const SUBMARINE_POLICIES = ["PRIZE_RULES", "UNRESTRICTED"] as const;
export type SubmarinePolicy = (typeof SUBMARINE_POLICIES)[number];

export const SUBMARINE_POLICY_DORMANT = "SUBMARINE_POLICY_DORMANT" as const;

export function isSubmarinePolicy(value: unknown): value is SubmarinePolicy {
  return SUBMARINE_POLICIES.some((policy) => policy === value);
}

export function submarinePolicyOf(nation: {
  readonly submarinePolicy?: SubmarinePolicy | undefined;
}): SubmarinePolicy {
  return nation.submarinePolicy ?? "PRIZE_RULES";
}
