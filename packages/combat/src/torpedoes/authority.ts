// DESIGN-40 §5 torpedo command authority — the shipped tactical policy
// `torpedo_launch_authority_v1` as a versioned contract defining the three
// modes ADMIRAL / REAR_ADMIRAL / CAPTAIN and their legality semantics, plus a
// fail-closed legality guard. Player command plumbing (ManualTorpedoLaunchCommand,
// DivisionTorpedoAttackOrder, tactical AI selection — §5.1-§5.4) is DEFERRED to
// a later command/AI slice; this guard is the pure policy surface both player
// and AI launches pass through (identical rules — no side parameter).
// Pure/deterministic: no ambient I/O/clock/random.
import { BluewaveError } from "@bluewave/contracts";
import { TORPEDO_FORMULA_VERSION, TORPEDO_RULESET_VERSION } from "./constants.js";
import {
  TORPEDO_LAUNCH_AUTHORITY_DENIED,
  TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED,
  TORPEDO_STATE_INVARIANT_FAILED,
} from "./reasonCodes.js";

export const torpedoLaunchAuthorityPolicyId = "torpedo_launch_authority_v1" as const;

// DESIGN-40 §5 closed authority-mode enum — exactly these three values.
export const TORPEDO_LAUNCH_AUTHORITY_MODES = ["ADMIRAL", "REAR_ADMIRAL", "CAPTAIN"] as const;
export type TorpedoLaunchAuthorityMode = (typeof TORPEDO_LAUNCH_AUTHORITY_MODES)[number];

// §5.1/§5.2: ADMIRAL and REAR_ADMIRAL modes prohibit player MANUAL launch;
// §5.3: CAPTAIN permits manual launch through the exact command contract.
// §5.4: automated/AI launches (LaunchTorpedoCommand through tactical AI) are
// legal in every mode — the guard keys ONLY on the manual flag, never on a
// side, so AI and player obey identical rules.
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

// AC-24 subset: the torpedo_launch_authority_v1 contract pins the closed mode
// enum + the prohibited-manual modes; any drift fails closed.
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

// AC-5: a verifiable authority grant. The grant carries the stable command/
// grant id (idempotency), the platform it authorizes, and the §5 mode. The
// verify guard is the fail-closed admission check: an unknown policy, an
// out-of-enum mode, or empty ids never grants authority.
export interface AuthorityGrant {
  grantId: string; // stable authored command/grant id (idempotency)
  platformId: string; // the platform this grant authorizes
  mode: TorpedoLaunchAuthorityMode;
  policyId: string; // must be torpedo_launch_authority_v1
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

// AC-5: structured legality verdict — never throw-only. `mode` is null when no
// valid grant is present. Exactly one explicit reason code on denial, null on
// approval.
export interface LaunchAuthorityVerdict {
  allowed: boolean;
  mode: TorpedoLaunchAuthorityMode | null;
  manualLaunch: boolean;
  reasonCode: LaunchAuthorityReasonCode | null;
}

// AC-5: the §5 legality guard. Fail-closed:
//   - missing/unknown/invalid grant  -> TORPEDO_LAUNCH_AUTHORITY_DENIED
//   - manual launch in ADMIRAL/REAR_ADMIRAL -> TORPEDO_MANUAL_LAUNCH_MODE_PROHIBITED
//   - manual launch in CAPTAIN        -> allowed
//   - automated/AI launch (manualLaunch false) -> allowed in EVERY mode (§5.1/§5.4)
// AI + player use the SAME function: the only inputs are the grant and whether
// the launch is manual — there is no side parameter to branch on.
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
