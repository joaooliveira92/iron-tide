import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

export const CommandStates = [
  "INTENDED",
  "ISSUED",
  "TRANSMITTED",
  "ACKNOWLEDGED",
  "EXECUTING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;
export type CommandState = (typeof CommandStates)[number];

const ALLOWED: Record<CommandState, CommandState[]> = {
  INTENDED: ["ISSUED", "FAILED", "CANCELLED"],
  ISSUED: ["TRANSMITTED", "FAILED", "CANCELLED"],
  TRANSMITTED: ["ACKNOWLEDGED", "FAILED", "CANCELLED"],
  ACKNOWLEDGED: ["EXECUTING", "FAILED", "CANCELLED"],
  EXECUTING: ["COMPLETED", "FAILED", "CANCELLED"],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export interface TacticalCommandRecord {
  commandId: string;
  commandType: string;
  issuerParticipantId: string;
  commandSource: string;
  targetKind: "force" | "division" | "ship" | "contact" | "area" | "objective";
  targetId: string;
  inputTimestampTacticalMs: number;
  effectiveMinute: number;
  effectiveSubstep: number;
  intendedParameters: Record<string, unknown>;
  commandAuthorityResult?: string;
  communicationPath?: string;
  transmissionDelayMinutes?: number;
  acknowledgmentResult?: string;
  commandStatus: CommandState;
  failureReason?: string;
  executionResult?: string;
  rulesetVersion: string;
  formulaVersion: string;
  commandHash: string;
  permitsLocalAutonomous?: boolean;
}

export function createCommandRecord(
  init: Omit<TacticalCommandRecord, "commandHash" | "commandStatus"> & {
    commandStatus?: CommandState;
  },
): TacticalCommandRecord {
  const base = { commandStatus: "INTENDED" as CommandState, ...init } as TacticalCommandRecord;
  (base as unknown as Record<string, unknown>)["commandHash"] = computeCommandHash(base);
  return base;
}
export function computeCommandHash(r: Omit<TacticalCommandRecord, "commandHash">): string {
  return sha256Hex(canonicalSerialize({ ...r, commandHash: undefined }));
}
export function transitionCommand(
  record: TacticalCommandRecord,
  to: CommandState,
): TacticalCommandRecord {
  if (
    to === "EXECUTING" &&
    record.commandStatus !== "ACKNOWLEDGED" &&
    !record.permitsLocalAutonomous
  ) {
    throw new BluewaveError("INVALID_TACTICAL_COMMAND_TRANSITION: EXECUTING before ACKNOWLEDGED", {
      code: "INVALID_TACTICAL_COMMAND_TRANSITION",
      from: record.commandStatus,
      to,
    });
  }
  if (!ALLOWED[record.commandStatus].includes(to)) {
    throw new BluewaveError("INVALID_TACTICAL_COMMAND_TRANSITION", {
      code: "INVALID_TACTICAL_COMMAND_TRANSITION",
      from: record.commandStatus,
      to,
    });
  }
  const next = { ...record, commandStatus: to, commandHash: "" };
  next.commandHash = computeCommandHash(next);
  return next;
}
