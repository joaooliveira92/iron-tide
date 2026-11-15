import { BluewaveError } from "@bluewave/contracts";
import { Schema } from "effect";
import { decodeContract } from "../schema-issues.js";
import {
  RUN_CONTACT_AWARE_HELD_MINUTES,
  RUN_CONTACT_AWARE_IDLE_MINUTES,
  RUN_MAX_TURN_MINUTES,
  RUN_PAUSE_KINDS,
} from "./runConstants.js";

export const RUN_REQUEST_INVALID = "RUN_REQUEST_INVALID" as const;
export const RUN_CAP_REQUIRED = "RUN_CAP_REQUIRED" as const;

export const RUN_REASON_CODES = { RUN_REQUEST_INVALID, RUN_CAP_REQUIRED } as const;

export type RunPauseKind = (typeof RUN_PAUSE_KINDS)[number];

export type RunMode =
  | { readonly kind: "TURN" }
  | { readonly kind: "RUN_N"; readonly minutes: number }
  | { readonly kind: "RUN_UNTIL_EVENT" }
  | { readonly kind: "RUN_CONTACT_AWARE" };

export interface RunRequest {
  readonly mode: RunMode;
  readonly pauseOn: readonly RunPauseKind[];
  readonly runCapMinutes?: number;
}

const integer = Schema.Finite.check(Schema.isInt());

const modeSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("TURN") }),
  Schema.Struct({
    kind: Schema.Literal("RUN_N"),
    minutes: integer.check(
      Schema.isGreaterThanOrEqualTo(1),
      Schema.isLessThanOrEqualTo(RUN_MAX_TURN_MINUTES),
    ),
  }),
  Schema.Struct({ kind: Schema.Literal("RUN_UNTIL_EVENT") }),
  Schema.Struct({ kind: Schema.Literal("RUN_CONTACT_AWARE") }),
]);

export const RunRequestSchema = Schema.Struct({
  mode: modeSchema,
  pauseOn: Schema.Array(Schema.Literals(RUN_PAUSE_KINDS)),
  runCapMinutes: Schema.optionalKey(integer.check(Schema.isGreaterThanOrEqualTo(1))),
});

export function decodeRunRequest(value: unknown): RunRequest {
  const request = decodeContract(RunRequestSchema, RUN_REQUEST_INVALID, value);
  if (request.mode.kind === "RUN_UNTIL_EVENT" && request.runCapMinutes === undefined) {
    throw new BluewaveError(RUN_CAP_REQUIRED, {
      code: RUN_CAP_REQUIRED,
      reason: "RUN_UNTIL_EVENT needs an explicit runCapMinutes; the cap has no ruleset value yet",
    });
  }
  return request;
}

export function requestedMinutes(mode: RunMode, enemyContactHeld: boolean): number {
  switch (mode.kind) {
    case "TURN":
      return 1;
    case "RUN_N":
      return mode.minutes;
    case "RUN_CONTACT_AWARE":
      return enemyContactHeld ? RUN_CONTACT_AWARE_HELD_MINUTES : RUN_CONTACT_AWARE_IDLE_MINUTES;
    case "RUN_UNTIL_EVENT":
      return Number.POSITIVE_INFINITY;
  }
}
