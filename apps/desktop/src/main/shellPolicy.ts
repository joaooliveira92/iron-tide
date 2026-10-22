export const ERR_ABORTED = -3;

export const MAX_RENDERER_RECOVERIES = 1;

export function isActionableLoadFailure(code: number, isMainFrame: boolean): boolean {
  return isMainFrame && code !== ERR_ABORTED;
}

export function canRecoverRenderer(
  recoveries: number,
  max: number = MAX_RENDERER_RECOVERIES,
): boolean {
  return recoveries < max;
}

export function shouldReloadForDevToolsHook(
  rendererCount: number,
  alreadyReloaded: boolean,
): boolean {
  return !alreadyReloaded && rendererCount === 0;
}
