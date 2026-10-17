import { describe, expect, it } from "vite-plus/test";

import { translate } from "./strings.js";

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
