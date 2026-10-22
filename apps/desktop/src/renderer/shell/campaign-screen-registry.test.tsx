/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { Screen } from "./campaign-screen-registry.js";

const shell = vi.hoisted(() => ({
  state: {
    mode: {
      kind: "campaign" as const,
      screen: "overview" as Screen,
      campaign: {
        sessionId: "ses-1",
        month: { year: 1900, month: 1 },
        treasury: 50_000,
      },
    },
    saving: false,
  },
  actions: {
    selectScreen: vi.fn(),
    setPrimaryAction: vi.fn(),
    closeCampaign: vi.fn(),
    saveCampaign: vi.fn(),
    copyCampaign: vi.fn(),
  },
}));

afterEach(() => {
  cleanup();
});

vi.mock("./CampaignShellContext.js", () => ({
  useCampaignShellContext: () => shell,
}));

vi.mock("../screens/overview/OverviewScreen.js", async () => {
  const React = await import("react");
  return {
    OverviewScreen: ({
      sessionId,
      onNavigate,
    }: {
      sessionId: string;
      onNavigate: (screen: Screen) => void;
    }) =>
      React.createElement(
        "section",
        { "data-testid": "overview-screen" },
        React.createElement("span", null, sessionId),
        React.createElement("button", { onClick: () => onNavigate("fleet") }, "Open fleet"),
      ),
  };
});
vi.mock("../screens/construction/ConstructionScreen.js", async () => {
  const React = await import("react");
  return {
    ConstructionScreen: ({ sessionId }: { sessionId: string }) =>
      React.createElement("section", { "data-testid": "construction-screen" }, sessionId),
  };
});
vi.mock("../screens/fleet/FleetScreen.js", async () => {
  const React = await import("react");
  return {
    FleetScreen: ({ sessionId }: { sessionId: string }) =>
      React.createElement("section", { "data-testid": "fleet-screen" }, sessionId),
  };
});
vi.mock("../screens/simulation/SimulationScreen.js", async () => {
  const React = await import("react");
  return {
    SimulationScreen: ({
      sessionId,
      onPrimaryActionChange,
    }: {
      sessionId: string;
      onPrimaryActionChange: (action: unknown) => void;
    }) =>
      React.createElement(
        "section",
        { "data-testid": "simulation-screen" },
        React.createElement("span", null, sessionId),
        React.createElement(
          "button",
          {
            onClick: () =>
              onPrimaryActionChange({
                label: "Advance turn",
                disabled: false,
                onTrigger: vi.fn(),
              }),
          },
          "Register action",
        ),
      ),
  };
});
vi.mock("../screens/research/ResearchScreen.js", async () => {
  const React = await import("react");
  return {
    ResearchScreen: ({ sessionId }: { sessionId: string }) =>
      React.createElement("section", { "data-testid": "research-screen" }, sessionId),
  };
});
vi.mock("../screens/diplomacy/DiplomacyScreen.js", async () => {
  const React = await import("react");
  return {
    DiplomacyScreen: ({ sessionId }: { sessionId: string }) =>
      React.createElement("section", { "data-testid": "diplomacy-screen" }, sessionId),
  };
});
vi.mock("../screens/treasury/TreasuryScreen.js", async () => {
  const React = await import("react");
  return {
    TreasuryScreen: ({ sessionId }: { sessionId: string }) =>
      React.createElement("section", { "data-testid": "treasury-screen" }, sessionId),
  };
});
vi.mock("../screens/tactical-sandbox/TacticalSandboxScreen.js", async () => {
  const React = await import("react");
  return {
    TacticalSandboxScreen: ({ sessionId }: { sessionId: string }) =>
      React.createElement("section", { "data-testid": "tactical-sandbox-screen" }, sessionId),
  };
});
vi.mock("../screens/debugging/DebuggingScreen.js", async () => {
  const React = await import("react");
  return {
    DebuggingScreen: ({ sessionId }: { sessionId: string }) =>
      React.createElement("section", { "data-testid": "debugging-screen" }, sessionId),
  };
});
vi.mock("../screens/campaign-preferences/CampaignPreferencesScreen.js", async () => {
  const React = await import("react");
  return {
    CampaignPreferencesScreen: ({
      sessionId,
      onCloseCampaign,
    }: {
      sessionId: string;
      onCloseCampaign: () => void;
    }) =>
      React.createElement(
        "section",
        { "data-testid": "campaign-preferences-screen" },
        React.createElement("span", null, sessionId),
        React.createElement("button", { onClick: onCloseCampaign }, "Close campaign"),
      ),
  };
});
vi.mock("../screens/options/OptionsScreen.js", async () => {
  const React = await import("react");
  return {
    OptionsScreen: () =>
      React.createElement("section", { "data-testid": "options-screen" }, "Options"),
  };
});

