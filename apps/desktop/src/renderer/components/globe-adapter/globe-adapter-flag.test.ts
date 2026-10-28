import { describe, expect, it } from "vite-plus/test";

import {
  GLOBE_ADAPTER_ENABLED,
  GLOBE_ADAPTER_FAIL_HASH,
  GLOBE_ADAPTER_HASH,
  GLOBE_ADAPTER_MISSING_HASH,
  adapterFailureRequested,
  adapterLandMode,
  adapterRequested,
} from "./globe-adapter-flag.js";

describe("globe adapter flag", () => {
  it("is disabled unless the experimental build flag is set", () => {
    expect(GLOBE_ADAPTER_ENABLED).toBe(false);
  });

  it("requires an explicit adapter hash", () => {
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
