/* @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import type { BattleResolution, TacticalBattleOutcome } from "@bluewave/campaign-engine";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { SandboxAutoResolutionCard } from "./SandboxAutoResolutionCard.js";
import { SandboxTacticalOutcomeCard } from "./SandboxTacticalOutcomeCard.js";

const resolution = {
  missionOutcome: { winner: "attacker", outcomeKind: "decisive" },
  warScoreChange: 3,
  attacker: { ships: [{ shipId: "HMS Majestic", outcome: "afloat" }] },
  defender: { ships: [{ shipId: "SMS Wörth", outcome: "sunk" }] },
} as unknown as BattleResolution;

const outcome = {
  turnsResolved: 12,
  endCondition: "disengaged",
  warScoreChange: -2,
  rejectedOrders: [{}, {}],
  weather: { seaState: 4, visibilityNm: 8, precipitation: "rain", timeOfDay: "dawn" },
  gunneryResults: [
    {
      turn: 3,
      divisionId: "Channel Squadron",
      targetDivisionId: "High Seas Fleet",
      shots: [
        {
          shooterShipId: "HMS Majestic",
          targetShipId: "SMS Wörth",
          hit: true,
          armorOutcome: "penetrated",
        },
      ],
    },
  ],
  battleReport: {
    torpedoExpenditure: [{ turn: 5, shipId: "HMS Daring", targetShipId: "SMS Wörth", hit: false }],
  },
  mineStrikeEvents: [{ turn: 7, shipId: "HMS Daring", damageState: "crippled" }],
  submarineElementLosses: [{ losses: 2 }],
} as unknown as TacticalBattleOutcome;

describe("SandboxAutoResolutionCard", () => {
  afterEach(cleanup);

  it("renders the winner, score, and both sides' ships", () => {
    render(<SandboxAutoResolutionCard resolution={resolution} />);
    expect(screen.getByText("Auto-Resolution")).toBeTruthy();
    expect(screen.getByText("attacker")).toBeTruthy();
    expect(screen.getByText("HMS Majestic")).toBeTruthy();
    expect(screen.getByText("afloat")).toBeTruthy();
    expect(screen.getByText("SMS Wörth")).toBeTruthy();
    expect(screen.getByText("sunk")).toBeTruthy();
  });

  it("falls back to INCONCLUSIVE when there is no winner", () => {
    render(
      <SandboxAutoResolutionCard
        resolution={
          {
            ...resolution,
            missionOutcome: { winner: null, outcomeKind: "draw" },
          } as BattleResolution
        }
      />,
    );
    expect(screen.getByText("INCONCLUSIVE")).toBeTruthy();
  });
});

describe("SandboxTacticalOutcomeCard", () => {
  afterEach(cleanup);

  it("renders the weather, gunnery, and torpedo/mine sections", () => {
    const { container } = render(<SandboxTacticalOutcomeCard outcome={outcome} />);
    expect(container.textContent).toContain("Tactical Outcome — 12 turns resolved");
    expect(container.textContent).toContain("Sea State");
    expect(container.textContent).toContain("Visibility (nm)");
    expect(container.textContent).toContain("rain");
    expect(container.textContent).toContain("HMS Majestic → SMS Wörth");
    expect(container.textContent).toContain("HMS Daring");
    expect(container.textContent).toContain("crippled");
  });

  it("reports empty sections when no mechanic fired", () => {
    const empty = {
      ...outcome,
      gunneryResults: [],
      battleReport: { torpedoExpenditure: [] },
      mineStrikeEvents: [],
      submarineElementLosses: [],
    } as unknown as TacticalBattleOutcome;
    render(<SandboxTacticalOutcomeCard outcome={empty} />);
    expect(screen.getByText("No gunnery exchanges occurred.")).toBeTruthy();
    expect(screen.getByText("None fired.")).toBeTruthy();
    expect(screen.getByText("None.")).toBeTruthy();
  });
});
