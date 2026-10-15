import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { CommandAuthorizationRecord, CommandRecord, CommandTypeDefinition } from "./types.js";

export interface AuthorizationContext {
  ownershipValid: boolean;
  politicalAuthorized: boolean;
  reachValid: boolean;
  automationLockValid: boolean;
  rolePermissionsValid: boolean;
  domainAuthorityValid: boolean;
}

export function authorize(
  command: CommandRecord,
  definition: CommandTypeDefinition,
  ctx: AuthorizationContext,
): CommandAuthorizationRecord {
  const checks: Record<string, boolean> = {
    issuerClassAllowed: definition.allowedIssuerClasses.includes(command.issuerClass),
    ownership: ctx.ownershipValid,
    political: ctx.politicalAuthorized,
    reach: ctx.reachValid,
    automationLock: ctx.automationLockValid,
    role: ctx.rolePermissionsValid,
    domain: ctx.domainAuthorityValid,
  };
  // issuer parity check
  if (definition.issuerRestrictionReasonCode && definition.issuerEligibilityPredicate) {
    const eligible = definition.issuerEligibilityPredicate(
      command.issuerClass,
      command.issuerParticipantId,
    );
    if (!eligible) {
      checks["issuerEligibility"] = false;
    }
  }
  const allPassed = Object.values(checks).every(Boolean);
  // fog-of-war / parity violation detection
  if (!checks.issuerClassAllowed) {
    return {
      commandId: command.commandId,
      issuerClass: command.issuerClass,
      participantId: command.issuerParticipantId,
      authorized: false,
      reasonCode: "COMMAND_ISSUER_NOT_ALLOWED",
      checks,
      recordHash: "",
    };
  }
  if (checks["issuerEligibility"] === false) {
    return {
      commandId: command.commandId,
      issuerClass: command.issuerClass,
      participantId: command.issuerParticipantId,
      authorized: false,
      reasonCode: "COMMAND_ISSUER_PARITY_VIOLATION",
      checks,
      recordHash: sha256Hex(canonicalSerialize({ commandId: command.commandId, checks })),
    };
  }
  if (!ctx.automationLockValid) {
    return {
      commandId: command.commandId,
      issuerClass: command.issuerClass,
      participantId: command.issuerParticipantId,
      authorized: false,
      reasonCode: "ASSET_LOCKED_AGAINST_AUTOMATION",
      checks,
      recordHash: sha256Hex(canonicalSerialize({ commandId: command.commandId, checks })),
    };
  }
  if (!allPassed) {
    const reason = !ctx.politicalAuthorized
      ? "POLITICAL_AUTHORIZATION_DENIED"
      : "COMMAND_ISSUER_NOT_ALLOWED";
    return {
      commandId: command.commandId,
      issuerClass: command.issuerClass,
      participantId: command.issuerParticipantId,
      authorized: false,
      reasonCode: reason,
      checks,
      recordHash: sha256Hex(canonicalSerialize({ commandId: command.commandId, checks })),
    };
  }
  const rec: CommandAuthorizationRecord = {
    commandId: command.commandId,
    issuerClass: command.issuerClass,
    participantId: command.issuerParticipantId,
    authorized: true,
    reasonCode: "COMMAND_COMPLETED",
    checks,
    recordHash: "",
  };
  return { ...rec, recordHash: sha256Hex(canonicalSerialize(rec)) };
}
