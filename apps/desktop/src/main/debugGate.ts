/**
 * Whether debug-only main-process features are available. `__BLUEWAVE_DEBUG__` is
 * replaced at build time by `electron.vite.config.ts` from the same
 * `VITE_BLUEWAVE_DEBUG=true` flag that gates the debug screens in the renderer
 * (ADR-0029), so a normal build contains the constant `false`.
 */
declare const __BLUEWAVE_DEBUG__: boolean | undefined;

export function isDebugModeEnabled(): boolean {
  return typeof __BLUEWAVE_DEBUG__ !== "undefined" && __BLUEWAVE_DEBUG__ === true;
}

/** Whether the debug-only Tactical Sandbox battle commands are available (ADR-0057). */
export function isBattleSandboxEnabled(): boolean {
  return isDebugModeEnabled();
}
