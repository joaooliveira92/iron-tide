import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import { setUiCatalogue } from "../content/uiCatalogue.js";
import { setMissingKeyWarner, translate } from "./strings.js";

afterEach(() => {
  setMissingKeyWarner();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/**
 * `translate` is a compatibility alias for the one resolver (`content/uiCatalogue.ts`).
 * These tests pin the delegation: the compiled pack wins, the in-repo en-US
 * catalogue answers only what the pack does not author, and a total miss warns
 * once through the shared sink and renders a safe fallback.
 */
describe("string resolver alias (U-4 ticket 06)", () => {
  it("resolves an in-repo en-US key through the one resolver", () => {
    expect(translate("settings.title")).toBe("Options");
  });

  it("resolves a compiled-pack key ahead of the in-repo fallback", () => {
    setUiCatalogue({ locale: "en-US", strings: { "settings.title": "Preferences" } });
    expect(translate("settings.title")).toBe("Preferences");
  });

  it("never returns a raw key when a key is absent", () => {
    setUiCatalogue({ locale: "en-US", strings: {} });
    const text = translate("settings.does.not.exist");
    expect(text).toBe("Something happened this month.");
    expect(text).not.toContain("settings.does.not.exist");
  });
});

describe("single missing-key warning sink (U-5 ticket 03)", () => {
  it("warns for a total miss and returns the fallback, never the raw key", () => {
    const warn = vi.fn();
    setMissingKeyWarner(warn);
    setUiCatalogue({ locale: "en-US", strings: {} });
    const text = translate("settings.does.not.exist");
    expect(text).not.toContain("settings.does.not.exist");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("settings.does.not.exist");
  });

  it("does not warn when the key resolves from a catalogue", () => {
    const warn = vi.fn();
    setMissingKeyWarner(warn);
    setUiCatalogue({ locale: "en-US", strings: {} });
    expect(translate("settings.title")).toBe("Options");
    expect(warn).not.toHaveBeenCalled();
  });

  it("never fires the default warner in production (DEV false), still returning the fallback", () => {
    vi.stubEnv("DEV", false);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setMissingKeyWarner();
    setUiCatalogue({ locale: "en-US", strings: {} });
    expect(translate("settings.does.not.exist")).toBe("Something happened this month.");
    expect(warn).not.toHaveBeenCalled();
  });

  it("fires the default warner in development (DEV true)", () => {
    vi.stubEnv("DEV", true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    setMissingKeyWarner();
    setUiCatalogue({ locale: "en-US", strings: {} });
    translate("settings.does.not.exist");
    expect(warn).toHaveBeenCalledWith(
      "[messages] missing UI catalogue key: settings.does.not.exist",
    );
  });
});
