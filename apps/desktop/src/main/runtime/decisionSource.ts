// The authored-decision feed for a turn (T6 test seam). The turn transaction
// raises whatever decisions this service returns through the interruption
// channel; production supplies none (S-4 owns authored crisis/decision content),
// so the default layer is an empty feed. A test layer supplies one deterministic
// decision to exercise a real suspension end to end. It carries no authoritative
// state and draws no randomness.
import type { PendingDecision } from "@bluewave/messages";
import { Context, Effect, Layer } from "effect";

export class DecisionSource extends Context.Service<
  DecisionSource,
  {
    /** The decisions to raise for the given session's next turn (usually none). */
    readonly pendingDecisions: (sessionId: string) => Effect.Effect<readonly PendingDecision[]>;
  }
>()("bluewave/desktop/DecisionSource") {}

/** The production feed: no authored decisions in the first increment. */
export function decisionSourceLayer(): Layer.Layer<DecisionSource> {
  return Layer.succeed(DecisionSource, {
    pendingDecisions: () => Effect.succeed([]),
  });
}
