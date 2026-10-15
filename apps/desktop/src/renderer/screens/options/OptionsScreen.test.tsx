import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { BackgroundProvider } from "../../shell/BackgroundContext.js";
import { DensityProvider } from "../../shell/DensityContext.js";
import { FontProvider } from "../../shell/FontContext.js";
import { OptionsScreen } from "./OptionsScreen.js";

function renderOptions() {
  return render(
    <BackgroundProvider>
      <FontProvider>
        <DensityProvider>
          <OptionsScreen />
        </DensityProvider>
      </FontProvider>
    </BackgroundProvider>,
  );
}

describe("OptionsScreen display density", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["density"];
    delete document.documentElement.dataset["font"];
  });
  afterEach(cleanup);

  it("offers Comfortable and Compact, starting on Comfortable", () => {
    renderOptions();
    const group = screen.getByRole("group", { name: "Display density" });
    expect(group.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Comfortable" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("switches the whole app to compact and remembers it", () => {
    renderOptions();
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    expect(screen.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(document.documentElement.dataset["density"]).toBe("compact");
    expect(localStorage.getItem("bluewave-density")).toBe("compact");
  });

  it("no longer carries campaign file actions (they live in the header Campaign menu)", () => {
    renderOptions();
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Close Campaign/i })).toBeNull();
  });
});

describe("OptionsScreen application font", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["density"];
    delete document.documentElement.dataset["font"];
  });
  afterEach(cleanup);

  it("offers Inter and Plus Jakarta Sans, starting on Inter", () => {
    renderOptions();
    const group = screen.getByRole("group", { name: "Application font" });
    expect(group.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Inter" }).getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Plus Jakarta Sans" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("switches the whole app font and remembers it", () => {
    renderOptions();
    fireEvent.click(screen.getByRole("button", { name: "Plus Jakarta Sans" }));
    expect(
      screen.getByRole("button", { name: "Plus Jakarta Sans" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(document.documentElement.dataset["font"]).toBe("jakarta");
    expect(localStorage.getItem("bluewave-font")).toBe("jakarta");
  });
});
