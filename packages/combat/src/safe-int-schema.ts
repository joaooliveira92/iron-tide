import { SafeInt } from "@bluewave/contracts";
import { Schema } from "effect";

export const safeIntSchema: Schema.declare<SafeInt> = Schema.declare<SafeInt>(
  (value): value is SafeInt => typeof value === "number" && SafeInt.isSafeInt(value),
  { expected: "SafeInt" },
);
