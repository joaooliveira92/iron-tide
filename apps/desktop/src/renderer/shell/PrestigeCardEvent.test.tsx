import { cleanup, render, screen } from "@testing-library/react";
import type { PlayerProjection } from "@bluewave/campaign-engine";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createPresentationFormat } from "../lib/presentation-format/profile.js";
import { PrestigeCard } from "./status-strip/cards/PrestigeCard.js";
import { buildStatusStrip } from "./status-strip-state.js";

const FORMAT = createPresentationFormat({
  locale: "en-US",
  numberScale: "full",
  measurementPreset: "imperial",
  measurementSelections: {},
  currency: { mode: "navalCredits" },
});

const PROJECTION: PlayerProjection = {
  prestige: {
    current: 25,
    sackingThreshold: 16,
    dismissalRisk: false,
    lastChange: {
      reasonCode: "NAVAL_DISPLAY",
      before: 20,
      after: 25,
      delta: 5,
      month: "1880-02",
    },
  },
  campaignIdentity: "campaign_1",
  snapshotHash: "hash_abc",
  revision: 4,
  month: { year: 1880, month: 2 },
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

describe("PrestigeCard after an answered event", () => {
  afterEach(cleanup);

  it("names the answer that moved prestige and the amount in the card foot", () => {
    const strip = buildStatusStrip({
      projection: PROJECTION,
      areas: [],
      alertsCount: null,
      format: FORMAT,
    });
    const row = strip.nation.find((entry) => entry.id === "prestige")!;
    render(
      <PrestigeCard
        gauge={{
          current: 25,
          threshold: 16,
          fraction: 0.25,
          thresholdFraction: 0.16,
          atRisk: false,
        }}
        note={row.note}
      />,
    );
    expect(screen.getByText(/Last change: \+5 \(naval display, 1880-02\)\./)).toBeTruthy();
    expect(screen.getByText("25")).toBeTruthy();
  });
});
