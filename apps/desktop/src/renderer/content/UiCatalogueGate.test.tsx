import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { CampaignCommandClient } from "../../shared/campaign-command-contract.js";

/**
 * The running app must inject the compiled UI-string catalogue before any surface
 * resolves a message; otherwise every offer/turn string renders the generic fallback.
 * Fresh modules model the app (no pre-seeded catalogue, unlike the test setup).
 */
describe("UiCatalogueGate", () => {
  afterEach(() => {
    cleanup();
    vi.doUnmock("./uiCatalogue.js");
    vi.resetModules();
  });

  it("fetches the catalogue over IPC and renders children only once it is injected", async () => {
    vi.resetModules();
    // The test setup pre-seeds the real seam; model the app's empty one.
    vi.doMock("./uiCatalogue.js", () => {
      let injected: { strings: Record<string, string> } | null = null;
      return {
        hasUiCatalogue: () => injected !== null,
        setUiCatalogue: (dto: { strings: Record<string, string> }) => {
          injected = dto;
        },
        resolveMessage: (key: string) => injected?.strings[key] ?? "Something happened this month.",
      };
    });
    const { UiCatalogueGate } = await import("./UiCatalogueGate.js");
    const { resolveMessage } = await import("./uiCatalogue.js");
    const { BridgeProvider } = await import("../lib/bridge-context.js");
    const execute = vi.fn<CampaignCommandClient["execute"]>(() =>
      Promise.resolve({
        outcome: "success",
        value: { locale: "en-US", strings: { "ui.offer.accept": "Fight it" } },
      } as never),
    );
    const Child = () => <p data-testid="child">{resolveMessage("ui.offer.accept")}</p>;
    const bridge: BluewaveDesktopBridge = {
      campaign: { execute },
      preferences: {
        read: () => Promise.resolve({ outcome: "error", reason: "x", diagnostics: [] }),
        write: () => Promise.resolve({ outcome: "error", reason: "x", diagnostics: [] }),
        readCampaign: () => Promise.resolve({ outcome: "error", reason: "x", diagnostics: [] }),
        writeCampaign: () => Promise.resolve({ outcome: "error", reason: "x", diagnostics: [] }),
      },
      platform: "darwin",
      getWindowState: () => Promise.reject(new Error("unused")),
      windowMinimize: () => {},
      windowMaximizeToggle: () => {},
      windowClose: () => {},
    };
    render(
      <BridgeProvider bridge={bridge}>
        <UiCatalogueGate>
          <Child />
        </UiCatalogueGate>
      </BridgeProvider>,
    );
    expect(screen.queryByTestId("child")).toBeNull();
    await waitFor(() => expect(screen.getByTestId("child").textContent).toBe("Fight it"));
    expect(execute).toHaveBeenCalledWith("inspectUiCatalogue", undefined);
  });
});
