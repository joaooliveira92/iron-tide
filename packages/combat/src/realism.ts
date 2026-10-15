import { BluewaveError } from "@bluewave/contracts";
export const RealismModes = ["ADMIRAL", "REAR_ADMIRAL", "CAPTAIN"] as const;
export type RealismMode = (typeof RealismModes)[number];

export const CAREER_MULTIPLIERS_BP: Record<RealismMode, number> = {
  ADMIRAL: 11_000,
  REAR_ADMIRAL: 10_000,
  CAPTAIN: 9_500,
};
export const TACTICAL_REALISM_DIMENSION = "tactical_realism" as const;

export function getCareerEvaluationMultiplier(
  mode: RealismMode,
  contract?: { multipliers?: Record<string, number>; dimension?: string },
): number {
  if (!contract || !contract.multipliers || !contract.dimension)
    throw new BluewaveError("TACTICAL_REALISM_EVALUATION_CONTRACT_MISSING", {
      code: "TACTICAL_REALISM_EVALUATION_CONTRACT_MISSING",
      mode,
    });
  if (contract.dimension !== TACTICAL_REALISM_DIMENSION)
    throw new BluewaveError("TACTICAL_REALISM_EVALUATION_CONTRACT_MISSING", {
      code: "TACTICAL_REALISM_EVALUATION_CONTRACT_MISSING",
      dimension: contract.dimension,
    });
  const v = contract.multipliers[mode];
  if (v !== 11_000 && v !== 10_000 && v !== 9_500)
    throw new BluewaveError("TACTICAL_REALISM_EVALUATION_CONTRACT_MISSING", {
      code: "TACTICAL_REALISM_EVALUATION_CONTRACT_MISSING",
      v,
    });
  return v;
}
export function shippedCareerMultiplier(mode: RealismMode): number {
  return CAREER_MULTIPLIERS_BP[mode];
}

export class BattleRealism {
  readonly mode: RealismMode;
  constructor(mode: RealismMode) {
    if (!RealismModes.includes(mode))
      throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED", {
        code: "TACTICAL_STATE_INVARIANT_FAILED",
        mode,
      });
    this.mode = mode;
  }
  assertImmutable(newMode: RealismMode) {
    if (newMode !== this.mode)
      throw new BluewaveError("TACTICAL_STATE_INVARIANT_FAILED: realism immutable", {
        code: "TACTICAL_STATE_INVARIANT_FAILED",
        from: this.mode,
        to: newMode,
      });
  }
}

const ADMIRAL_ALLOWED = new Set([
  "LEAD_DIVISION",
  "MISSION_OBJECTIVE",
  "RALLY",
  "DISENGAGE",
  "CHANGE_LEAD_DIVISION",
  "BATTLE_TURN_AWAY",
  "COORDINATION_REQUEST",
]);
const ADMIRAL_PROHIBITED = new Set([
  "DIRECT_SHIP_HELM",
  "DIRECT_TARGET_ASSIGNMENT",
  "MANUAL_GUN_TARGETING",
  "MANUAL_TORPEDO_FIRING",
  "MANUAL_AMMUNITION_SELECTION",
  "DIRECT_ALLIED_COMMAND",
]);

export function assertAdmiralAuthority(commandType: string) {
  if (ADMIRAL_PROHIBITED.has(commandType))
    throw new BluewaveError("TACTICAL_REALISM_COMMAND_PROHIBITED", {
      code: "TACTICAL_REALISM_COMMAND_PROHIBITED",
      mode: "ADMIRAL",
      commandType,
    });
  if (!ADMIRAL_ALLOWED.has(commandType))
    throw new BluewaveError("TACTICAL_COMMAND_AUTHORITY_DENIED", {
      code: "TACTICAL_COMMAND_AUTHORITY_DENIED",
      commandType,
    });
}
export function assertRearAdmiralAuthority(commandType: string) {
  const prohibited = new Set([
    "DIRECT_SHIP_HELM_EXCEPT_FLAGSHIP",
    "INDIVIDUAL_GUN_MOUNT_TARGETING",
    "MANUAL_GUN_FIRING",
    "MANUAL_TORPEDO_FIRING",
    "DIRECT_ALLIED_WITHOUT_AUTHORITY",
  ]);
  if (prohibited.has(commandType))
    throw new BluewaveError("TACTICAL_REALISM_COMMAND_PROHIBITED", {
      code: "TACTICAL_REALISM_COMMAND_PROHIBITED",
      mode: "REAR_ADMIRAL",
      commandType,
    });
}
export function assertCaptainAuthority(
  commandType: string,
  opts: { isKnownContact: boolean; inRange: boolean; hasAmmo: boolean; blackout: boolean },
) {
  if (opts.blackout)
    throw new BluewaveError("TACTICAL_COMMAND_AUTHORITY_DENIED", {
      code: "TACTICAL_COMMAND_AUTHORITY_DENIED",
      reason: "blackout",
    });
  if (!opts.isKnownContact)
    throw new BluewaveError("TACTICAL_FOG_OF_WAR_VIOLATION", {
      code: "TACTICAL_FOG_OF_WAR_VIOLATION",
      commandType,
    });
  if (!opts.inRange || !opts.hasAmmo)
    throw new BluewaveError("TACTICAL_COMMAND_AUTHORITY_DENIED", {
      code: "TACTICAL_COMMAND_AUTHORITY_DENIED",
      commandType,
    });
}
