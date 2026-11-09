import * as Effect from "../../Effect.js";
import { Abandon } from "../ClusterSchema.js";
// Annotate before opening the interruptible region. An interrupt already
// pending on an uninterruptible fiber fires as soon as the region opens, and
// the annotation is merged into that pending cause instead of being lost.
export const interrupt = /*#__PURE__*/Effect.withFiber(fiber => {
  fiber.interruptUnsafe(fiber.id, Abandon.annotation);
  return Effect.interruptible(Effect.never);
});
export const isCause = cause => cause.reasons.some(reason => reason._tag === "Interrupt" && reason.annotations.has(Abandon.key));
//# sourceMappingURL=clusterAbandon.js.map