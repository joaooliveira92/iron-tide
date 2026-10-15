import { describe, expect, it } from "vite-plus/test";
import { isDebugMode } from "./debug-mode.js";

describe("isDebugMode", () => {
  it("is enabled by a `true` flag", () => {
    expect(isDebugMode({ flag: "true" })).toBe(true);
  });

  it("is disabled when no flag is present", () => {
    expect(isDebugMode({ flag: undefined })).toBe(false);
  });

  it("is disabled for flag values other than exactly `true`", () => {
    expect(isDebugMode({ flag: "1" })).toBe(false);
    expect(isDebugMode({ flag: "TRUE" })).toBe(false);
    expect(isDebugMode({ flag: "" })).toBe(false);
  });
});
