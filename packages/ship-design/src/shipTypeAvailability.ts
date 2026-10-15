// The one authoritative answer to "may this ship type be designed or built now, and if not, why". Pure: the same
// context gives the same answer; the compile, the construction-order rule and the roster all call it.
import type { ClassificationRules } from "./classification.js";
import { shipTarget, type Finding } from "./findings.js";
import {
  eraBandReached,
  isShipTypeId,
  SHIP_TYPES,
  type ShipTypeDefinition,
  type ShipTypeId,
} from "./shipTypes.js";

/**
 * Stable machine-readable reasons. `SHIP_TYPE_UNREGISTERED` and `AMC_FLEET_LIMIT_EXCEEDED` are DESIGN-22 section 26
 * codes; the rest are this policy's. Display text comes from `availabilityMessage` (the localisation seam: a
 * translation table keyed by code replaces it).
 */
export const AVAILABILITY_REASON_CODES = [
  "SHIP_TYPE_UNREGISTERED",
  "SHIP_TYPE_ERA_NOT_REACHED",
  "SHIP_TYPE_TECHNOLOGY_REQUIRED",
  "SHIP_TYPE_CAPABILITY_REQUIRED",
  "SHIP_TYPE_MECHANICS_NOT_IMPLEMENTED",
  "SHIP_TYPE_RESTRICTED",
  "AMC_FLEET_LIMIT_EXCEEDED",
  "AMC_FAST_LIMIT_EXCEEDED",
] as const;
export type AvailabilityReasonCode = (typeof AVAILABILITY_REASON_CODES)[number];

/**
 * English text per code. Deliberately generic for the locked future types: it names the kind of obstacle, never the
 * technology behind it (fog of war: an unresearched technology stays hidden).
 */
const MESSAGES: Readonly<Record<AvailabilityReasonCode, string>> = {
  SHIP_TYPE_UNREGISTERED: "This ship type is not recognised by the ruleset.",
  SHIP_TYPE_ERA_NOT_REACHED: "This kind of ship does not exist yet in the current era.",
  SHIP_TYPE_TECHNOLOGY_REQUIRED: "Your navy lacks the ship-design knowledge to build this ship.",
  SHIP_TYPE_CAPABILITY_REQUIRED: "Your nation lacks the industrial capability to build this ship.",
  SHIP_TYPE_MECHANICS_NOT_IMPLEMENTED: "This kind of ship is not part of the game yet.",
  SHIP_TYPE_RESTRICTED: "A treaty or scenario rule forbids this ship type.",
  AMC_FLEET_LIMIT_EXCEEDED:
    "Armed merchant cruisers are limited to a share of the cruiser fleet; the limit is reached.",
  AMC_FAST_LIMIT_EXCEEDED:
    "Fast armed merchant cruisers are limited to a share of the auxiliary fleet; the limit is reached.",
};

export const availabilityMessage = (code: AvailabilityReasonCode): string => MESSAGES[code];

export interface AvailabilityReason {
  readonly code: AvailabilityReasonCode;
  readonly message: string;
}

export interface ShipTypeAvailability {
  readonly type: string;
  readonly available: boolean;
  /** Empty exactly when `available`. */
  readonly reasons: readonly AvailabilityReason[];
}

export interface AvailabilityContext {
  /** Campaign month, YYYY-MM. */
  readonly month: string;
  readonly unlockedTechs: ReadonlySet<string>;
  /** Nation capabilities granted by scenario or industry; absent = none. */
  readonly capabilities?: ReadonlySet<string> | undefined;
  /** Types forbidden by a treaty or by scenario configuration. */
  readonly restrictedTypes?: readonly string[] | undefined;
  /**
   * The compiled ship-type definitions (ADR-0156, ticket 12b). When supplied, the availability
   * facts are read from content; absent falls back to the code registry, whose values the 12a
   * regression pins equal.
   */
  readonly definitions?: ReadonlyMap<ShipTypeId, ShipTypeDefinition> | undefined;
}

const reason = (code: AvailabilityReasonCode): AvailabilityReason => ({
  code,
  message: MESSAGES[code],
});

