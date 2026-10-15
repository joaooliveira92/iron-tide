/* @vitest-environment jsdom */
import type { CommitMonthResponse } from "@bluewave/campaign-engine";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { TurnReportTab } from "./TurnReportTab.js";

/**
 * Render tests for the Turn Report's Battle Outcomes section
 * (desktop-battle-outcomes INC-3, spec AC-4/AC-5). The component is rendered
 * directly with a fixture response so the tests assert PURE presentation over
 * the read-only `commitResult.closingSnapshot.battleOutcomes`: exactly what
 * the engine emitted (raw ids, winner/loser, delta, losses) — and an honest
 * empty state when the month resolved no battle. Nothing here mutates state
 * or touches authoritative code.
 */

function makeCommitResult(
  battleOutcomes: CommitMonthResponse["closingSnapshot"]["battleOutcomes"],
): CommitMonthResponse {
  return {
    report: {
      month: { month: 2, year: 1880 },
      openingTreasury: 1000,
      maintenanceCost: 120,
      newConstructionSpending: 60,
      closingTreasury: 820,
    },
    domainEvents: [],
    financialLedger: [],
    randomDecisions: [],
    closingSnapshot: {
      revision: 2,
      month: { month: 2, year: 1880 },
      submarinePools: [],
      minePressure: [],
      landTargetDamage: [],
      battleOutcomes,
      activeWars: [],
    },
  };
}

// `ScrollArea` (@base-ui/react) measures its element with ResizeObserver —
// jsdom doesn't ship it; a no-op shim is enough for a pure render test
// (mirrors the research/diplomacy screen tests).
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

describe("TurnReportTab Battle Outcomes", () => {
  it("renders resolved battles with raw ids, winner/loser, war-score delta and ship losses", () => {
    render(
      <TurnReportTab
        commitResult={makeCommitResult([
          {
            battleId: "battle_1",
            areaId: "area_north_sea",
            attackerId: "nation_uk",
            defenderId: "nation_de",
            winnerId: "nation_uk",
            loserId: "nation_de",
            warScoreDelta: 10,
            attackerLosses: ["HMS Accrington", "HMS Ballard"],
            defenderLosses: [],
            explanation: ["Deck damage assessment complete."],
          },
          {
            battleId: "battle_2",
            areaId: "area_med_sea",
            attackerId: "nation_de",
            defenderId: "nation_fr",
            winnerId: "nation_de",
            loserId: "nation_fr",
            warScoreDelta: 5,
            attackerLosses: [],
            defenderLosses: ["Courbet"],
            explanation: [],
          },
        ])}
      />,
    );

    expect(screen.getByText("BATTLE: battle_1")).not.toBeNull();
    expect(screen.getByText("BATTLE: battle_2")).not.toBeNull();
    expect(screen.getByText("area_north_sea")).not.toBeNull();

    expect(screen.getByText("Winner: nation_uk")).not.toBeNull();
    expect(screen.getByText("Loser: nation_de")).not.toBeNull();
    expect(screen.getByText("Winner: nation_de")).not.toBeNull();
    expect(screen.getByText("Loser: nation_fr")).not.toBeNull();

    expect(screen.getByText("+10")).not.toBeNull();
    expect(screen.getByText("+5")).not.toBeNull();

    expect(screen.getByText("2 lost")).not.toBeNull();
    expect(screen.getByText("HMS Accrington")).not.toBeNull();
    expect(screen.getByText("HMS Ballard")).not.toBeNull();
    expect(screen.getByText("Courbet")).not.toBeNull();
    expect(screen.getAllByText("no losses").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Deck damage assessment complete.")).not.toBeNull();
  });

  it("renders an undecided battle honestly, without fabricating a winner or war score", () => {
    render(
      <TurnReportTab
        commitResult={makeCommitResult([
          {
            battleId: "battle_stalemate",
            areaId: "area_baltic",
            attackerId: "nation_uk",
            defenderId: "nation_de",
            winnerId: null,
            loserId: null,
            warScoreDelta: 0,
            attackerLosses: [],
            defenderLosses: [],
            explanation: ["Battle ended at the time limit without a decisive engagement."],
          },
        ])}
      />,
    );

    expect(screen.getByText("BATTLE: battle_stalemate")).not.toBeNull();
    expect(screen.getByText("No conclusive result (tie / time limit)")).not.toBeNull();
    expect(screen.getByText("0 (non-decided)")).not.toBeNull();
    expect(screen.queryByText(/Winner:/)).toBeNull();
    expect(screen.queryByText(/Loser:/)).toBeNull();
    expect(screen.queryByText(/\+[1-9]/)).toBeNull();
  });

  it("renders an honest empty state (no battles) instead of hiding the section", () => {
    render(<TurnReportTab commitResult={makeCommitResult([])} />);

    expect(screen.getByText("Battle Outcomes")).not.toBeNull();
    expect(screen.getByText("No battles resolved this month.")).not.toBeNull();
    expect(screen.queryByText(/BATTLE:/)).toBeNull();
    expect(screen.queryByText(/Winner:/)).toBeNull();
  });
});
