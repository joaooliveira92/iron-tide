import type { PendingDecision } from "@bluewave/messages";
import { Context, Effect, Layer } from "effect";

export class DecisionSource extends Context.Service<
  DecisionSource,
  {
    readonly pendingDecisions: (sessionId: string) => Effect.Effect<readonly PendingDecision[]>;
  }
>()("bluewave/desktop/DecisionSource") {}

export function decisionSourceLayer(): Layer.Layer<DecisionSource> {
  return Layer.succeed(DecisionSource, {
    pendingDecisions: () => Effect.succeed([]),
  });
}
