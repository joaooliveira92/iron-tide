/* @vitest-environment jsdom */
import type { BattleResolution, TacticalBattleOutcome } from "@bluewave/campaign-engine";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { BattleResolutionPanel } from "./BattleResolutionPanel.js";

const autoResolution = {
  battleId: "battle_1",
  missionOutcome: { winner: "attacker", outcomeKind: "decisive" },
  warScoreChange: 3,
  attacker: { ships: [{ shipId: "HMS Majestic", outcome: "afloat" }] },
  defender: { ships: [{ shipId: "SMS Wörth", outcome: "sunk" }] },
} as unknown as BattleResolution;

const tacticalOutcome = {
  battleId: "battle_1",
  turnsResolved: 12,
  endCondition: "disengaged",
  warScoreChange: -2,
  rejectedOrders: [{}, {}],
  battleEventLedger: {
    events: [{ turn: 3, eventType: "gunnery", data: { hit: true } }],
  },
} as unknown as TacticalBattleOutcome;

const ResizeObserverMock = vi.hoisted(
  () =>
    class implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
);
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

afterEach(() => {
  cleanup();
});

describe("BattleResolutionPanel", () => {
  it("renders both resolver outputs when both have run", () => {
    render(
      <BattleResolutionPanel autoResolution={autoResolution} tacticalOutcome={tacticalOutcome} />,
    );

    expect(screen.getByText("Auto-Resolution Completed")).not.toBeNull();
    expect(screen.getByText("WINNER: attacker")).not.toBeNull();
    expect(screen.getByText("decisive")).not.toBeNull();
    expect(screen.getByText("War Score Change:")).not.toBeNull();
    expect(screen.getByText("3")).not.toBeNull();
    expect(screen.getByText("HMS Majestic")).not.toBeNull();
    expect(screen.getByText("afloat")).not.toBeNull();
    expect(screen.getByText("SMS Wörth")).not.toBeNull();
    expect(screen.getByText("sunk")).not.toBeNull();

    expect(screen.getByText("Tactical Turn-by-Turn Resolver Outcome")).not.toBeNull();
    expect(screen.getByText("Turns resolved")).not.toBeNull();
    expect(screen.getByText("12 / 200")).not.toBeNull();
    expect(screen.getByText("End Condition:")).not.toBeNull();
    expect(screen.getByText("disengaged")).not.toBeNull();
    expect(screen.getByText(/Rejected Orders: 2/)).not.toBeNull();
    expect(screen.getByText("TACTICAL EVENT LEDGER:")).not.toBeNull();
    expect(screen.getByText("gunnery")).not.toBeNull();
  });

  it("shows INCONCLUSIVE when the auto-resolution has no winner", () => {
    render(
      <BattleResolutionPanel
        autoResolution={
          {
            ...autoResolution,
            missionOutcome: { winner: null, outcomeKind: "draw" },
          } as BattleResolution
        }
        tacticalOutcome={null}
      />,
    );

    expect(screen.getByText("WINNER: INCONCLUSIVE")).not.toBeNull();
  });

  it("shows only the auto resolution when no tactical run exists", () => {
    render(<BattleResolutionPanel autoResolution={autoResolution} tacticalOutcome={null} />);

    expect(screen.getByText("Auto-Resolution Completed")).not.toBeNull();
    expect(screen.queryByText("Tactical Turn-by-Turn Resolver Outcome")).toBeNull();
  });

  it("shows only the tactical outcome when no auto resolution exists", () => {
    render(<BattleResolutionPanel autoResolution={null} tacticalOutcome={tacticalOutcome} />);

    expect(screen.getByText("Tactical Turn-by-Turn Resolver Outcome")).not.toBeNull();
    expect(screen.queryByText("Auto-Resolution Completed")).toBeNull();
  });

  it("renders nothing when neither resolver has run", () => {
    const { container } = render(
      <BattleResolutionPanel autoResolution={null} tacticalOutcome={null} />,
    );

    expect(container.firstChild).toBeNull();
  });
});
