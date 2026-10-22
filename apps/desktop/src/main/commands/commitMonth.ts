import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { Effect } from "effect";
import type { CommandHandler } from "../runtime/commandProgram.js";
import { runTurnTransaction } from "./turnTransaction.js";

export const commitMonthProgram: CommandHandler<"commitMonth"> = (payload) =>
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
  });
