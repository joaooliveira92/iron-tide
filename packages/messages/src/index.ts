export {
  aggregate,
  deduplicate,
  sortMessages,
  withIdentities,
  type MessageDraft,
} from "./aggregate.js";
export {
  InterruptionInputError,
  InvalidInterruptionError,
  InvalidProjectionInputError,
} from "./errors.js";
export { classifyEventBody, SEVERITY_RANK, type MessageClassification } from "./policy.js";
export { describeEventBody, type EventDescription } from "./provenance.js";
export {
  playerVisibleMessages,
  projectTurnMessages,
  type ProjectionInput,
  type ProjectionSnapshot,
} from "./project.js";
export {
  DebugMetadataSchema,
  decodeTurnMessage,
  decodeTurnMessages,
  EffectReferenceSchema,
  EntityReferenceSchema,
  InterpolationSchema,
  MESSAGE_CATEGORIES,
  MESSAGE_SEVERITIES,
  MessageCategorySchema,
  MessageSeveritySchema,
  TurnMessageSchema,
  TurnPhaseSchema,
  TURN_PHASES,
  type CampaignDate,
  type DebugMetadata,
  type EffectReference,
  type EffectVisibility,
  type EntityReference,
  type EntityReferenceType,
  type Interpolation,
  type MessageCategory,
  type MessageSeverity,
  type TurnMessage,
  type TurnPhase,
} from "./schema.js";
export { PROJECTION_VERSION } from "./version.js";
