import { describe, expect, it } from "vite-plus/test";

import {
  GLOBE_ADAPTER_ENABLED,
  GLOBE_ADAPTER_FAIL_HASH,
  GLOBE_ADAPTER_HASH,
  GLOBE_ADAPTER_MISSING_HASH,
  GLOBE_RENDERER_HASH,
  LEGACY_RENDERER_HASH,
  adapterFailureRequested,
  adapterLandMode,
  adapterRequested,
  resolveOverviewRenderer,
} from "./globe-adapter-flag.js";

describe("globe adapter flag", () => {
  it("is disabled unless the globe adapter build flag is set", () => {
    expect(GLOBE_ADAPTER_ENABLED).toBe(false);
  });

  it("recognises the packaged adapter validation hashes", () => {
    expect(adapterRequested("")).toBe(false);
    expect(adapterRequested("#globe-spike")).toBe(false);
    expect(adapterRequested(GLOBE_ADAPTER_HASH)).toBe(true);
    expect(adapterRequested(GLOBE_ADAPTER_FAIL_HASH)).toBe(true);
    expect(adapterRequested(GLOBE_ADAPTER_MISSING_HASH)).toBe(true);
  });

  it("selects the packaged tile mode and forced failure independently", () => {
    expect(adapterLandMode(GLOBE_ADAPTER_HASH)).toBe("baked");
    expect(adapterLandMode(GLOBE_ADAPTER_MISSING_HASH)).toBe("missing");
    expect(adapterFailureRequested(GLOBE_ADAPTER_FAIL_HASH)).toBe(true);
    expect(adapterFailureRequested(GLOBE_ADAPTER_HASH)).toBe(false);
  });
});

describe("overview renderer preference", () => {
  const sources = (
    overrides: Partial<{ hash: string; search: string; stored: string | null }>,
  ) => ({
    hash: "",
    search: "",
    stored: null,
    ...overrides,
  });

  it("defaults to the globe renderer when the build supports it", () => {
    expect(resolveOverviewRenderer(sources({}), true)).toBe("globe");
  });

  it("uses the legacy renderer when the build has no globe adapter", () => {
    expect(resolveOverviewRenderer(sources({}), false)).toBe("legacy");
  });

  it("honours the documented legacy rollback flag in storage", () => {
    expect(resolveOverviewRenderer(sources({ stored: "legacy" }), true)).toBe("legacy");
    expect(resolveOverviewRenderer(sources({ stored: "globe" }), true)).toBe("globe");
    expect(resolveOverviewRenderer(sources({ stored: "nonsense" }), true)).toBe("globe");
  });

  it("honours the legacy rollback query parameter", () => {
    expect(resolveOverviewRenderer(sources({ search: "?renderer=legacy" }), true)).toBe("legacy");
    expect(resolveOverviewRenderer(sources({ search: "?renderer=globe" }), true)).toBe("globe");
  });

  it("lets the explicit hashes override stored and query preferences", () => {
    expect(
      resolveOverviewRenderer(sources({ hash: LEGACY_RENDERER_HASH, stored: "globe" }), true),
    ).toBe("legacy");
    expect(
      resolveOverviewRenderer(sources({ hash: GLOBE_RENDERER_HASH, stored: "legacy" }), true),
    ).toBe("globe");
  });

  it("cannot force the globe renderer in a build that omits it", () => {
    expect(resolveOverviewRenderer(sources({ hash: GLOBE_RENDERER_HASH }), false)).toBe("legacy");
  });
});
