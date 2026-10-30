export const GLOBE_SPIKE_HASH = "#globe-spike";
export const GLOBE_SPIKE_FAIL_HASH = "#globe-spike-fail";
export const GLOBE_SPIKE_RUNTIME_HASH = "#globe-spike-runtime";
export const GLOBE_SPIKE_MISSING_HASH = "#globe-spike-missing";
export const GLOBE_SPIKE_CORRUPT_HASH = "#globe-spike-corrupt";

export type LandMode = "baked" | "runtime" | "missing" | "corrupt";

export function landModeFromHash(hash: string): LandMode {
  if (hash === GLOBE_SPIKE_RUNTIME_HASH) return "runtime";
  if (hash === GLOBE_SPIKE_MISSING_HASH) return "missing";
  if (hash === GLOBE_SPIKE_CORRUPT_HASH) return "corrupt";
  return "baked";
}

export function isSpikeHash(hash: string): boolean {
  return (
    hash === GLOBE_SPIKE_HASH ||
    hash === GLOBE_SPIKE_FAIL_HASH ||
    hash === GLOBE_SPIKE_RUNTIME_HASH ||
    hash === GLOBE_SPIKE_MISSING_HASH ||
    hash === GLOBE_SPIKE_CORRUPT_HASH
  );
}
