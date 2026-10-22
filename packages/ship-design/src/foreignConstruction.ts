import { newConstructionDockEligibility, type DockRecord } from "./dock.js";
import type { YardDemand } from "./yards.js";

export const FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED =
  "FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED" as const;

export const FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT =
  "FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT" as const;

export const FOREIGN_BUILDER_CAPACITY_UNAVAILABLE = "FOREIGN_BUILDER_CAPACITY_UNAVAILABLE" as const;
export type ForeignBuilderCapabilityFailureCode =
  | typeof FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT
  | typeof FOREIGN_BUILDER_CAPACITY_UNAVAILABLE;

export const FOREIGN_BUILDER_NATION_INVALID = "FOREIGN_BUILDER_NATION_INVALID" as const;

export const FOREIGN_PAYMENT_DEFAULT_DELAYED = "PAYMENT_DEFAULT_DELAYED" as const;
export const FOREIGN_CONTRACT_PAYMENT_DEFAULT = FOREIGN_PAYMENT_DEFAULT_DELAYED;

export const FOREIGN_PAYMENT_GRACE_MONTHS = 1 as const;

export const FOREIGN_BUILDER_CAPABILITY_FIELDS = [
  "DOCK",
  "TECHNOLOGY",
  "SHIPYARD",
  "CAPACITY",
  "GOVERNMENT",
  "COMPONENTS",
  "PHYSICAL",
] as const;
export type ForeignBuilderCapabilityField = (typeof FOREIGN_BUILDER_CAPABILITY_FIELDS)[number];

export interface ForeignBuilderCapabilityReason {
  readonly code: ForeignBuilderCapabilityFailureCode;
  readonly field: ForeignBuilderCapabilityField;
  readonly message: string;
}

export interface ForeignBuilderCapabilityCheck {
  readonly satisfied: boolean;
  readonly reasons: readonly ForeignBuilderCapabilityReason[];
}

export interface ForeignBuilderCapabilityInput {
  readonly demand: YardDemand;
  readonly dock: Partial<DockRecord>;
  readonly requiredTechnologySatisfied: boolean;
  readonly shipyardCapabilitySatisfied: boolean;
  readonly governmentPermissionSatisfied: boolean;
  readonly componentSourcingSatisfied: boolean;
  readonly physicallyCapable: boolean;
  readonly reservedMassKg: number;
  readonly availableNewConstructionCapacityKg: number;
}

const reason = (
  field: ForeignBuilderCapabilityField,
  message: string,
  code: ForeignBuilderCapabilityFailureCode = FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
): ForeignBuilderCapabilityReason => ({ code, field, message });

export function validateForeignBuilderCapability(
  input: ForeignBuilderCapabilityInput,
): ForeignBuilderCapabilityCheck {
  const reasons: ForeignBuilderCapabilityReason[] = [];

  const dock = newConstructionDockEligibility(input.dock, input.demand);
  for (const r of dock.rejections) reasons.push(reason("DOCK", r.message));

  if (!input.requiredTechnologySatisfied)
    reasons.push(
      reason(
        "TECHNOLOGY",
        "The builder does not hold the required technology or a licence for the design.",
      ),
    );
  if (!input.shipyardCapabilitySatisfied)
    reasons.push(
      reason("SHIPYARD", "The builder's shipyard lacks the required construction capability."),
    );
  if (!input.governmentPermissionSatisfied)
    reasons.push(
      reason("GOVERNMENT", "Government or treaty permission for the foreign contract is absent."),
    );
  if (!input.componentSourcingSatisfied)
    reasons.push(reason("COMPONENTS", "The builder cannot source the required components."));
  if (!input.physicallyCapable)
    reasons.push(
      reason("PHYSICAL", "Occupation or destruction prevents work at the builder's yard."),
    );

  const reserved = Number.isSafeInteger(input.reservedMassKg) ? input.reservedMassKg : 0;
  const available = Number.isSafeInteger(input.availableNewConstructionCapacityKg)
    ? input.availableNewConstructionCapacityKg
    : 0;
  if (reserved < 0 || reserved > available)
    reasons.push(
      reason(
        "CAPACITY",
        `Reserving ${reserved} kg exceeds the builder's available NEW_CONSTRUCTION capacity of ${available} kg.`,
        FOREIGN_BUILDER_CAPACITY_UNAVAILABLE,
      ),
    );

  return { satisfied: reasons.length === 0, reasons };
}

export function capabilityFailureCode(
  check: ForeignBuilderCapabilityCheck,
): ForeignBuilderCapabilityFailureCode {
  if (check.reasons.length > 0 && check.reasons.every((r) => r.field === "CAPACITY"))
    return FOREIGN_BUILDER_CAPACITY_UNAVAILABLE;
  return FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT;
}
