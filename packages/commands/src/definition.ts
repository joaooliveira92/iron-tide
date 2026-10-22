import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { DiagnosticCollector } from "@bluewave/diagnostics";
import { CommandError } from "./errors.js";
import type { CancellationPolicy, CommandTypeDefinition } from "./types.js";
import { ISSUER_CLASSES } from "./types.js";

const REQUIRED_FIELDS: (keyof CommandTypeDefinition)[] = [
  "commandTypeId",
  "commandSchemaVersion",
  "allowedIssuerClasses",
  "targetAggregateType",
  "submissionPhaseId",
  "authorizationPolicyId",
  "validationPolicyId",
  "reservationPolicyId",
  "lockPhaseId",
  "irreversiblePhaseId",
  "resolutionPhaseId",
  "cancellationPolicyId",
  "settlementPolicyId",
  "resultSchemaId",
  "reasonCodeNamespace",
  "idempotencyScope",
  "owningDesignContractId",
  "handlerImplementationId",
  "handlerVersion",
  "testVectorIds",
  "contentHash",
];

const PROHIBITED_PHASE_PHRASES = ["before processing", "once started", "when committed"];
const VALID_CANCELLATION: CancellationPolicy[] = [
  "NOT_CANCELLABLE",
  "UNTIL_LOCK",
  "UNTIL_IRREVERSIBLE_PHASE",
  "CUSTOM_EXPLICIT",
];

