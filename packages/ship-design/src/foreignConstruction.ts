// DESIGN-16 section 13.2 (spec SB3-R20): the BUILDER-side capability predicates a foreign construction order must
// satisfy before acceptance and before keel laying. Pure and platform-independent: the caller resolves the builder's
// dock, licence/technology state, yard capability, free `NEW_CONSTRUCTION` capacity and political permissions, and
// this module judges them. A missing capability returns a specific reason under one stable code; it never downgrades
// the design silently. The contract, ordering and payment machinery live in `@bluewave/phase-engine`.
import { newConstructionDockEligibility, type DockRecord } from "./dock.js";
import type { YardDemand } from "./yards.js";

/**
 * DESIGN-16 section 13.1/13.4: a foreign order without a complete accepted contract is refused with this code. It is
 * the stable reason the order path reports when the contract is absent or incomplete.
 */
export const FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED =
  "FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED" as const;

/**
 * DESIGN-16 section 13.2: the builder fails one of the capability predicates. One stable code carries every
 * non-capacity predicate failure; the `field` discriminator names which one, so a caller can always report a specific
 * reason. A capacity-predicate failure uses the dedicated section 18 code `FOREIGN_BUILDER_CAPACITY_UNAVAILABLE`.
 */
export const FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT =
  "FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT" as const;

/**
 * DESIGN-16 section 18: the dedicated code for a builder-capacity admission failure (the capacity predicate). It is a
 * "MUST define" §18 reason code; section 13.2 otherwise carries one stable code per predicate.
 */
export const FOREIGN_BUILDER_CAPACITY_UNAVAILABLE = "FOREIGN_BUILDER_CAPACITY_UNAVAILABLE" as const;
export type ForeignBuilderCapabilityFailureCode =
  | typeof FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT
  | typeof FOREIGN_BUILDER_CAPACITY_UNAVAILABLE;

/**
 * DESIGN-16 sections 13.1/13.4: a foreign order names an ordering nation as its own builder, or a builder nation that
 * is not in the campaign. Either would let a contract payment move money to or from a nation that cannot build the
 * hull (or a nation paying itself), so the order is refused at the boundary rather than persisted.
 */
export const FOREIGN_BUILDER_NATION_INVALID = "FOREIGN_BUILDER_NATION_INVALID" as const;

/**
 * DESIGN-16 section 13.4: the reason a foreign project is held in the existing `DELAYED` status after the shipped
 * one-month payment grace expires. This is the canonical emitted value (also the sprint spec's SB3-R22 code);
 * `PAYMENT_DEFAULT_DELAYED` is a reason code, not a DESIGN-23 section 2 status, so the status union is not widened
 * (see INC-9 `## Answer`).
 */
export const FOREIGN_PAYMENT_DEFAULT_DELAYED = "PAYMENT_DEFAULT_DELAYED" as const;
/**
 * DESIGN-16 section 18 lists `FOREIGN_CONTRACT_PAYMENT_DEFAULT` as a MUST-define reason code, while section 13.4 and
 * sprint spec SB3-R22 use `PAYMENT_DEFAULT_DELAYED` for the same default. INC-9f decision (documented, deterministic):
 * the emitted code stays `PAYMENT_DEFAULT_DELAYED`; `FOREIGN_CONTRACT_PAYMENT_DEFAULT` is the section 18 alias for that
 * one value, so state and events carry exactly one code. Pinned by a test asserting the two constants are equal.
 */
export const FOREIGN_CONTRACT_PAYMENT_DEFAULT = FOREIGN_PAYMENT_DEFAULT_DELAYED;

/** DESIGN-16 section 13.4: the shipped payment grace is exactly one month. */
export const FOREIGN_PAYMENT_GRACE_MONTHS = 1 as const;

/** DESIGN-16 section 13.2: the capability predicates, in the order the contract lists them. */
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
  /** Which section-13.2 predicate failed. */
  readonly field: ForeignBuilderCapabilityField;
  readonly message: string;
}

export interface ForeignBuilderCapabilityCheck {
  readonly satisfied: boolean;
  readonly reasons: readonly ForeignBuilderCapabilityReason[];
}

/**
 * Everything the BUILDER-side capability check reads (DESIGN-16 section 13.2). The dock is the builder's own
 * `DockRecord` (materialised or resolved from its naval profile); the booleans are the caller's resolved predicates
 * (technology/licence, shipyard, government/treaty, component sourcing, physical occupation/destruction); the two
 * numbers are the mass this order reserves and the free capacity the builder still has in its `NEW_CONSTRUCTION` pool.
 */
export interface ForeignBuilderCapabilityInput {
  readonly demand: YardDemand;
  readonly dock: Partial<DockRecord>;
  readonly requiredTechnologySatisfied: boolean;
  readonly shipyardCapabilitySatisfied: boolean;
  readonly governmentPermissionSatisfied: boolean;
  readonly componentSourcingSatisfied: boolean;
  readonly physicallyCapable: boolean;
  /** The mass this order reserves against the builder's `NEW_CONSTRUCTION` cap. */
  readonly reservedMassKg: number;
  /** Free builder `NEW_CONSTRUCTION` capacity for a new foreign contract, in kilograms. */
  readonly availableNewConstructionCapacityKg: number;
}

const reason = (
  field: ForeignBuilderCapabilityField,
  message: string,
  code: ForeignBuilderCapabilityFailureCode = FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT,
): ForeignBuilderCapabilityReason => ({ code, field, message });

/**
 * Judge every DESIGN-16 section 13.2 predicate for the BUILDER. The dock ceiling is the builder's own dock (section
 * 13.2/4.2); capacity is the builder's free `NEW_CONSTRUCTION` mass. All failures are collected, so a caller may
 * report the full set; a satisfied check has an empty reason list. Pure and deterministic.
 */
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

/**
 * DESIGN-16 section 18: the stable code an order reports for a failed capability check. A failure where every failing
 * predicate is `CAPACITY` uses the dedicated `FOREIGN_BUILDER_CAPACITY_UNAVAILABLE`; any other failure set (including a
 * mixed set) uses `FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT`. Pure.
 */
export function capabilityFailureCode(
  check: ForeignBuilderCapabilityCheck,
): ForeignBuilderCapabilityFailureCode {
  if (check.reasons.length > 0 && check.reasons.every((r) => r.field === "CAPACITY"))
    return FOREIGN_BUILDER_CAPACITY_UNAVAILABLE;
  return FOREIGN_BUILDER_CAPABILITY_INSUFFICIENT;
}
