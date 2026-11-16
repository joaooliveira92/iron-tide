export const GLOBE_ADAPTER_HASH = "#globe-adapter";
export const GLOBE_ADAPTER_FAIL_HASH = "#globe-adapter-fail";
export const GLOBE_ADAPTER_MISSING_HASH = "#globe-adapter-missing";
export const GLOBE_ADAPTER_CORRUPT_HASH = "#globe-adapter-corrupt";

export const LEGACY_RENDERER_HASH = "#legacy-renderer";
export const GLOBE_RENDERER_HASH = "#globe-renderer";
export const RENDERER_STORAGE_KEY = "bluewave.overviewRenderer";
export const RENDERER_QUERY_KEY = "renderer";

export type AdapterLandMode = "baked" | "missing" | "corrupt";
export type OverviewRenderer = "globe" | "legacy";

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

export interface RendererPreferenceSources {
  readonly hash: string;
  readonly search: string;
  readonly stored: string | null;
}

function storedPreference(stored: string | null): OverviewRenderer | null {
  if (stored === "globe" || stored === "legacy") return stored;
  return null;
}

function queryPreference(search: string): OverviewRenderer | null {
  if (search.length <= 1) return null;
  const value = new URLSearchParams(search).get(RENDERER_QUERY_KEY);
  if (value === "globe" || value === "legacy") return value;
  return null;
}

export function resolveOverviewRenderer(
  sources: RendererPreferenceSources,
  enabled: boolean,
): OverviewRenderer {
  if (!enabled) return "legacy";
  if (sources.hash === LEGACY_RENDERER_HASH) return "legacy";
  if (sources.hash === GLOBE_RENDERER_HASH) return "globe";
  const query = queryPreference(sources.search);
  if (query !== null) return query;
  return storedPreference(sources.stored) ?? "globe";
}

export function readStoredRenderer(
  storage: Pick<Storage, "getItem"> | null = typeof localStorage === "undefined"
    ? null
    : localStorage,
): string | null {
  try {
    return storage?.getItem(RENDERER_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

declare const __GLOBE_ADAPTER__: boolean;

export const GLOBE_ADAPTER_ENABLED =
  typeof __GLOBE_ADAPTER__ !== "undefined" && __GLOBE_ADAPTER__ === true;
