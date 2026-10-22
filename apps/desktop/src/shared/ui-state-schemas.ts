import { Schema } from "effect";
import { boundedString, nonEmptyString, nonNegativeInt } from "./schema-primitives.js";
import { INSPECTOR_MAX_WIDTH_PX, INSPECTOR_MIN_WIDTH_PX } from "./ui-state-contract.js";

export const FirstMonthInspectionSchema = Schema.Struct({
  status: Schema.Literals(["not_started", "in_progress", "completed", "dismissed"]),
  lastCompletedStep: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({ minimum: 0, maximum: 6 }),
  ),
});

export const InspectorLayoutSchema = Schema.Struct({
  widthPx: Schema.Finite.check(
    Schema.isInt(),
    Schema.isBetween({
      minimum: INSPECTOR_MIN_WIDTH_PX,
      maximum: INSPECTOR_MAX_WIDTH_PX,
    }),
  ),
  collapsed: Schema.Boolean,
});

export const TurnMessagesSchema = Schema.Struct({
  pinnedIds: Schema.Array(boundedString(1, 128)).check(Schema.isMaxLength(512)),
  readIds: Schema.Array(boundedString(1, 128)).check(Schema.isMaxLength(512)),
});

export const UiStateSchema = Schema.Struct({
  turnNumber: nonNegativeInt,
  dismissedFingerprints: Schema.Array(boundedString(1, 256)).check(Schema.isMaxLength(64)),
  firstMonthInspection: Schema.optional(FirstMonthInspectionSchema),
  inspector: Schema.optional(InspectorLayoutSchema),
  turnMessages: Schema.optional(TurnMessagesSchema),
});

export const WriteUiStatePayloadSchema = Schema.Struct({
  sessionId: nonEmptyString,
  dismissedFingerprints: Schema.Array(boundedString(1, 256)).check(Schema.isMaxLength(64)),
  firstMonthInspection: Schema.optional(FirstMonthInspectionSchema),
  inspector: Schema.optional(InspectorLayoutSchema),
  turnMessages: Schema.optional(TurnMessagesSchema),
});
