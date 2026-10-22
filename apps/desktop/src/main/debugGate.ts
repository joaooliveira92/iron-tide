declare const __BLUEWAVE_DEBUG__: boolean | undefined;

export function isDebugModeEnabled(): boolean {
  return typeof __BLUEWAVE_DEBUG__ !== "undefined" && __BLUEWAVE_DEBUG__ === true;
}

export function isBattleSandboxEnabled(): boolean {
  return isDebugModeEnabled();
}
