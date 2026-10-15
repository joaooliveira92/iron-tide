// packages/combat/src/safe-int-schema.ts
// A single Effect v4 schema for the repository's nominal `SafeInt` type.
//
// `Schema.Finite` decodes to a plain `number`, which would widen the exported
// contract types that carried the `SafeInt` brand before the ticket-12
// migration (`z.custom<SafeInt>` / `z.infer`). `Schema.declare<SafeInt>` keeps
// the exact branded output type while reusing the canonical
// `SafeInt.isSafeInt` runtime guard, so the public types stay identical and the
// runtime accept/reject behavior is unchanged.
import { SafeInt } from "@bluewave/contracts";
import { Schema } from "effect";

export const safeIntSchema: Schema.declare<SafeInt> = Schema.declare<SafeInt>(
  (value): value is SafeInt => typeof value === "number" && SafeInt.isSafeInt(value),
  { expected: "SafeInt" },
);
