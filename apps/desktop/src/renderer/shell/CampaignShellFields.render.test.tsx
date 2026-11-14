/* @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { CampaignShellProvider } from "./CampaignShellContext.js";
import { CampaignScreenOutlet } from "./campaign-screen-registry.js";
import { CampaignUnavailableView } from "./CampaignUnavailableView.js";
import { MapSheet } from "./MapSheet.js";
import { App } from "./App.js";
import type { Screen } from "./campaign-screen-registry.js";
import type { CampaignShellMode } from "./campaign-shell-state.js";

const probe = vi.hoisted(() => {
  const counts = {
    background: 0,
    header: 0,
    frame: 0,
    outlet: 0,
    unavailable: 0,
    loading: 0,
    review: 0,
    treasury: 0,
    simulation: 0,
    mapController: 0,
    newGameFlow: 0,
  };
  let snapshot: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  return {
    counts,
    get: () => snapshot,
    set(next: Record<string, unknown>) {
      snapshot = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
});

vi.mock("./useCampaignShell.js", async () => {
  const React = await import("react");
  return { useCampaignShell: () => React.useSyncExternalStore(probe.subscribe, probe.get) };
});

vi.mock("./debug-flag.js", () => ({ DEBUG_MODE: true }));

vi.mock("../screens/treasury/TreasuryScreen.js", async () => {
  const React = await import("react");
  return {
    TreasuryScreen: () => {
      probe.counts.treasury += 1;
      return React.createElement("span", { "data-testid": "treasury" });
    },
  };
});

vi.mock("../screens/simulation/SimulationScreen.js", async () => {
  const React = await import("react");
  return {
    SimulationScreen: () => {
      probe.counts.simulation += 1;
      return React.createElement("span", { "data-testid": "simulation" });
    },
  };
});

vi.mock("../components/world-map/useWorldMapController.js", () => ({
  useWorldMapController: () => {
    probe.counts.mapController += 1;
    return {};
  },
}));

vi.mock("./useNewGameFlow.js", () => ({
  useNewGameFlow: () => {
    probe.counts.newGameFlow += 1;
    return { actions: { start: () => undefined }, state: {} };
  },
}));

vi.mock("../screens/campaign-file/CampaignFileScreen.js", () => ({
  CampaignFileScreen: () => null,
}));

vi.mock("./BackgroundLayer.js", () => ({
  BackgroundLayer: () => {
    probe.counts.background += 1;
    return null;
  },
}));

vi.mock("./SiteHeader.js", () => ({
  SiteHeader: () => {
    probe.counts.header += 1;
    return null;
  },
}));

vi.mock("./AppFrame.js", async () => {
  const React = await import("react");
  return {
    AppFrame: ({ header, children }: { header: React.ReactNode; children: React.ReactNode }) => {
      probe.counts.frame += 1;
      return React.createElement(React.Fragment, null, header, children);
    },
  };
});

vi.mock("../components/MonthlyResolutionLoading.js", () => ({
  MonthlyResolutionLoading: () => {
    probe.counts.loading += 1;
    return null;
  },
  MonthlyResolutionFailure: () => null,
}));

vi.mock("../components/PreTurnReviewDialog.js", () => ({
  PreTurnReviewDialog: () => {
    probe.counts.review += 1;
    return null;
  },
}));

vi.mock("./interruptions/CampaignInterruptions.js", () => ({ CampaignInterruptions: () => null }));
vi.mock("./useGuidedInspection.js", () => ({
  useGuidedInspection: () => ({ visible: false, loading: false }),
}));
vi.mock("./ThemeContext.js", () => ({ useTheme: () => ({ resolvedTheme: "light" }) }));
vi.mock("./BackgroundContext.js", () => ({ useBackground: () => ({ background: "none" }) }));
vi.mock("./WindowContext.js", async () => {
  const React = await import("react");
  return {
    WindowContextProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
vi.mock("../content/PresentationContentGate.js", async () => {
  const React = await import("react");
  return {
    PresentationContentGate: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});
vi.mock("../content/UiCatalogueGate.js", async () => {
  const React = await import("react");
  return {
    UiCatalogueGate: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

const CAMPAIGN = {
  prestige: { current: 20, sackingThreshold: 16, dismissalRisk: false },
  month: { year: 1900, month: 3 },
  treasury: 100,
  revision: 4,
  sessionId: "s1",
  nationName: "United Kingdom",
  playerNationId: "uk",
  projectedSurplusDeficit: 0,
  atWar: false,
  activeAlertsCount: null,
};

const CAMPAIGN_MODE: CampaignShellMode = {
  kind: "campaign",
  screen: "treasury",
  campaign: CAMPAIGN,
};

const FILE_MODE: CampaignShellMode = { kind: "file", screen: "file" };

function shellWith(mode: CampaignShellMode, screen: Screen): Record<string, unknown> {
  return {
    campaign: mode.kind === "campaign" ? CAMPAIGN : null,
    loading: false,
    error: null,
    saving: false,
    saveMessage: null,
    primaryAction: null,
    committing: false,
    interruption: null,
    commitFailure: null,
    revisionProjectId: null,
    reads: null,
    mode,
    screen,
    canGoBack: false,
    canGoForward: false,
    openCampaign: vi.fn(),
    closeCampaign: vi.fn(),
    saveCampaign: vi.fn(),
    copyCampaign: vi.fn(),
    advanceMonth: vi.fn(),
    answerInterruption: vi.fn(),
    abandonPendingTurn: vi.fn(),
    refreshCampaign: vi.fn(),
    selectScreen: vi.fn(),
    reviseProject: vi.fn(),
    clearRevision: vi.fn(),
    setLeaveGuard: vi.fn(),
    setPrimaryAction: vi.fn(),
    goBack: vi.fn(),
    goForward: vi.fn(),
  };
}

function patch(fields: Record<string, unknown>): void {
  act(() => probe.set({ ...probe.get(), ...fields }));
}

function resetCounts(): void {
  for (const key of Object.keys(probe.counts) as (keyof typeof probe.counts)[]) {
    probe.counts[key] = 0;
  }
}

async function mounted(key: "treasury" | "simulation"): Promise<void> {
  await screen.findByTestId(key);
}

beforeEach(() => {
  resetCounts();
  probe.set(shellWith(CAMPAIGN_MODE, "treasury"));
});

afterEach(() => {
  cleanup();
});

describe("shell call sites subscribe to the fields they read", () => {
  it("keeps the screen outlet and its route screen out of unrelated field changes", async () => {
    render(
      <CampaignShellProvider bridge={undefined}>
        <CampaignScreenOutlet screen="treasury" />
      </CampaignShellProvider>,
    );
    await mounted("treasury");
    const before = probe.counts.treasury;

    patch({ saveMessage: "Saved" });
    patch({ saving: true });
    patch({ committing: true });

    expect(probe.counts.treasury).toBe(before);
  });

  it("keeps the simulation route screen out of unrelated field changes", async () => {
    render(
      <CampaignShellProvider bridge={undefined}>
        <CampaignScreenOutlet screen="simulation" />
      </CampaignShellProvider>,
    );
    await mounted("simulation");
    const before = probe.counts.simulation;

    patch({ saveMessage: "Saved" });
    patch({ screen: "simulation" });

    expect(probe.counts.simulation).toBe(before);
  });

  it("keeps the map sheet out of unrelated field changes", () => {
    render(
      <CampaignShellProvider bridge={undefined}>
        <MapSheet />
      </CampaignShellProvider>,
    );
    expect(probe.counts.mapController).toBe(1);

    patch({ saveMessage: "Saved" });
    patch({ screen: "fleet" });

    expect(probe.counts.mapController).toBe(1);
  });

  it("keeps the unavailable view out of unrelated field changes", () => {
    probe.set(shellWith(FILE_MODE, "file"));
    render(
      <CampaignShellProvider bridge={undefined}>
        <CampaignUnavailableView bridge={undefined} />
      </CampaignShellProvider>,
    );
    expect(probe.counts.newGameFlow).toBe(1);

    patch({ saveMessage: "Saved" });
    patch({ canGoBack: true });

    expect(probe.counts.newGameFlow).toBe(1);
  });

  it("re-renders the screen outlet when the campaign session changes", async () => {
    render(
      <CampaignShellProvider bridge={undefined}>
        <CampaignScreenOutlet screen="treasury" />
      </CampaignShellProvider>,
    );
    await mounted("treasury");
    const before = probe.counts.treasury;

    patch({ mode: { ...CAMPAIGN_MODE, campaign: { ...CAMPAIGN, sessionId: "s2" } } });

    expect(probe.counts.treasury).toBeGreaterThan(before);
  });
});

describe("shell root", () => {
  async function mountApp(): Promise<void> {
    render(<App bridge={undefined} />);
    await mounted("treasury");
  }

  it("does not re-render the root or its sections for a save message", async () => {
    await mountApp();
    const background = probe.counts.background;
    const header = probe.counts.header;
    const loading = probe.counts.loading;
    const treasury = probe.counts.treasury;

    patch({ saveMessage: "Saved" });

    expect(probe.counts.background).toBe(background);
    expect(probe.counts.header).toBe(header);
    expect(probe.counts.loading).toBe(loading);
    expect(probe.counts.treasury).toBe(treasury);
  });

  it("re-renders only the frame and content for a screen change", async () => {
    await mountApp();
    const background = probe.counts.background;
    const header = probe.counts.header;
    const loading = probe.counts.loading;
    const frame = probe.counts.frame;

    patch({ screen: "fleet" });

    expect(probe.counts.background).toBe(background);
    expect(probe.counts.header).toBe(header);
    expect(probe.counts.loading).toBe(loading);
    expect(probe.counts.frame).toBe(frame + 1);
  });

  it("leaves the frame alone when only the saving flag moves", async () => {
    await mountApp();
    const frame = probe.counts.frame;
    const background = probe.counts.background;

    patch({ saving: true });

    expect(probe.counts.frame).toBe(frame);
    expect(probe.counts.background).toBe(background);
  });
});
