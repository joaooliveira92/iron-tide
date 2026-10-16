/* @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import { CampaignShellProvider, useCampaignShellContext } from "./CampaignShellContext.js";
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
  mode: { kind: "file", screen: "file" } as const,
  screen: "file" as const,
  canGoBack: false,
  canGoForward: false,
  openCampaign: vi.fn(async () => undefined),
  closeCampaign: vi.fn(async () => undefined),
  saveCampaign: vi.fn(async () => undefined),
  copyCampaign: vi.fn(async () => undefined),
  advanceMonth: vi.fn(async () => undefined),
  answerDecision: vi.fn(async () => undefined),
  submitBattleResult: vi.fn(async () => undefined),
  abandonPendingTurn: vi.fn(async () => undefined),
  refreshCampaign: vi.fn(),
  selectScreen: vi.fn(),
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
});
