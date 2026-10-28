export const GLOBE_ADAPTER_HASH = "#globe-adapter";
export const GLOBE_ADAPTER_FAIL_HASH = "#globe-adapter-fail";
export const GLOBE_ADAPTER_MISSING_HASH = "#globe-adapter-missing";
export const GLOBE_ADAPTER_CORRUPT_HASH = "#globe-adapter-corrupt";

export type AdapterLandMode = "baked" | "missing" | "corrupt";

export function adapterRequested(hash: string): boolean {
  return (
    hash === GLOBE_ADAPTER_HASH ||
    hash === GLOBE_ADAPTER_FAIL_HASH ||
    hash === GLOBE_ADAPTER_MISSING_HASH ||
    hash === GLOBE_ADAPTER_CORRUPT_HASH
  );
}

export function adapterLandMode(hash: string): AdapterLandMode {
  if (hash === GLOBE_ADAPTER_MISSING_HASH) return "missing";
  if (hash === GLOBE_ADAPTER_CORRUPT_HASH) return "corrupt";
  return "baked";
}

export function adapterFailureRequested(hash: string): boolean {
  return hash === GLOBE_ADAPTER_FAIL_HASH;
}

declare const __GLOBE_ADAPTER__: boolean;

export const GLOBE_ADAPTER_ENABLED =
  typeof __GLOBE_ADAPTER__ !== "undefined" && __GLOBE_ADAPTER__ === true;
