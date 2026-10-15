/**
 * Pure decisions for the desktop shell's lifecycle and failure recovery
 * (ADR-0121). Kept apart from `index.ts` so the policy — how many times a
 * renderer may be reloaded, which load failures are actionable — is unit-tested
 * without launching Electron.
 */

/** Chromium reports an in-progress navigation aborted as `-3`; it is not a failure. */
export const ERR_ABORTED = -3;

/** A renderer is reloaded at most this many times before the shell gives up. */
export const MAX_RENDERER_RECOVERIES = 1;

/** A main-frame load failure that we should react to (not an aborted navigation). */
export function isActionableLoadFailure(code: number, isMainFrame: boolean): boolean {
  return isMainFrame && code !== ERR_ABORTED;
}

/** Whether another reload is allowed given how many recoveries already happened. */
export function canRecoverRenderer(
  recoveries: number,
  max: number = MAX_RENDERER_RECOVERIES,
): boolean {
  return recoveries < max;
}

/**
 * The React DevTools page hook is installed by the extension's background
 * worker, which can land after the first navigation — leaving React already
 * initialised and never registered (the panel shows "this page doesn't have
 * React"). Reload once so the hook runs at `document_start` ahead of React.
 */
export function shouldReloadForDevToolsHook(
  rendererCount: number,
  alreadyReloaded: boolean,
): boolean {
  return !alreadyReloaded && rendererCount === 0;
}
