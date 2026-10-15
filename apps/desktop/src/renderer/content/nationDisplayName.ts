/**
 * Resolves a canonical nation id to its canonical display name from the decoded
 * presentation corpus served over the content IPC (CAH-PRES-3). An unmapped or
 * unknown id falls back to the raw id verbatim — never an invented name and
 * never a silent default. Display only: never feed the result back into
 * mechanics.
 */
export { nationDisplayName } from "./presentationContent.js";
