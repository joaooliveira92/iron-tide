import type { ClassificationRules } from "./classification.js";
import { shipTarget, type DiagnosticParams, type Finding } from "./findings.js";
import {
  eraBandOf,
  eraBandReached,
  isShipTypeId,
  SHIP_TYPES,
  type ShipTypeDefinition,
  type ShipTypeId,
} from "./shipTypes.js";

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
  readonly ruleId: string;
  readonly messageKey: string;
  readonly params: DiagnosticParams;
}

export interface ShipTypeAvailability {
  readonly type: string;
  readonly available: boolean;
  readonly reasons: readonly AvailabilityReason[];
}

export interface AvailabilityContext {
  readonly month: string;
  readonly unlockedTechs: ReadonlySet<string>;
  readonly capabilities?: ReadonlySet<string> | undefined;
  readonly restrictedTypes?: readonly string[] | undefined;
  readonly definitions?: ReadonlyMap<ShipTypeId, ShipTypeDefinition> | undefined;
}

const reason = (code: AvailabilityReasonCode, params: DiagnosticParams): AvailabilityReason => ({
  code,
  message: MESSAGES[code],
  ruleId: `AVAILABILITY.${code}`,
  messageKey: `design.availability.${code.replace(/^SHIP_TYPE_/, "").toLowerCase()}`,
  params,
});

export function evaluateShipTypeAvailability(
  type: string,
  ctx: AvailabilityContext,
): ShipTypeAvailability {
  if (!isShipTypeId(type))
    return {
      type,
      available: false,
      reasons: [reason("SHIP_TYPE_UNREGISTERED", { shipType: type })],
    };
  const def: ShipTypeDefinition = ctx.definitions?.get(type) ?? SHIP_TYPES[type];
  const need = def.availability;
  const shipType = { shipType: type };
  const reasons: AvailabilityReason[] = [];
  if (!need.mechanicsImplemented)
    reasons.push(reason("SHIP_TYPE_MECHANICS_NOT_IMPLEMENTED", shipType));
  if (!eraBandReached(ctx.month, need.fromEra))
    reasons.push(
      reason("SHIP_TYPE_ERA_NOT_REACHED", {
        ...shipType,
        fromEra: need.fromEra,
        currentEra: eraBandOf(ctx.month) ?? "UNKNOWN",
        month: ctx.month,
      }),
    );
  if (need.requiresTech !== null && !ctx.unlockedTechs.has(need.requiresTech))
    reasons.push(
      reason("SHIP_TYPE_TECHNOLOGY_REQUIRED", { ...shipType, techId: need.requiresTech }),
    );
  if (
    need.requiresCapability !== null &&
    !(ctx.capabilities?.has(need.requiresCapability) ?? false)
  )
    reasons.push(
      reason("SHIP_TYPE_CAPABILITY_REQUIRED", {
        ...shipType,
        capabilityId: need.requiresCapability,
      }),
    );
  if (ctx.restrictedTypes?.includes(type)) reasons.push(reason("SHIP_TYPE_RESTRICTED", shipType));
  return { type, available: reasons.length === 0, reasons };
}

export interface AuxiliaryFleetCounts {
  readonly cruisers: number;
  readonly amc: number;
  readonly fastAmc: number;
}

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
  if (fleet.amc + 1 > total)
    reasons.push(
      reason("AMC_FLEET_LIMIT_EXCEEDED", { shipType: "AMC", allowed: total, current: fleet.amc }),
    );
  if (designedSpeedUms >= rules.amcFastSpeedUms) {
    const fast = Math.max(
      Math.floor(((fleet.amc + 1) * rules.amcFastShareBp) / 10_000),
      rules.amcFastMinAllowance,
    );
    if (fleet.fastAmc + 1 > fast)
      reasons.push(
        reason("AMC_FAST_LIMIT_EXCEEDED", {
          shipType: "AMC",
          allowed: fast,
          current: fleet.fastAmc,
        }),
      );
  }
  return { type: "AMC", available: reasons.length === 0, reasons };
}

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
    ruleId: r.ruleId,
    messageKey: r.messageKey,
    params: r.params,
  }));
}
