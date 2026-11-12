/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_APP_PREFERENCES,
  TEXT_SCALE_MAX,
  TEXT_SCALE_MIN,
  type AppPreferences,
} from "../../../shared/preferences-contract.js";
import { BridgeProvider } from "../../lib/bridge-context.js";
import { PreferencesProvider } from "../../lib/preferences-context.js";
import {
  createPreferencesBridgeStub,
  type PreferencesBridgeStub,
} from "../../lib/preferences-test-bridge.js";
import { BackgroundProvider } from "../../shell/BackgroundContext.js";
import { DensityProvider } from "../../shell/DensityContext.js";
import { FontProvider } from "../../shell/FontContext.js";
import { ThemeProvider } from "../../shell/ThemeContext.js";
import { OptionsScreen } from "./OptionsScreen.js";

beforeEach(() => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

function renderOptions(stub: PreferencesBridgeStub) {
  return render(
    <BridgeProvider bridge={stub.bridge}>
      <PreferencesProvider>
        <ThemeProvider>
          <BackgroundProvider>
            <FontProvider>
              <DensityProvider>
                <OptionsScreen />
              </DensityProvider>
            </FontProvider>
          </BackgroundProvider>
        </ThemeProvider>
      </PreferencesProvider>
    </BridgeProvider>,
  );
}

function openDepartment(prefix: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: prefix }));
}

describe("OptionsScreen departments", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset["density"];
    delete document.documentElement.dataset["font"];
  });
  afterEach(cleanup);

  it("opens in a modal on General and swaps to one section at a time", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    expect(screen.getByRole("dialog", { name: /^Settings\s*\/\s*General$/ })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Display density" })).toBeNull();
    openDepartment(/^Appearance$/);
    expect(screen.getByRole("dialog", { name: /^Settings\s*\/\s*Appearance$/ })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Display density" })).toBeTruthy();
    openDepartment(/^Accessibility$/);
    expect(screen.getByRole("group", { name: "Motion" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Display density" })).toBeNull();
  });

  it("closes the modal and offers to reopen it", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
    expect(screen.getByRole("dialog", { name: /^Settings\s*\/\s*General$/ })).toBeTruthy();
  });

  it("offers Comfortable and Compact, starting on Comfortable", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Appearance$/);
    const group = screen.getByRole("group", { name: "Display density" });
    expect(group.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Comfortable" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("switches the whole app to compact and writes it to the domain, not localStorage", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Appearance$/);
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Compact" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    );
    expect(document.documentElement.dataset["density"]).toBe("compact");
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.interfaceDensity).toBe("compact");
    expect(localStorage.getItem("bluewave-density")).toBeNull();
  });

  it("offers Inter and Plus Jakarta Sans, starting on Inter", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Appearance$/);
    const group = screen.getByRole("group", { name: "Application font" });
    expect(group.querySelectorAll("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Inter" }).getAttribute("aria-pressed")).toBe("true");
    expect(
      screen.getByRole("button", { name: "Plus Jakarta Sans" }).getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("switches the whole app font and writes it to the domain, not localStorage", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Appearance$/);
    fireEvent.click(screen.getByRole("button", { name: "Plus Jakarta Sans" }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Plus Jakarta Sans" }).getAttribute("aria-pressed"),
      ).toBe("true"),
    );
    expect(document.documentElement.dataset["font"]).toBe("jakarta");
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.font).toBe("jakarta");
    expect(localStorage.getItem("bluewave-font")).toBeNull();
  });

  it("offers the high-contrast theme and writes it to the domain", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Appearance$/);
    fireEvent.click(screen.getByRole("button", { name: "High contrast" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.theme).toBe("highContrast");
  });

  it("changes text scale and clamps within range", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Appearance$/);
    fireEvent.click(screen.getByRole("button", { name: "Increase text size" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.textScale).toBe(105);
  });

  it("resets only the open department to its defaults", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Appearance$/);
    fireEvent.click(screen.getByRole("button", { name: "Increase text size" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: "Reset appearance to defaults" }));
    await waitFor(() => expect(stub.writes).toHaveLength(2));
    expect(stub.writes[1]?.app.textScale).toBe(100);
    expect(stub.writes[1]?.app.theme).toBe("system");
  });

  it("opens Currency and Numbers for the currency display setting", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Currency/);
    fireEvent.click(screen.getByRole("button", { name: "National Historical" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toContain("Available once a campaign is open"),
    );
    expect(stub.writes[0]?.app.currencyDisplayMode).toBe("nationalHistorical");
  });

  it("opens Measurements and writes a per-category selection", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Measurements/);
    fireEvent.change(screen.getByRole("combobox", { name: "Calibre" }), {
      target: { value: "millimetres" },
    });
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.measurementSelections["calibre"]).toBe("millimetres");
  });

  it("resets all preferences to the central defaults from General", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Appearance$/);
    fireEvent.click(screen.getByRole("button", { name: "High contrast" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    openDepartment(/^General$/);
    fireEvent.click(screen.getByRole("button", { name: "Reset all to defaults" }));
    await waitFor(() => expect(stub.writes).toHaveLength(2));
    expect(stub.writes[1]?.app.theme).toBe("system");
  });

  it("takes the Contrast row to the theme choices under Appearance", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Accessibility$/);
    fireEvent.click(screen.getByRole("button", { name: "Go to Appearance" }));
    expect(screen.getByRole("dialog", { name: /^Settings\s*\/\s*Appearance$/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: "High contrast" })).toBeTruthy();
  });

  it("no longer carries campaign file actions (they live in the header Campaign menu)", async () => {
    const stub = createPreferencesBridgeStub();
    renderOptions(stub);
    await waitFor(() => expect(stub.readCalls()).toBe(1));
    openDepartment(/^Appearance$/);
    expect(screen.queryByRole("button", { name: /^Save/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Close Campaign/i })).toBeNull();
  });
});

