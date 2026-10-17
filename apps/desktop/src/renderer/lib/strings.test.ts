import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { setMissingKeyWarner, translate } from "./strings.js";

afterEach(() => {
  setMissingKeyWarner(() => undefined);
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("string catalogue (U-4 ticket 06)", () => {
  it("resolves an English key", () => {
    expect(translate("settings.title", "en")).toBe("Options");
  });

  it("falls back to the complete en-US catalogue", () => {
    expect(translate("settings.section.appearance", "en")).toBe("Appearance");
  });

  it("never returns a raw key when a key is absent", () => {
    expect(translate("settings.does.not.exist", "en")).toBe("");
  });
});

describe("settings catalogue missing-key warning (U-5 ticket 03)", () => {
  it("warns in development for a total miss and returns the fallback, never the raw key", () => {
    const warn = vi.fn();
    setMissingKeyWarner(warn);
    const text = translate("settings.does.not.exist", "en");
    expect(text).toBe("");
    expect(text).not.toContain("settings.does.not.exist");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("settings.does.not.exist");
  });

  it("does not warn when the key resolves from a catalogue", () => {
    const warn = vi.fn();
    setMissingKeyWarner(warn);
    expect(translate("settings.title", "en")).toBe("Options");
    expect(warn).not.toHaveBeenCalled();
  });

  it("never fires the default warner in production (DEV false), still returning the fallback", () => {
    vi.stubEnv("DEV", false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    // No override: exercise the module's own dev-only warner.
    setMissingKeyWarner();
    expect(translate("settings.does.not.exist", "en")).toBe("");
    expect(warn).not.toHaveBeenCalled();
  });

  it("fires the default warner in development (DEV true)", () => {
    vi.stubEnv("DEV", true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setMissingKeyWarner();
    expect(translate("settings.does.not.exist", "en")).toBe("");
    expect(warn).toHaveBeenCalledWith("[strings] missing message key: settings.does.not.exist");
  });
});
