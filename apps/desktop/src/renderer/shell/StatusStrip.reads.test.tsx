/* @vitest-environment jsdom */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../lib/preferences-test-bridge.js";
import { DensityProvider } from "./DensityContext.js";
import type { CampaignReads } from "./campaign-reads.js";

vi.mock("./status-strip-state.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./status-strip-state.js")>();
  return { ...actual, buildStatusStrip: vi.fn(actual.buildStatusStrip) };
});

const { StatusStrip } = await import("./StatusStrip.js");
const { buildStatusStrip } = await import("./status-strip-state.js");

const projection: PlayerProjection = {
  prestige: { current: 20, sackingThreshold: 16, dismissalRisk: false },
  campaignIdentity: "campaign_1",
  snapshotHash: "hash_abc",
  revision: 4,
  month: { year: 1900, month: 2 },
  playerNationId: "uk",
  nationName: "Britain",
  projectedSurplusDeficit: 1200,
  economy: {
    treasury: 50000,
    monthlyAppropriation: 5000,
    shipyardCapacity: 7,
    constructionSpend: 1000,
    researchSpend: 800,
    maintenanceCost: 2000,
    obligations: 500,
    researchRequested: 800,
    researchCap: 600,
    plannedConstruction: 1000,
    projectedNet: 1200,
    shortfall: 0,
    status: "healthy",
    monthEndTreasury: 51200,
  },
  knownTechnologyIds: [],
  fleet: [],
  strategicAreas: [],
  ports: [],
  knownEnemyNations: [],
  commandWorkspace: { commands: [], movementCommands: [] },
};

function reads(): CampaignReads {
  return {
    projection: { status: "ready", value: projection },
    areas: { status: "ready", value: [] },
    reports: { status: "ready", value: [] },
    priorities: { status: "ready", value: [] },
  };
}

function Shell({ current }: { readonly current: CampaignReads }) {
  return <StatusStrip reads={current} />;
}

describe("StatusStrip model rebuilds", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(buildStatusStrip).mockClear();
  });
  afterEach(cleanup);

  it("builds the model once and keeps it while the shell re-renders with the same reads", async () => {
    const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
    const campaignReads = reads();
    const result = render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>
            <Shell current={campaignReads} />
          </DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    await act(async () => {});
    expect(vi.mocked(buildStatusStrip)).toHaveBeenCalledTimes(1);

    result.rerender(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>
            <Shell current={campaignReads} />
          </DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    await act(async () => {});
    expect(vi.mocked(buildStatusStrip)).toHaveBeenCalledTimes(1);
  });

  it("rebuilds the model when the projection it reads changes", async () => {
    const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
    render(
      <BridgeProvider bridge={stub.bridge}>
        <PreferencesProvider>
          <DensityProvider>
            <Shell current={reads()} />
          </DensityProvider>
        </PreferencesProvider>
      </BridgeProvider>,
    );
    await act(async () => {});
    expect(vi.mocked(buildStatusStrip)).toHaveBeenCalledTimes(1);
  });
});
