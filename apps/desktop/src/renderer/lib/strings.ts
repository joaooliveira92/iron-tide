/**
 * The single string resolver's renderer-facing alias (U-4 map D6, ADR-0209).
 *
 * There is exactly one resolver: `content/uiCatalogue.ts`. It composes the
 * compiled UI catalogue ahead of the in-repo en-US fallback and owns the single
 * missing-key sink. `translate` is a compatibility alias for it, kept so the
 * shell/Options call sites migrate onto `resolveMessage` incrementally; the two
 * can never disagree because one delegates to the other.
 */
export { EN_US_MESSAGES, type MessageKey } from "./en-us-messages.js";
export {
  hasAuthoredMessage,
  resolveMessage as translate,
  setMissingKeyWarner,
} from "../content/uiCatalogue.js";
