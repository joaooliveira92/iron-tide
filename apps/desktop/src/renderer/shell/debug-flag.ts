import { isDebugMode } from "./debug-mode.js";

/**
 * True only in a debug build (`VITE_BLUEWAVE_DEBUG=true`, ADR-0029). Gates
 * engine-facing detail that players should not see: session ids, revision
 * numbers, month codes and the debug-only screens.
 */
export const DEBUG_MODE = isDebugMode({ flag: import.meta.env.VITE_BLUEWAVE_DEBUG });