export function validateCommandTypeDefinition(
  def: unknown,
  collector: DiagnosticCollector,
): def is CommandTypeDefinition {
  if (typeof def !== "object" || def === null) {
    collector.addError("INVALID_COMMAND_TYPE_DEFINITION", "definition must be object", {
      stage: "command-definition",
    });
    return false;
  }
  const r = def as Record<string, unknown>;
  let ok = true;
  for (const f of REQUIRED_FIELDS) {
    if (
      !(f in r) ||
      r[f] === undefined ||
      r[f] === null ||
      (typeof r[f] === "string" && (r[f] as string).trim() === "")
    ) {
      collector.addError("INVALID_COMMAND_TYPE_DEFINITION", `Missing required field ${f}`, {
        stage: "command-definition",
      });
      ok = false;
    }
  }
  if (!ok) return false;
  const d = r as unknown as CommandTypeDefinition;
  if (!Array.isArray(d.allowedIssuerClasses) || d.allowedIssuerClasses.length === 0) {
    collector.addError(
      "INVALID_COMMAND_TYPE_DEFINITION",
      "allowedIssuerClasses must be non-empty",
      { stage: "command-definition" },
    );
    ok = false;
  } else {
    for (const ic of d.allowedIssuerClasses)
      if (!(ISSUER_CLASSES as readonly string[]).includes(ic)) {
        collector.addError("INVALID_COMMAND_TYPE_DEFINITION", `Invalid issuerClass ${ic}`, {
          stage: "command-definition",
        });
        ok = false;
      }
  }
  for (const phaseField of [
    "lockPhaseId",
    "irreversiblePhaseId",
    "submissionPhaseId",
    "resolutionPhaseId",
  ] as const) {
    const v = d[phaseField] as string;
    if (typeof v !== "string" || v.trim() === "") {
      collector.addError(
        "INVALID_COMMAND_TYPE_DEFINITION",
        `${phaseField} must be non-empty phase id`,
        { stage: "command-definition" },
      );
      ok = false;
    } else {
      const low = v.toLowerCase();
      for (const phrase of PROHIBITED_PHASE_PHRASES)
        if (low.includes(phrase)) {
          collector.addError(
            "INVALID_COMMAND_TYPE_DEFINITION",
            `${phaseField} must not use prohibited phrase "${phrase}"`,
            { stage: "command-definition" },
          );
          ok = false;
        }
    }
  }
  if (!VALID_CANCELLATION.includes(d.cancellationPolicyId as CancellationPolicy)) {
    collector.addError(
      "INVALID_COMMAND_TYPE_DEFINITION",
      `Invalid cancellationPolicyId ${d.cancellationPolicyId}`,
      { stage: "command-definition" },
    );
    ok = false;
  }
  if (typeof d.contentHash !== "string" || !/^[a-f0-9]{64}$/.test(d.contentHash)) {
    collector.addError("INVALID_COMMAND_TYPE_DEFINITION", "contentHash must be 64 hex chars", {
      stage: "command-definition",
    });
    ok = false;
  }
  if (d.issuerRestrictionReasonCode !== undefined) {
    if (
      typeof d.issuerRestrictionReasonCode !== "string" ||
      d.issuerRestrictionReasonCode.trim() === ""
    ) {
      collector.addError(
        "INVALID_COMMAND_TYPE_DEFINITION",
        "issuerRestrictionReasonCode must be non-empty when issuer restriction declared",
        { stage: "command-definition" },
      );
      ok = false;
    }
    if (!d.owningDesignContractId || typeof d.owningDesignContractId !== "string") {
      collector.addError(
        "INVALID_COMMAND_TYPE_DEFINITION",
        "issuer-restricted command must declare owningDesignContractId",
        { stage: "command-definition" },
      );
      ok = false;
    }
    if (typeof d.issuerEligibilityPredicate !== "function") {
      collector.addError(
        "INVALID_COMMAND_TYPE_DEFINITION",
        "issuer-restricted command must declare issuerEligibilityPredicate",
        { stage: "command-definition" },
      );
      ok = false;
    }
  }
  if (d.settlementPolicy) {
    const branches: (keyof NonNullable<CommandTypeDefinition["settlementPolicy"]>)[] = [
      "validationRejection",
      "authorizationRejection",
      "reservationFailure",
      "preLockCancellation",
      "postLockPreIrreversibleCancellation",
      "resolutionImpossibilityBeforeEffects",
      "partialCompletion",
      "completion",
      "supersession",
      "internalResolutionFailure",
    ];
    for (const b of branches) {
      const branch = d.settlementPolicy[b];
      if (branch === null || branch === undefined) {
        const allowedDefaults = new Set([
          "validationRejection",
          "authorizationRejection",
          "reservationFailure",
          "preLockCancellation",
          "internalResolutionFailure",
          "completion",
        ]);
        if (!allowedDefaults.has(b)) {
          collector.addError(
            "INCOMPLETE_COMMAND_SETTLEMENT_POLICY",
            `Missing settlement branch ${b}`,
            { stage: "command-definition" },
          );
          ok = false;
        }
      } else {
        if (branch.refundBasisPoints < 0 || branch.refundBasisPoints > 10000) {
          collector.addError(
            "INCOMPLETE_COMMAND_SETTLEMENT_POLICY",
            `refundBasisPoints out of range for ${b}`,
            { stage: "command-definition" },
          );
          ok = false;
        }
        if (branch.fixedNonRefundableAmount < 0) {
          collector.addError(
            "INCOMPLETE_COMMAND_SETTLEMENT_POLICY",
            `fixedNonRefundableAmount negative for ${b}`,
            { stage: "command-definition" },
          );
          ok = false;
        }
      }
    }
  }
  if (d.partialCompletionAllowed) {
    if (!Array.isArray(d.divisibleEffectUnits) || d.divisibleEffectUnits.length === 0) {
      collector.addError(
        "INVALID_COMMAND_TYPE_DEFINITION",
        "partialCompletionAllowed requires divisibleEffectUnits",
        { stage: "command-definition" },
      );
      ok = false;
    }
  }
  if (
    d.retryPolicy &&
    (d.retryPolicy.maxAttempts < 0 || !Number.isInteger(d.retryPolicy.maxAttempts))
  ) {
    collector.addError(
      "INVALID_COMMAND_TYPE_DEFINITION",
      "retryPolicy.maxAttempts must be non-negative integer",
      { stage: "command-definition" },
    );
    ok = false;
  }
  return ok;
}

export function hashDefinition(def: CommandTypeDefinition): string {
  return sha256Hex(canonicalSerialize(def));
}

export function assertValidDefinitionOrThrow(def: unknown): CommandTypeDefinition {
  const c = new DiagnosticCollector();
  if (!validateCommandTypeDefinition(def, c)) {
    const msg = c.errors.map((e) => e.message).join("; ");
    throw new CommandError({
      code: "INVALID_COMMAND_TYPE_DEFINITION",
      diagnostics: c.all,
      message: `INVALID_COMMAND_TYPE_DEFINITION: ${msg}`,
    });
  }
  return def as CommandTypeDefinition;
}
