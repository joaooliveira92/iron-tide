import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import { CommandEnvelopePayloadSchema } from "../campaignCommandSchemas.js";
import { withSchema } from "../runtime/commandProgram.js";
import { runTurnTransaction } from "./turnTransaction.js";

/**
 * `commitMonth(sessionId, expectedRevision, transportRequestId) -> CommitMonthResponse`
 * (ticket 13), retained and now delegating to `runTurnTransaction`'s
 * **no-interruption** fast path (ticket 05; D-17 stage 4). It runs the real
 * monthly pipeline through the desktop service graph and returns the same wire
 * envelope as before: a revision/end-of-simulation guard rejects, an execution
 * failure errors, and a completed month returns the `CommitMonthResponse` plus
 * any non-authoritative sidecar diagnostics.
 */
export const commitMonthProgram = withSchema(CommandEnvelopePayloadSchema, (payload) =>
  Effect.gen(function* () {
    const outcome = yield* runTurnTransaction({
      sessionId: payload.sessionId,
      expectedRevision: payload.expectedRevision,
      allowInterruptions: false,
    });

    switch (outcome.kind) {
      case "completed":
        return {
          outcome: "success" as const,
          value: outcome.response satisfies CommitMonthResponse,
          diagnostics: [...outcome.diagnostics],
        };
      case "rejected":
        return {
          outcome: "rejected" as const,
          reason: outcome.reason,
          diagnostics: [...outcome.diagnostics],
          ...(outcome.currentRevision !== undefined
            ? { currentRevision: outcome.currentRevision }
            : {}),
        };
      case "error":
        return {
          outcome: "error" as const,
          reason: outcome.reason,
          diagnostics: [...outcome.diagnostics],
        };
      default:
        return {
          outcome: "error" as const,
          reason: "UNEXPECTED_INTERRUPTION",
          diagnostics: ["A no-interruption commit must not suspend."],
        };
    }
  }),
);
