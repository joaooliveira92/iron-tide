import { BluewaveError } from "@bluewave/contracts";

import { MISSILE_STATE_INVARIANT_FAILED } from "./reasonCodes.js";

export const missilePolicyId = "missile_v1" as const;

export const MISSILE_RULESET_VERSION = "missile_ruleset_v1" as const;
export const MISSILE_FORMULA_VERSION = "missile_formula_v1" as const;

export const MISSILE_BASIS_POINTS = 10_000 as const;
export const MISSILE_MICROMETRES_PER_METRE = 1_000_000 as const;
export const MISSILE_SECONDS_PER_MINUTE = 60 as const;

export const SSM_MISSILE_CLASSES = ["light_ssm", "medium_ssm", "heavy_ssm"] as const;
export type SsmMissileClass = (typeof SSM_MISSILE_CLASSES)[number];

export const MISSILE_CLASSES = [...SSM_MISSILE_CLASSES, "sam", "asm"] as const;
export type MissileClass = (typeof MISSILE_CLASSES)[number];

export const MISSILE_SUBSTEP = 55 as const;
export const MISSILE_LAUNCH_PRIORITY = 9 as const;
export const MISSILE_IMPACT_PRIORITY = 9 as const;
export const MISSILE_LAUNCH_EVENT_TYPE = "missile_launch" as const;
export const MISSILE_IMPACT_EVENT_TYPE = "missile_impact" as const;

export const MISSILE_RECORD_KINDS = ["LAUNCH", "INTERCEPT", "HIT", "MISS"] as const;
export type MissileRecordKind = (typeof MISSILE_RECORD_KINDS)[number];

export const MISSILE_DAMAGE_HIT_LOCATION = "DECK" as const;

export interface MissileClassRules {
  readonly rangeM: number;
  readonly flightTimeSeconds: number;
  readonly salvoSize: number;
  readonly baseHitBp: number;
  readonly structuralDamage: number;
  readonly flotationDamage: number;
  readonly defenceInterceptBp: number;
  readonly maxSalvosPerBattle: number;
}

export interface MissileRules {
  readonly classes: Readonly<Record<SsmMissileClass, MissileClassRules>>;
}

export interface MissileContract {
  readonly policyId: string;
  readonly rulesetVersion: string;
  readonly formulaVersion: string;
  readonly basisPoints: number;
  readonly micrometresPerMetre: number;
  readonly secondsPerMinute: number;
  readonly ssmClasses: readonly SsmMissileClass[];
  readonly missileClasses: readonly MissileClass[];
  readonly substep: number;
  readonly launchPriority: number;
  readonly impactPriority: number;
  readonly launchEventType: string;
  readonly impactEventType: string;
  readonly recordKinds: readonly MissileRecordKind[];
  readonly hitLocation: string;
}

export const SHIPPED_MISSILE_CONTRACT: MissileContract = {
  policyId: missilePolicyId,
  rulesetVersion: MISSILE_RULESET_VERSION,
  formulaVersion: MISSILE_FORMULA_VERSION,
  basisPoints: MISSILE_BASIS_POINTS,
  micrometresPerMetre: MISSILE_MICROMETRES_PER_METRE,
  secondsPerMinute: MISSILE_SECONDS_PER_MINUTE,
  ssmClasses: SSM_MISSILE_CLASSES,
  missileClasses: MISSILE_CLASSES,
  substep: MISSILE_SUBSTEP,
  launchPriority: MISSILE_LAUNCH_PRIORITY,
  impactPriority: MISSILE_IMPACT_PRIORITY,
  launchEventType: MISSILE_LAUNCH_EVENT_TYPE,
  impactEventType: MISSILE_IMPACT_EVENT_TYPE,
  recordKinds: MISSILE_RECORD_KINDS,
  hitLocation: MISSILE_DAMAGE_HIT_LOCATION,
};

function arrayEquals(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function throwContractMismatch(reason: string): never {
  throw new BluewaveError(MISSILE_STATE_INVARIANT_FAILED, {
    code: MISSILE_STATE_INVARIANT_FAILED,
    contract: "missile_v1",
    reason,
  });
}

export function validateMissileContract(
  contract: Partial<MissileContract> | null | undefined,
): asserts contract is MissileContract {
  if (!contract) throwContractMismatch("missile_v1 missing contract");
  if (contract.policyId !== missilePolicyId) throwContractMismatch("missile_v1 policy id");
  if (
    contract.rulesetVersion !== MISSILE_RULESET_VERSION ||
    contract.formulaVersion !== MISSILE_FORMULA_VERSION
  )
    throwContractMismatch("missile_v1 ruleset/formula versions");
  if (contract.basisPoints !== MISSILE_BASIS_POINTS)
    throwContractMismatch("missile_v1 basis points");
  if (contract.micrometresPerMetre !== MISSILE_MICROMETRES_PER_METRE)
    throwContractMismatch("missile_v1 micrometres per metre");
  if (contract.secondsPerMinute !== MISSILE_SECONDS_PER_MINUTE)
    throwContractMismatch("missile_v1 seconds per minute");
  if (!contract.ssmClasses || !arrayEquals(contract.ssmClasses, SSM_MISSILE_CLASSES))
    throwContractMismatch("missile_v1 SSM class set");
  if (!contract.missileClasses || !arrayEquals(contract.missileClasses, MISSILE_CLASSES))
    throwContractMismatch("missile_v1 known missile class set");
  if (contract.substep !== MISSILE_SUBSTEP) throwContractMismatch("missile_v1 substep");
  if (contract.launchPriority !== MISSILE_LAUNCH_PRIORITY)
    throwContractMismatch("missile_v1 launch priority");
  if (contract.impactPriority !== MISSILE_IMPACT_PRIORITY)
    throwContractMismatch("missile_v1 impact priority");
  if (contract.launchEventType !== MISSILE_LAUNCH_EVENT_TYPE)
    throwContractMismatch("missile_v1 launch event type");
  if (contract.impactEventType !== MISSILE_IMPACT_EVENT_TYPE)
    throwContractMismatch("missile_v1 impact event type");
  if (!contract.recordKinds || !arrayEquals(contract.recordKinds, MISSILE_RECORD_KINDS))
    throwContractMismatch("missile_v1 record kind set");
  if (contract.hitLocation !== MISSILE_DAMAGE_HIT_LOCATION)
    throwContractMismatch("missile_v1 hit location");
}

export function isSsmMissileClass(value: string): value is SsmMissileClass {
  return (SSM_MISSILE_CLASSES as readonly string[]).includes(value);
}
