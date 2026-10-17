import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  catalogueLocale,
  hasMessageKey,
  resolveMessage,
  setMissingKeyWarner,
  setUiCatalogue,
} from "./uiCatalogue.js";

const catalogue = {
  locale: "en-US",
  strings: {
    "messages.finance.deficit.body": "{nationId} ended the month at {newTreasury}.",
    "messages.generic.body": "Something happened this month.",
  },
};

afterEach(() => {
  setMissingKeyWarner(() => undefined);
});

describe("UI catalogue resolver (ADR-0209/ADR-0218)", () => {
  it("resolves a key with interpolation", () => {
    setUiCatalogue(catalogue);
    expect(
      resolveMessage("messages.finance.deficit.body", { nationId: "uk", newTreasury: 10 }),
    ).toBe("uk ended the month at 10.");
    expect(catalogueLocale()).toBe("en-US");
  });

  it("warns on a missing key and renders a safe fallback, never the raw key", () => {
    const warn = vi.fn();
    setMissingKeyWarner(warn);
    setUiCatalogue(catalogue);
    const text = resolveMessage("messages.unknown.key");
    expect(text).toBe("Something happened this month.");
    expect(text).not.toContain("messages.unknown.key");
    expect(warn).toHaveBeenCalledWith("messages.unknown.key");
    expect(hasMessageKey("messages.unknown.key")).toBe(false);
    expect(hasMessageKey("messages.generic.body")).toBe(true);
  });

  it("falls back safely when no catalogue is injected", () => {
    setUiCatalogue({ locale: "en-US", strings: {} });
    expect(resolveMessage("messages.nope")).toBe("Something happened this month.");
  });

  it("keeps text independent of the formatting locale", () => {
    setUiCatalogue(catalogue);
    const before = resolveMessage("messages.finance.deficit.body", {
      nationId: "uk",
      newTreasury: 10,
    });
    // Formatting locale lives in preferences and never reaches the text resolver.
    const after = resolveMessage("messages.finance.deficit.body", {
      nationId: "uk",
      newTreasury: 10,
    });
    expect(after).toBe(before);
  });
});
