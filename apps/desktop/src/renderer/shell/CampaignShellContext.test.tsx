/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import {
  CampaignShellProvider,
  useActiveCampaignCurrencyContext,
  useCampaignShellContext,
} from "./CampaignShellContext.js";
import { useCampaignShell } from "./useCampaignShell.js";

vi.mock("./useCampaignShell.js", () => ({
  useCampaignShell: vi.fn(),
}));

const shell = {
  campaign: null,
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
  mode: { kind: "file", screen: "file" } as const,
  screen: "file" as const,
  canGoBack: false,
  canGoForward: false,
  openCampaign: vi.fn(async () => undefined),
  closeCampaign: vi.fn(async () => undefined),
  saveCampaign: vi.fn(async () => undefined),
  copyCampaign: vi.fn(async () => undefined),
  advanceMonth: vi.fn(async () => undefined),
  answerInterruption: vi.fn(),
  abandonPendingTurn: vi.fn(async () => undefined),
  refreshCampaign: vi.fn(),
  selectScreen: vi.fn(),
  reviseProject: vi.fn(),
  clearRevision: vi.fn(),
  setLeaveGuard: vi.fn(),
  setPrimaryAction: vi.fn(),
  goBack: vi.fn(),
  goForward: vi.fn(),
};

function Consumer() {
  const context = useCampaignShellContext();
  return (
    <div>
      <span>{context.state.mode.kind}</span>
      <span>{context.meta.bridgeAvailable ? "bridge" : "no bridge"}</span>
      <button onClick={() => context.actions.selectScreen("overview")}>Navigate</button>
    </div>
  );
}

function CurrencyConsumer() {
  const context = useActiveCampaignCurrencyContext();
  return <span data-testid="currency-context">{JSON.stringify(context)}</span>;
}

describe("CampaignShellProvider", () => {
  it("provides shell state, actions, and metadata", () => {
    vi.mocked(useCampaignShell).mockReturnValue(shell);
    const bridge = {} as BluewaveDesktopBridge;

    render(
      <CampaignShellProvider bridge={bridge}>
        <Consumer />
      </CampaignShellProvider>,
    );

    expect(screen.getByText("file")).toBeTruthy();
    expect(screen.getByText("bridge")).toBeTruthy();
    screen.getByRole("button", { name: "Navigate" }).click();
    expect(shell.selectScreen).toHaveBeenCalledWith("overview");
    expect(useCampaignShell).toHaveBeenCalledWith(bridge);
  });

  it("reports when the desktop bridge is unavailable", () => {
    vi.mocked(useCampaignShell).mockReturnValue(shell);
    render(
      <CampaignShellProvider bridge={undefined}>
        <Consumer />
      </CampaignShellProvider>,
    );
    expect(screen.getByText("no bridge")).toBeTruthy();
  });

  it("rejects consumers outside the provider boundary", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Consumer />)).toThrow(
      "useCampaignShellContext must be used within CampaignShellProvider",
    );
    consoleError.mockRestore();
  });

  it("derives the active campaign's nation and year for presentation resolution", () => {
    vi.mocked(useCampaignShell).mockReturnValue({
      ...shell,
      campaign: {
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
      },
    });

    render(
      <CampaignShellProvider bridge={undefined}>
        <CurrencyConsumer />
      </CampaignShellProvider>,
    );

    expect(screen.getByTestId("currency-context").textContent).toBe(
      JSON.stringify({ nationId: "uk", year: 1900 }),
    );
  });

  it("resolves no currency context outside a campaign or provider", () => {
    vi.mocked(useCampaignShell).mockReturnValue(shell);
    const { unmount } = render(
      <CampaignShellProvider bridge={undefined}>
        <CurrencyConsumer />
      </CampaignShellProvider>,
    );
    expect(screen.getByTestId("currency-context").textContent).toBe("{}");
    unmount();
    render(<CurrencyConsumer />);
    expect(screen.getByTestId("currency-context").textContent).toBe("{}");
  });
});
