import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  DEFAULT_SANS_FONT,
  FontProvider,
  SANS_FONT_STORAGE_KEY,
  isSansFontPreference,
  readStoredSansFont,
  useFont,
} from "./FontContext.js";

describe("font preference", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["font"];
  });
  afterEach(cleanup);

  it("defaults to Inter when nothing is stored", () => {
    expect(DEFAULT_SANS_FONT).toBe("inter");
    expect(readStoredSansFont()).toBe("inter");
  });

  it("validates only the supported values", () => {
    expect(isSansFontPreference("inter")).toBe(true);
    expect(isSansFontPreference("jakarta")).toBe(true);
    expect(isSansFontPreference("comic-sans")).toBe(false);
    expect(isSansFontPreference(null)).toBe(false);
    expect(isSansFontPreference(42)).toBe(false);
  });

  it("falls back to Inter for malformed or unsupported stored values", () => {
    localStorage.setItem(SANS_FONT_STORAGE_KEY, "papyrus");
    expect(readStoredSansFont()).toBe("inter");
    localStorage.setItem(SANS_FONT_STORAGE_KEY, "");
    expect(readStoredSansFont()).toBe("inter");
  });

  it("reads a valid Jakarta preference", () => {
    localStorage.setItem(SANS_FONT_STORAGE_KEY, "jakarta");
    expect(readStoredSansFont()).toBe("jakarta");
  });

  it("sets the html attribute immediately, and updates it and storage when changed", () => {
    const { result } = renderHook(() => useFont(), { wrapper: FontProvider });
    expect(result.current.font).toBe("inter");
    expect(document.documentElement.dataset["font"]).toBe("inter");

    act(() => result.current.setFont("jakarta"));
    expect(result.current.font).toBe("jakarta");
    expect(document.documentElement.dataset["font"]).toBe("jakarta");
    expect(localStorage.getItem(SANS_FONT_STORAGE_KEY)).toBe("jakarta");
  });

  it("restores the stored choice on the next start", () => {
    localStorage.setItem(SANS_FONT_STORAGE_KEY, "jakarta");
    function Probe() {
      return <span>{useFont().font}</span>;
    }
    render(
      <FontProvider>
        <Probe />
      </FontProvider>,
    );
    expect(screen.getByText("jakarta")).toBeTruthy();
    expect(document.documentElement.dataset["font"]).toBe("jakarta");
  });

  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useFont())).toThrow(/FontProvider/);
  });

  it("keeps the preference renderer-local (no Electron bridge calls)", () => {
    const execute = vi.fn();
    (window as unknown as { bluewave?: unknown }).bluewave = { campaign: { execute } };
    try {
      const { result } = renderHook(() => useFont(), { wrapper: FontProvider });
      act(() => result.current.setFont("jakarta"));
      expect(execute).not.toHaveBeenCalled();
      expect(localStorage.getItem(SANS_FONT_STORAGE_KEY)).toBe("jakarta");
    } finally {
      delete (window as unknown as { bluewave?: unknown }).bluewave;
    }
  });
});
