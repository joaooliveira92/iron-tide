import { act, cleanup, render, screen, within } from "@testing-library/react";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { createPresentationFormat } from "../lib/presentation-format/profile.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../lib/preferences-test-bridge.js";
import { DensityProvider } from "./DensityContext.js";
import { StatusStripView } from "./StatusStrip.js";
import { buildStatusStrip } from "./status-strip-state.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

function projection(unrest: number | undefined): PlayerProjection {
  return {
    prestige: { current: 19, sackingThreshold: 16, dismissalRisk: false },
    ...(unrest === undefined ? {} : { unrest }),
    campaignIdentity: "campaign_1",
    snapshotHash: "hash_abc",
    revision: 4,
    month: { year: 1881, month: 2 },
    playerNationId: "uk",
    nationName: "Britain",
    projectedSurplusDeficit: 0,
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
      projectedNet: 0,
      shortfall: 0,
      status: "healthy",
      monthEndTreasury: 50000,
    },
    knownTechnologyIds: [],
    fleet: [],
    strategicAreas: [],
    ports: [],
    knownEnemyNations: [],
    commandWorkspace: { commands: [], movementCommands: [] },
  };
}

async function renderNation(unrest: number | undefined) {
  const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
  const model = buildStatusStrip({
    projection: projection(unrest),
    areas: [],
    alertsCount: null,
    format: FORMAT,
  });
  render(
    <BridgeProvider bridge={stub.bridge}>
      <PreferencesProvider>
        <DensityProvider>
          <StatusStripView model={model} startCollapsed={false} />
        </DensityProvider>
      </PreferencesProvider>
    </BridgeProvider>,
  );
  await act(async () => {});
  const region = screen.getByRole("region", { name: "Status strip" });
  return within(region).getByText("Unrest level").closest("[data-row]") as HTMLElement;
}

describe("NationPanel unrest readout after a presence shortfall (#826)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("shows the national unrest the shortfall raised as a live figure out of ten", async () => {
    const row = await renderNation(4);
    expect(row.getAttribute("data-deferred")).toBe("false");
    expect(within(row).getByText("4 / 10")).toBeTruthy();
  });

  it("reads zero for a nation whose unrest was never moved", async () => {
    const row = await renderNation(undefined);
    expect(within(row).getByText("0 / 10")).toBeTruthy();
  });
});
