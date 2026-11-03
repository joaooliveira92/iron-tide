/* @vitest-environment jsdom */
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../lib/preferences-test-bridge.js";
import { AppFrame } from "./AppFrame.js";
import { DensityProvider } from "./DensityContext.js";
import type { Screen } from "./campaign-screen-registry.js";
import type { CampaignReads } from "./campaign-reads.js";

vi.mock("./BottomNav.js", () => ({ BottomNav: () => null }));
vi.mock("./StatusStrip.js", () => ({
  StatusStrip: () => <section data-testid="status-strip" />,
}));

const reads: CampaignReads = {
  projection: { status: "unavailable", reason: "test" },
  areas: { status: "unavailable", reason: "test" },
  reports: { status: "unavailable", reason: "test" },
  priorities: { status: "unavailable", reason: "test" },
};

const matchMedia = vi.fn<(query: string) => MediaQueryList>().mockImplementation(
  (query) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) as MediaQueryList,
);

async function renderFrame(screenName: Screen) {
  const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
  render(
    <BridgeProvider bridge={stub.bridge}>
      <PreferencesProvider>
        <DensityProvider>
          <AppFrame
            campaignSessionId="session_1"
            campaignReads={reads}
            screen={screenName}
            saveMessage={null}
            header={null}
            onSelectScreen={() => {}}
          >
            <p>content</p>
          </AppFrame>
        </DensityProvider>
      </PreferencesProvider>
    </BridgeProvider>,
  );
  await act(async () => {});
}

describe("AppFrame status strip", () => {
  beforeEach(() => {
    window.matchMedia = matchMedia;
    localStorage.clear();
  });
  afterEach(cleanup);

  it("shows the strip on the overview", async () => {
    await renderFrame("overview");
    expect(screen.queryByTestId("status-strip")).not.toBeNull();
  });

  it("leaves the strip out of the ship design screen", async () => {
    await renderFrame("ship-design");
    expect(screen.queryByTestId("status-strip")).toBeNull();
  });
});
