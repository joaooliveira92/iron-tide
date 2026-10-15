import { act, cleanup, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  DENSITY_STORAGE_KEY,
  DensityProvider,
  readStoredDensity,
  useDensity,
} from "./DensityContext.js";

describe("density", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["density"];
  });
  afterEach(cleanup);

  it("defaults to comfortable and reads only recognised stored values", () => {
    expect(readStoredDensity()).toBe("comfortable");
    localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
    expect(readStoredDensity()).toBe("compact");
    localStorage.setItem(DENSITY_STORAGE_KEY, "gigantic");
    expect(readStoredDensity()).toBe("comfortable");
  });

  it("sets the html attribute immediately, and updates it and storage when changed", () => {
    const { result } = renderHook(() => useDensity(), { wrapper: DensityProvider });
    expect(result.current.density).toBe("comfortable");
    expect(document.documentElement.dataset["density"]).toBe("comfortable");

    act(() => result.current.setDensity("compact"));
    expect(result.current.density).toBe("compact");
    expect(document.documentElement.dataset["density"]).toBe("compact");
    expect(localStorage.getItem(DENSITY_STORAGE_KEY)).toBe("compact");
  });

  it("restores the stored choice on the next start", () => {
    localStorage.setItem(DENSITY_STORAGE_KEY, "compact");
    function Probe() {
      return <span>{useDensity().density}</span>;
    }
    render(
      <DensityProvider>
        <Probe />
      </DensityProvider>,
    );
    expect(screen.getByText("compact")).toBeTruthy();
    expect(document.documentElement.dataset["density"]).toBe("compact");
  });

  it("refuses to be used outside its provider", () => {
    expect(() => renderHook(() => useDensity())).toThrow(/DensityProvider/);
  });
});