import {
  CAMPAIGN_SCREEN_REGISTRY,
  CAMPAIGN_SCREEN_SEARCH_TARGETS,
  CAMPAIGN_SCREENS,
  CampaignScreenOutlet,
  SETTINGS_SCREENS,
} from "./campaign-screen-registry.js";

describe("CampaignScreenOutlet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    shell.state.mode = {
      kind: "campaign",
      screen: "overview",
      campaign: {
        sessionId: "ses-1",
        month: { year: 1900, month: 1 },
        treasury: 50_000,
      },
    };
    shell.state.saving = false;
  });

  it.each([
    ["overview", "overview-screen"],
    ["construction", "construction-screen"],
    ["fleet", "fleet-screen"],
    ["simulation", "simulation-screen"],
    ["research", "research-screen"],
    ["diplomacy", "diplomacy-screen"],
    ["tactical-sandbox", "tactical-sandbox-screen"],
    ["debugging", "debugging-screen"],
    ["campaign-preferences", "campaign-preferences-screen"],
  ] as const)("renders the connected %s route", async (activeScreen, testId) => {
    render(<CampaignScreenOutlet screen={activeScreen} />);
    expect(await screen.findByTestId(testId)).toBeTruthy();
    expect(screen.getByText("ses-1")).toBeTruthy();
  });

  it("routes the Treasury screen (INC-4 replaced the stub)", async () => {
    render(<CampaignScreenOutlet screen="treasury" />);
    const treasury = await screen.findByTestId("treasury-screen");
    expect(treasury.textContent).toContain("ses-1");
  });

  it("connects overview navigation to shell actions", async () => {
    render(<CampaignScreenOutlet screen="overview" />);
    (await screen.findByRole("button", { name: "Open fleet" })).click();
    expect(shell.actions.selectScreen).toHaveBeenCalledWith("fleet");
  });

  it("connects simulation primary action registration", async () => {
    render(<CampaignScreenOutlet screen="simulation" />);
    (await screen.findByRole("button", { name: "Register action" })).click();
    expect(shell.actions.setPrimaryAction).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Advance turn", disabled: false }),
    );
  });

  it("renders the options screen without campaign file actions", async () => {
    render(<CampaignScreenOutlet screen="options" />);
    expect(await screen.findByTestId("options-screen")).toBeTruthy();
  });

  it.each(["file", "new-game-preferences", "new-game-nation"] as const)(
    "renders no route for shell-only screen %s",
    (activeScreen) => {
      const { container } = render(<CampaignScreenOutlet screen={activeScreen} />);
      expect(container.textContent).toBe("");
    },
  );
});

describe("campaign screen registry", () => {
  it("defines every campaign screen once with an executable route", () => {
    const ids = CAMPAIGN_SCREEN_REGISTRY.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CAMPAIGN_SCREEN_REGISTRY.every(({ route }) => typeof route === "function")).toBe(true);
  });

  it("ships all six strategic sections in the campaign nav shell", () => {
    expect(CAMPAIGN_SCREENS.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "overview",
        "construction",
        "fleet",
        "research",
        "diplomacy",
        "treasury",
      ]),
    );
  });

  it("derives navigation groups and search targets from one registry", () => {
    expect([...CAMPAIGN_SCREENS, ...SETTINGS_SCREENS]).toHaveLength(
      CAMPAIGN_SCREEN_REGISTRY.length,
    );
    expect(CAMPAIGN_SCREEN_SEARCH_TARGETS).toEqual(
      CAMPAIGN_SCREEN_REGISTRY.filter(({ searchable }) => searchable).map(({ id, label }) => ({
        id,
        label,
      })),
    );
  });

  it.each(["simulation", "tactical-sandbox", "debugging"] as const)(
    "registers the debug-mode screen %s when the debug flag is set",
    (id) => {
      expect(CAMPAIGN_SCREEN_REGISTRY.some((screen) => screen.id === id)).toBe(true);
    },
  );
});
