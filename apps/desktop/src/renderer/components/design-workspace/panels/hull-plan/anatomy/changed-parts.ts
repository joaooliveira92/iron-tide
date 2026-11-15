import type { DesignFeedback } from "../../../designFeedback.js";
import type { PartKind } from "./anatomy-types.js";

export interface ChangedParts {
  readonly kinds: ReadonlySet<PartKind>;
  readonly phase: 0 | 1;
}

export const changedKinds = (feedback: DesignFeedback | null): ReadonlySet<PartKind> =>
  new Set(feedback === null ? [] : feedback.aspects.flatMap((aspect) => aspect.parts));
