import { BluewaveError } from "@bluewave/contracts";
import { TORPEDO_FORMULA_VERSION, TORPEDO_RULESET_VERSION } from "./constants.js";
import {
  TORPEDO_LAUNCH_AUTHORITY_DENIED,
  TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED,
  TORPEDO_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

export const torpedoLaunchAuthorityPolicyId = "torpedo_launch_authority_v1" as const;

export const TORPEDO_LAUNCH_AUTHORITY_MODES = ["ADMIRAL", "REAR_ADMIRAL", "CAPTAIN"] as const;
export type TorpedoLaunchAuthorityMode = (typeof TORPEDO_LAUNCH_AUTHORITY_MODES)[number];

export const MANUAL_LAUNCH_PROHIBITED_MODES: readonly TorpedoLaunchAuthorityMode[] = [
  "ADMIRAL",
  "REAR_ADMIRAL",
];

export interface TorpedoLaunchAuthorityContract {
  policyId: typeof torpedoLaunchAuthorityPolicyId;
  modes: readonly TorpedoLaunchAuthorityMode[];
  manualLaunchProhibitedModes: readonly TorpedoLaunchAuthorityMode[];
  rulesetVersion: string;
  formulaVersion: string;
}

export const SHIPPED_TORPEDO_LAUNCH_AUTHORITY_CONTRACT: TorpedoLaunchAuthorityContract = {
  policyId: torpedoLaunchAuthorityPolicyId,
  modes: TORPEDO_LAUNCH_AUTHORITY_MODES,
  manualLaunchProhibitedModes: MANUAL_LAUNCH_PROHIBITED_MODES,
  rulesetVersion: TORPEDO_RULESET_VERSION,
  formulaVersion: TORPEDO_FORMULA_VERSION,
};

function throwMismatch(contract: unknown, reason: string): never {
  throw new BluewaveError(TORPEDO_STATE_INVARIANT_FAILED, {
    code: TORPEDO_STATE_INVARIANT_FAILED,
    contract,
    reason,
  });
}

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function validateTorpedoLaunchAuthorityContract(
  c: Partial<TorpedoLaunchAuthorityContract> | null | undefined,
): asserts c is TorpedoLaunchAuthorityContract {
  if (!c) throwMismatch(c, "torpedo_launch_authority_v1 missing contract");
  if (c.policyId !== torpedoLaunchAuthorityPolicyId)
    throwMismatch(c, "torpedo_launch_authority_v1 expectant policy id");
  if (!c.modes || !arrayEquals(c.modes, TORPEDO_LAUNCH_AUTHORITY_MODES))
    throwMismatch(c, "torpedo_launch_authority_v1 closed mode enum (§5)");
  if (
    !c.manualLaunchProhibitedModes ||
    !arrayEquals(c.manualLaunchProhibitedModes, MANUAL_LAUNCH_PROHIBITED_MODES)
  )
    throwMismatch(c, "torpedo_launch_authority_v1 manual-launch prohibitions (§5.1/§5.2)");
  if (c.rulesetVersion !== TORPEDO_RULESET_VERSION || c.formulaVersion !== TORPEDO_FORMULA_VERSION)
    throwMismatch(c, "torpedo_launch_authority_v1 ruleset/formula versions");
}

export interface AuthorityGrant {
  grantId: string;
  platformId: string;
  mode: TorpedoLaunchAuthorityMode;
  policyId: string;
}

export function verifyAuthorityGrant(grant: AuthorityGrant | null | undefined): boolean {
  if (typeof grant !== "object" || grant === null) return false;
  if (grant.policyId !== torpedoLaunchAuthorityPolicyId) return false;
  if (!(TORPEDO_LAUNCH_AUTHORITY_MODES as readonly string[]).includes(grant.mode)) return false;
  if (typeof grant.grantId !== "string" || grant.grantId.length === 0) return false;
  if (typeof grant.platformId !== "string" || grant.platformId.length === 0) return false;
  return true;
}

export type LaunchAuthorityReasonCode =
  | "TORPEDO_LAUNCH_AUTHORITY_DENIED"
  | "TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED";

export interface LaunchAuthorityVerdict {
  allowed: boolean;
  mode: TorpedoLaunchAuthorityMode | null;
  manualLaunch: boolean;
  reasonCode: LaunchAuthorityReasonCode | null;
}

export function validateLaunchAuthority(
  grant: AuthorityGrant | null | undefined,
  manualLaunch: boolean,
): LaunchAuthorityVerdict {
  if (!verifyAuthorityGrant(grant)) {
    return {
      allowed: false,
      mode: null,
      manualLaunch,
      reasonCode: TORPEDO_LAUNCH_AUTHORITY_DENIED,
    };
  }
  const g = grant as AuthorityGrant;
  if (manualLaunch && (MANUAL_LAUNCH_PROHIBITED_MODES as readonly string[]).includes(g.mode)) {
    return {
      allowed: false,
      mode: g.mode,
      manualLaunch,
      reasonCode: TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED,
    };
  }
  return { allowed: true, mode: g.mode, manualLaunch, reasonCode: null };
}
