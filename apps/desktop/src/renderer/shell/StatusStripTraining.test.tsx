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

function projection(training: PlayerProjection["training"]): PlayerProjection {
  return {
    prestige: { current: 19, sackingThreshold: 16, dismissalRisk: false },
    fleetMorale: { current: 100, max: 100 },
    ...(training === undefined ? {} : { training }),
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

async function renderBudget(training: PlayerProjection["training"]) {
  const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
  const model = buildStatusStrip({
    projection: projection(training),
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
  return within(screen.getByRole("region", { name: "Status strip" }));
}

describe("BudgetPanel extra training readout (#187)", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("shows the funded subjects and the upkeep adder as a live row", async () => {
    const strip = await renderBudget({
      subjects: [{ subject: "GUNNERY", fundedMonths: 2 }],
      maintenanceAdderBp: 150,
    });
    const row = strip.getByText("Extra training").closest("[data-row]") as HTMLElement;
    expect(row.getAttribute("data-row")).toBe("extra-training");
    expect(row.getAttribute("data-deferred")).toBe("false");
    expect(within(row).getByText("1 funded, +1.5% upkeep")).toBeTruthy();
  });

  it("says none funded when the programme is empty", async () => {
    const strip = await renderBudget({ subjects: [], maintenanceAdderBp: 0 });
    const row = strip.getByText("Extra training").closest("[data-row]") as HTMLElement;
    expect(within(row).getByText("None funded")).toBeTruthy();
  });

  it("no longer lists extra training among the not-yet-modelled rows", async () => {
    const strip = await renderBudget(undefined);
    expect(strip.getAllByText("Extra training")).toHaveLength(1);
  });
});
