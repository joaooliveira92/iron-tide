/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { WindowState } from "../../shared/bridge-contract.js";
import { SidebarProvider } from "../components/ui/sidebar.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../lib/preferences-test-bridge.js";
import { SiteHeader, type SiteHeaderProps } from "./SiteHeader.js";
import type { HeaderCampaign } from "./site-header-state.js";
import { ThemeProvider } from "./ThemeContext.js";
import type { WindowContextValue } from "./WindowContext.js";
import { WindowContextProvider } from "./WindowContext.js";

const campaign: HeaderCampaign = {
  month: { year: 1900, month: 1 },
  treasury: 24_500_000,
  nationName: "United Kingdom",
  projectedSurplusDeficit: 1_500_000,
  activeAlertsCount: null,
  atWar: false,
};

const matchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

function windowContext(platform: NodeJS.Platform): WindowContextValue {
  const windowState: WindowState = {
    platform,
    isMaximized: false,
    maximizable: true,
    minimizable: true,
  };
  return {
    platform,
    windowState,
    titlebar: { title: "Bluewave" },
    windowMinimize: vi.fn(),
    windowMaximizeToggle: vi.fn(),
    windowClose: vi.fn(),
  };
}

describe("SiteHeader", () => {
  let windowCtx: WindowContextValue;

  beforeEach(() => {
    window.matchMedia = matchMedia;
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  async function renderHeader(platform: NodeJS.Platform = "linux", props: SiteHeaderProps = {}) {
    windowCtx = windowContext(platform);
    const stub = createPreferencesBridgeStub();
    const result = render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <SidebarProvider>
            <WindowContextProvider value={windowCtx}>
              <ThemeProvider>
                <SiteHeader {...props} />
              </ThemeProvider>
            </WindowContextProvider>
          </SidebarProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    // Flush the provider's async read so its state update lands inside `act`.
    await act(async () => {});
    return result;
  }

  it("renders the nav and title slots", async () => {
    await renderHeader();

    expect(screen.getByRole("button", { name: "Go back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Go forward" })).toBeTruthy();
    expect(screen.getByText("Naval Ministry")).toBeTruthy();
  });

  it("renders the status secondary row on the menu view", async () => {
    await renderHeader();

    expect(screen.getByText("Active database (SQLite)")).toBeTruthy();
    expect(screen.getByText("Ready for operation")).toBeTruthy();
  });

  it("disables back and forward navigation when the history cannot move", async () => {
    await renderHeader("linux", {
      back: { disabled: false, onTrigger: vi.fn() },
      forward: { disabled: true, onTrigger: vi.fn() },
    });

    expect(
      screen.getByRole("button", { name: "Go back" }).attributes.getNamedItem("disabled"),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "Go forward" }).attributes.getNamedItem("disabled"),
    ).not.toBeNull();
  });

  it("renders the custom window controls only on platforms without native controls", async () => {
    await renderHeader("win32");

    expect(screen.getByRole("button", { name: "minimize" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "maximize" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "close" })).toBeTruthy();
  });

  it("omits the custom window controls on macOS", async () => {
    await renderHeader("darwin");

    expect(screen.queryByRole("button", { name: "minimize" })).toBeNull();
    expect(screen.queryByRole("button", { name: "maximize" })).toBeNull();
    expect(screen.queryByRole("button", { name: "close" })).toBeNull();
  });

  it("dispatches window actions through the window-control part", async () => {
    await renderHeader("linux");

    fireEvent.click(screen.getByRole("button", { name: "minimize" }));
    fireEvent.click(screen.getByRole("button", { name: "maximize" }));
    fireEvent.click(screen.getByRole("button", { name: "close" }));

    expect(windowCtx.windowMinimize).toHaveBeenCalledOnce();
    expect(windowCtx.windowMaximizeToggle).toHaveBeenCalledOnce();
    expect(windowCtx.windowClose).toHaveBeenCalledOnce();
  });

  it("exposes the search slot only when there are search targets", async () => {
    const searchTargets = [{ id: "overview", label: "Overview" }];

    await renderHeader("linux", { searchTargets });

    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });

  it("renders the continue action with its enabled state", async () => {
    const onContinue = vi.fn();

    await renderHeader("linux", {
      continueAction: {
        label: "Advance turn",
        disabled: false,
        onTrigger: onContinue,
      },
    });

    const continueButton = screen.getByRole("button", { name: "Advance turn" });
    expect(continueButton.attributes.getNamedItem("disabled")).toBeNull();

    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("cycles the theme through the chrome slot", async () => {
    await renderHeader("linux");

    const themeToggle = screen.getByRole("button", { name: /Theme:/ });
    expect(themeToggle.getAttribute("aria-label")).toContain("system");

    fireEvent.click(themeToggle);

    await waitFor(() => expect(themeToggle.getAttribute("aria-label")).toContain("light"));
  });

  it("renders the editor secondary row with its actions", async () => {
    const onActionClick = vi.fn();

    await renderHeader("linux", { activeView: "editor", onActionClick });

    fireEvent.click(screen.getByRole("button", { name: "Validate parameters" }));
    expect(onActionClick).toHaveBeenCalledWith("validate");
  });

  it("renders the campaign secondary row from the campaign projection", async () => {
    await renderHeader("linux", { activeView: "playing", campaign });

    expect(screen.getByText("Armed peace")).toBeTruthy();
    expect(screen.getByText(/£24,500k/)).toBeTruthy();
  });

  it("renders the INC-1 header fields: nation name and projected balance", async () => {
    await renderHeader("linux", { activeView: "playing", campaign });

    expect(screen.getByText("Nation:")).toBeTruthy();
    expect(screen.getByText(/United Kingdom/)).toBeTruthy();
    expect(screen.getByText("Projected balance:")).toBeTruthy();
    expect(screen.getByText(/£1,500k/)).toBeTruthy();
  });

  it("omits the alert-count slot until the INC-2 projection lands", async () => {
    await renderHeader("linux", { activeView: "playing", campaign });

    // The forward-wired slot is null: it is not shown at all (no "Alerts: —"
    // placeholder, and certainly no fabricated count).
    expect(screen.queryByText("Alerts:")).toBeNull();
    expect(screen.queryByText(/^[0-9]+$/)).toBeNull();
  });

  it("renders the alert count once the forward-wired slot is populated", async () => {
    await renderHeader("linux", {
      activeView: "playing",
      campaign: { ...campaign, activeAlertsCount: 4 },
    });

    expect(screen.getByText("Alerts:")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
  });

  it("renders the advance-month button on the right for an active campaign", async () => {
    const onAdvanceMonth = vi.fn();
    await renderHeader("linux", { activeView: "playing", campaign, onAdvanceMonth });

    const advance = screen.getByRole("button", { name: "Advance month" });
    expect(advance.attributes.getNamedItem("disabled")).toBeNull();

    fireEvent.click(advance);
    expect(onAdvanceMonth).toHaveBeenCalledOnce();
  });

  it("disables the advance-month button while a commit is running", async () => {
    await renderHeader("linux", {
      activeView: "playing",
      campaign,
      onAdvanceMonth: vi.fn(),
      advancingMonth: true,
    });

    expect(screen.getByText("Advancing…")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Advance month" }).attributes.getNamedItem("disabled"),
    ).not.toBeNull();
  });

  it("omits the advance-month button without an active campaign", async () => {
    await renderHeader("linux", { activeView: "playing", onAdvanceMonth: vi.fn() });
    expect(screen.queryByRole("button", { name: "Advance month" })).toBeNull();
  });

  it("renders the remaining adaptive secondary-row views", async () => {
    await renderHeader("linux", { activeView: "new_game" });
    expect(screen.getByText("Campaign setup assistant")).toBeTruthy();

    cleanup();
    await renderHeader("linux", { activeView: "options" });
    expect(screen.getByText("Preferences:")).toBeTruthy();
  });

  it("shows a wizard step's own heading and hint in place of the generic setup copy", async () => {
    await renderHeader("linux", {
      activeView: "new_game",
      wizardStep: {
        heading: "Rules of the Naval Age",
        hint: "Set the era, scale, and historical uncertainty for this campaign.",
      },
    });
    expect(screen.getByText("Rules of the Naval Age")).toBeTruthy();
    expect(
      screen.getByText("Set the era, scale, and historical uncertainty for this campaign."),
    ).toBeTruthy();
    expect(screen.queryByText("Campaign setup assistant")).toBeNull();
    expect(screen.queryByText("Select the historical scenario to continue")).toBeNull();
  });

  it("shows the Campaign menu only in a campaign with its handlers, beside the single Advance control", async () => {
    await renderHeader();
    expect(screen.queryByRole("button", { name: "Campaign menu" })).toBeNull();
    cleanup();
    await renderHeader("linux", {
      campaign,
      onAdvanceMonth: vi.fn(),
      campaignMenu: { saving: false, onSave: vi.fn(), onCopy: vi.fn(), onCloseCampaign: vi.fn() },
    });
    expect(screen.getByRole("button", { name: "Campaign menu" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Advance month" })).toHaveLength(1);
  });
});
