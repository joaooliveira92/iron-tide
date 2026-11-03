/* @vitest-environment jsdom */
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import { DEFAULT_APP_PREFERENCES } from "../../shared/preferences-contract.js";
import { BridgeProvider } from "../lib/bridge-context.js";
import { PreferencesProvider } from "../lib/preferences-context.js";
import { createPreferencesBridgeStub } from "../lib/preferences-test-bridge.js";
import { BudgetContextChips } from "./BudgetContextChips.js";
import { DensityProvider } from "./DensityContext.js";
import type { CampaignReads } from "./campaign-reads.js";

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

const readyReads: CampaignReads = {
  projection: { status: "ready", value: projection },
  areas: { status: "ready", value: [] },
  reports: { status: "ready", value: [] },
  priorities: { status: "ready", value: [] },
};

const failedReads: CampaignReads = {
  ...readyReads,
  projection: { status: "unavailable", reason: "no campaign" },
};

async function renderChips(reads: CampaignReads) {
  const stub = createPreferencesBridgeStub({ ...DEFAULT_APP_PREFERENCES });
  const result = render(
    <BridgeProvider bridge={stub.bridge}>
      <PreferencesProvider>
        <DensityProvider>
          <BudgetContextChips reads={reads} />
        </DensityProvider>
      </PreferencesProvider>
    </BridgeProvider>,
  );
  await act(async () => {});
  return result;
}

describe("BudgetContextChips", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("shows the monthly balance and the treasury, and nothing else from the strip", async () => {
    await renderChips(readyReads);
    const group = screen.getByRole("group", { name: "Budget" });
    expect(within(group).getByRole("button", { name: /^Monthly balance/ })).toBeTruthy();
    expect(within(group).getByRole("button", { name: /^Treasury/ })).toBeTruthy();
    expect(within(group).getAllByRole("button")).toHaveLength(2);
  });

  it("renders nothing while the projection is unavailable", async () => {
    await renderChips(failedReads);
    expect(screen.queryByRole("group", { name: "Budget" })).toBeNull();
  });
});