/** Whether `type` may be designed now. Unknown ids are `SHIP_TYPE_UNREGISTERED`, never available. */
export function evaluateShipTypeAvailability(
  type: string,
  ctx: AvailabilityContext,
): ShipTypeAvailability {
  if (!isShipTypeId(type))
    return { type, available: false, reasons: [reason("SHIP_TYPE_UNREGISTERED")] };
  const def: ShipTypeDefinition = ctx.definitions?.get(type) ?? SHIP_TYPES[type];
  const need = def.availability;
  const reasons: AvailabilityReason[] = [];
  if (!need.mechanicsImplemented) reasons.push(reason("SHIP_TYPE_MECHANICS_NOT_IMPLEMENTED"));
  if (!eraBandReached(ctx.month, need.fromEra)) reasons.push(reason("SHIP_TYPE_ERA_NOT_REACHED"));
  if (need.requiresTech !== null && !ctx.unlockedTechs.has(need.requiresTech))
    reasons.push(reason("SHIP_TYPE_TECHNOLOGY_REQUIRED"));
  if (
    need.requiresCapability !== null &&
    !(ctx.capabilities?.has(need.requiresCapability) ?? false)
  )
    reasons.push(reason("SHIP_TYPE_CAPABILITY_REQUIRED"));
  if (ctx.restrictedTypes?.includes(type)) reasons.push(reason("SHIP_TYPE_RESTRICTED"));
  return { type, available: reasons.length === 0, reasons };
}

/** The fleet the auxiliary limits count against: commissioned plus in-construction ships of the issuing nation. */
export interface AuxiliaryFleetCounts {
  /** Active commissioned cruisers (CA and CL, including protected cruisers). */
  readonly cruisers: number;
  /** Active AMC, commissioned and under construction. */
  readonly amc: number;
  /** Of those, the fast ones (designed speed at or above the fast-AMC threshold). */
  readonly fastAmc: number;
}

/**
 * DESIGN-22 section 15 fleet authorisation for one more AMC. Not a mechanical classification rule: a design that
 * passes `classRuleFailures` still compiles; its construction order is what this rejects. Integer arithmetic,
 * counts floored, minimum allowances applied.
 */
export function evaluateAmcFleetLimit(
  designedSpeedUms: number,
  fleet: AuxiliaryFleetCounts,
  rules: Pick<
    ClassificationRules,
    | "amcFleetShareBp"
    | "amcFleetMinAllowance"
    | "amcFastShareBp"
    | "amcFastMinAllowance"
    | "amcFastSpeedUms"
  >,
): ShipTypeAvailability {
  const reasons: AvailabilityReason[] = [];
  const total = Math.max(
    Math.floor((fleet.cruisers * rules.amcFleetShareBp) / 10_000),
    rules.amcFleetMinAllowance,
  );
  if (fleet.amc + 1 > total) reasons.push(reason("AMC_FLEET_LIMIT_EXCEEDED"));
  if (designedSpeedUms >= rules.amcFastSpeedUms) {
    const fast = Math.max(
      Math.floor(((fleet.amc + 1) * rules.amcFastShareBp) / 10_000),
      rules.amcFastMinAllowance,
    );
    if (fleet.fastAmc + 1 > fast) reasons.push(reason("AMC_FAST_LIMIT_EXCEEDED"));
  }
  return { type: "AMC", available: reasons.length === 0, reasons };
}

/** The blocking findings for an unavailable type: one per reason, each with the three remedies a blocker needs. */
export function availabilityFindings(a: ShipTypeAvailability): Finding[] {
  return a.reasons.map((r): Finding => ({
    id: r.code,
    severity: "BLOCKING",
    what: `The ship type ${a.type} cannot be designed.`,
    why: r.message,
    consequence: "A design of this type cannot be submitted or built.",
    remedies: [
      { id: "change_intended", description: "Choose a ship type that is available." },
      { id: "wait", description: "Wait for the era or knowledge this type needs." },
      { id: "check_rules", description: "Review which ship types the campaign allows." },
    ],
    evidence: { formulaId: "DESIGN-22", inputs: {}, threshold: 0, value: 0 },
    subject: { targets: [shipTarget], settings: "brief" },
  }));
}
