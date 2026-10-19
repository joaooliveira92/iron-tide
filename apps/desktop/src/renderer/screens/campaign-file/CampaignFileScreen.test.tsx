/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { RecentCampaignEntry } from "../../../shared/continuity-contract.js";
import { BridgeProvider } from "../../lib/bridge-context.js";
import { CampaignFileScreen } from "./CampaignFileScreen.js";

const ResizeObserverMock = vi.hoisted(
  () =>
    class implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
);
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const entry = (name: string, available = true): RecentCampaignEntry => ({
  packagePath: `/saves/${name}`,
  campaignIdentity: `id-${name}`,
  activeRevision: 3,
  lastOpened: 1,
  available,
});

type Handler = (command: string, payload: unknown) => unknown;

function renderScreen(handler: Handler) {
  const execute = vi.fn(async (command: string, payload: unknown) => handler(command, payload));
  const onOpenCampaign = vi.fn();
  const bridge = { campaign: { execute } } as never;
  render(
    <BridgeProvider bridge={bridge}>
      <CampaignFileScreen onOpenCampaign={onOpenCampaign} onStartNewGame={vi.fn()} />
    </BridgeProvider>,
  );
  return { execute, onOpenCampaign };
}

const ok = (value: unknown) => ({ outcome: "success", value, diagnostics: [] });
const fail = (reason: string, diagnostics: string[] = []) => ({
  outcome: "error",
  reason,
  diagnostics,
});

afterEach(cleanup);

describe("CampaignFileScreen recent campaigns", () => {
  it("opens a recent campaign directly, without invoking the file dialog", async () => {
    const { execute, onOpenCampaign } = renderScreen((command) => {
      if (command === "listRecentCampaigns") return ok([entry("japan")]);
      if (command === "loadRecentCampaign") return ok({ sessionId: "s-1" });
      throw new Error(`unexpected ${command}`);
    });

    fireEvent.click(await screen.findByText("japan"));

    await waitFor(() => expect(onOpenCampaign).toHaveBeenCalledWith("s-1"));
    expect(execute).toHaveBeenCalledWith("loadRecentCampaign", { packagePath: "/saves/japan" });
    expect(execute).not.toHaveBeenCalledWith("loadCampaign", undefined);
  });

  it("falls back to the dialog when the main process does not approve the path", async () => {
    const { execute, onOpenCampaign } = renderScreen((command) => {
      if (command === "listRecentCampaigns") return ok([entry("france")]);
      if (command === "loadRecentCampaign") return fail("PACKAGE_NOT_APPROVED");
      if (command === "loadCampaign") return ok({ sessionId: "s-2" });
      throw new Error(`unexpected ${command}`);
    });

    fireEvent.click(await screen.findByText("france"));

    await waitFor(() => expect(onOpenCampaign).toHaveBeenCalledWith("s-2"));
    expect(execute).toHaveBeenCalledWith("loadCampaign", undefined);
  });

  it("shows a missing package as unavailable and cannot open it", async () => {
    renderScreen((command) => {
      if (command === "listRecentCampaigns") return ok([entry("gone", false)]);
      throw new Error(`unexpected ${command}`);
    });

    expect(await screen.findByText(/Package not found/)).not.toBeNull();
    expect((screen.getByText("gone") as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps a load error visible and refreshes the list when the package vanished", async () => {
    let listed = [entry("moved")];
    renderScreen((command) => {
      if (command === "listRecentCampaigns") return ok(listed);
      if (command === "loadRecentCampaign") {
        listed = [entry("moved", false)];
        return fail("PACKAGE_MISSING", ["/saves/moved no longer exists."]);
      }
      throw new Error(`unexpected ${command}`);
    });

    fireEvent.click(await screen.findByText("moved"));

    expect(await screen.findByText(/PACKAGE_MISSING/)).not.toBeNull();
    expect(await screen.findByText(/Package not found/)).not.toBeNull();
  });

  it("removes an entry through the main process", async () => {
    const { execute } = renderScreen((command) => {
      if (command === "listRecentCampaigns") return ok([entry("japan")]);
      if (command === "removeRecentCampaign") return ok([]);
      throw new Error(`unexpected ${command}`);
    });

    fireEvent.click(await screen.findByLabelText("Remove japan from recent"));

    await waitFor(() => expect(screen.queryByText("japan")).toBeNull());
    expect(execute).toHaveBeenCalledWith("removeRecentCampaign", { packagePath: "/saves/japan" });
  });
});