const CUSTOMISED: AppPreferences = {
  ...DEFAULT_APP_PREFERENCES,
  theme: "dark",
  textScale: 110,
  measurementPreset: "metric",
  measurementSelections: { calibre: "millimetres" },
  currencyDisplayMode: "budgetPoints",
  numberScale: "abbreviated",
  reducedMotion: "reduce",
  tooltipDetail: "detailed",
};

async function renderCustomised(initial: AppPreferences = CUSTOMISED) {
  const stub = createPreferencesBridgeStub(initial);
  renderOptions(stub);
  await waitFor(() => expect(stub.readCalls()).toBe(1));
  return stub;
}

describe("OptionsScreen department controls", () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(cleanup);

  it("lists the storage rows on General", async () => {
    await renderCustomised();
    expect(screen.getByText("Storage")).toBeTruthy();
    expect(screen.getByText("Profile settings")).toBeTruthy();
    expect(screen.getByText("Campaign preferences")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reset all to defaults" })).toBeTruthy();
  });

  it("shows the current text scale and steps it down", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Appearance$/);
    expect(screen.getByText("110%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Decrease text size" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.textScale).toBe(105);
  });

  it("disables text size steps at the bounds", async () => {
    await renderCustomised({ ...CUSTOMISED, textScale: TEXT_SCALE_MIN });
    openDepartment(/^Appearance$/);
    expect(
      (screen.getByRole("button", { name: "Decrease text size" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Increase text size" }) as HTMLButtonElement).disabled,
    ).toBe(false);
    cleanup();
    await renderCustomised({ ...CUSTOMISED, textScale: TEXT_SCALE_MAX });
    openDepartment(/^Appearance$/);
    expect(
      (screen.getByRole("button", { name: "Increase text size" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("writes the background choice", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Appearance$/);
    expect(screen.getByRole("group", { name: "Background" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Starfield" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.background).toBe("stars");
  });

  it("writes the measurement preset and lists a unit select per category", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Measurements/);
    expect(screen.getByRole("button", { name: "Metric" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(1);
    expect((screen.getByRole("combobox", { name: "Calibre" }) as HTMLSelectElement).value).toBe(
      "millimetres",
    );
    fireEvent.click(screen.getByRole("button", { name: "Imperial" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.measurementPreset).toBe("imperial");
  });

  it("keeps earlier unit selections when another category changes", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Measurements/);
    const other = screen
      .getAllByRole("combobox")
      .find((select) => select.getAttribute("aria-label") !== "Calibre") as HTMLSelectElement;
    const next = Array.from(other.options).find((option) => option.value !== other.value);
    expect(next).toBeDefined();
    fireEvent.change(other, { target: { value: next?.value } });
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.measurementSelections["calibre"]).toBe("millimetres");
    expect(Object.keys(stub.writes[0]?.app.measurementSelections ?? {})).toHaveLength(2);
  });

  it("writes the number style and explains the unavailable national currency", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Currency/);
    expect(screen.getByRole("button", { name: "Budget Points" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("status").textContent).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Full" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.numberScale).toBe("full");
  });

  it("writes language and formatting locale", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Language/);
    expect(screen.getByRole("group", { name: "Language" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.language).toBe("en");
    fireEvent.click(screen.getByRole("button", { name: "English (United States)" }));
    await waitFor(() => expect(stub.writes).toHaveLength(2));
    expect(stub.writes[1]?.app.formattingLocale).toBe("en-US");
  });

  it("writes reduced motion and tooltip detail", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Accessibility$/);
    expect(screen.getByRole("button", { name: "Reduce motion" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "No preference" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app.reducedMotion).toBe("noPreference");
    fireEvent.click(screen.getByRole("button", { name: "Minimal" }));
    await waitFor(() => expect(stub.writes).toHaveLength(2));
    expect(stub.writes[1]?.app.tooltipDetail).toBe("minimal");
  });

  it("resets only measurements", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Measurements/);
    fireEvent.click(screen.getByRole("button", { name: "Reset measurements to defaults" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    const app = stub.writes[0]?.app;
    expect(app?.measurementPreset).toBe("imperial");
    expect(app?.measurementSelections).toEqual({});
    expect(app?.theme).toBe("dark");
    expect(app?.numberScale).toBe("abbreviated");
  });

  it("resets only currency and numbers", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Currency/);
    fireEvent.click(screen.getByRole("button", { name: "Reset currency and numbers to defaults" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    const app = stub.writes[0]?.app;
    expect(app?.currencyDisplayMode).toBe("navalCredits");
    expect(app?.numberScale).toBe("full");
    expect(app?.measurementPreset).toBe("metric");
    expect(app?.theme).toBe("dark");
  });

  it("resets only language and region", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Language/);
    fireEvent.click(screen.getByRole("button", { name: "Reset language and region to defaults" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    const app = stub.writes[0]?.app;
    expect(app?.language).toBe("en");
    expect(app?.formattingLocale).toBe("en-US");
    expect(app?.theme).toBe("dark");
    expect(app?.tooltipDetail).toBe("detailed");
  });

  it("resets only accessibility", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Accessibility$/);
    fireEvent.click(screen.getByRole("button", { name: "Reset accessibility to defaults" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    const app = stub.writes[0]?.app;
    expect(app?.reducedMotion).toBe("system");
    expect(app?.tooltipDetail).toBe("standard");
    expect(app?.theme).toBe("dark");
    expect(app?.textScale).toBe(110);
  });

  it("resets appearance without touching other departments", async () => {
    const stub = await renderCustomised();
    openDepartment(/^Appearance$/);
    fireEvent.click(screen.getByRole("button", { name: "Reset appearance to defaults" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    const app = stub.writes[0]?.app;
    expect(app?.theme).toBe("system");
    expect(app?.textScale).toBe(100);
    expect(app?.reducedMotion).toBe("reduce");
    expect(app?.measurementPreset).toBe("metric");
  });

  it("resets everything from General", async () => {
    const stub = await renderCustomised();
    fireEvent.click(screen.getByRole("button", { name: "Reset all to defaults" }));
    await waitFor(() => expect(stub.writes).toHaveLength(1));
    expect(stub.writes[0]?.app).toEqual(DEFAULT_APP_PREFERENCES);
  });
});
