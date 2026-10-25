import { cleanup, render, screen } from "@testing-library/react";
import type { BattleHistoryEntry } from "@bluewave/campaign-engine";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { BattleHistorySection } from "./BattleHistorySection.js";

const debugFlag = vi.hoisted(() => ({ on: false }));
vi.mock("../../../shell/debug-flag.js", () => ({
  get DEBUG_MODE() {
    return debugFlag.on;
  },
}));

function entry(over: Partial<BattleHistoryEntry>): BattleHistoryEntry {
  return {
    sequence: 1,
    battleId: "battle_0007",
    areaId: "a",
    areaName: "English Home Waters",
    attackerId: "uk",
    attackerName: "Britain",
    defenderId: "france",
    defenderName: "France",
    involvesPlayer: true,
    outcomeForPlayer: "won",
    playerLossCount: 1,
    enemyLossCount: 3,
    lostShipIds: ["s1", "s2", "s3", "s4"],
    lostShips: [],
    ...over,
  };
}

describe("BattleHistorySection", () => {
  afterEach(() => {
    cleanup();
    debugFlag.on = false;
  });

  it("explains each absent ship with its ordered reasons and no ship ids", () => {
    render(
      <BattleHistorySection
        state={{
          status: "ready",
          history: {
            battles: [
              entry({
                absentShips: [
                  {
                    shipId: "uk_9",
                    shipName: "HMS Agamemnon",
                    reasons: ["Unavailable", "InRepair"],
                  },
                ],
              }),
            ],
          },
        }}
      />,
    );
    expect(screen.getByLabelText("Ships absent from this battle")).toBeTruthy();
    expect(screen.getByText("HMS Agamemnon")).toBeTruthy();
    expect(screen.getByText("absent: out of action in a yard project, under repair")).toBeTruthy();
    expect(screen.queryByText(/uk_9/)).toBeNull();
  });

  it("shows loading and error states honestly", () => {
    const { rerender } = render(<BattleHistorySection state={{ status: "loading" }} />);
    expect(screen.getByText(/Loading battle history/)).toBeTruthy();
    rerender(<BattleHistorySection state={{ status: "error", message: "SESSION_NOT_FOUND" }} />);
    expect(screen.getByRole("alert").textContent).toContain("SESSION_NOT_FOUND");
  });

  it("shows an empty state when no battle has resolved", () => {
    render(<BattleHistorySection state={{ status: "ready", history: { battles: [] } }} />);
    expect(screen.getByText("No battles fought yet")).toBeTruthy();
  });

  it("shows outcome, sides, area and loss counts — and never ship or battle ids in release", () => {
    render(<BattleHistorySection state={{ status: "ready", history: { battles: [entry({})] } }} />);
    expect(screen.getByText("Victory")).toBeTruthy();
    expect(screen.getByText("Britain vs France")).toBeTruthy();
    expect(screen.getByText("in English Home Waters")).toBeTruthy();
    expect(screen.getByText("you lost 1 ship · enemy lost 3 ships")).toBeTruthy();
    expect(screen.queryByText("battle_0007")).toBeNull();
    expect(screen.queryByText(/s1/)).toBeNull();
    expect(screen.getByText(/before ship records were kept/)).toBeTruthy();
  });

  it("totals only the player's battles in the summary line", () => {
    render(
      <BattleHistorySection
        state={{
          status: "ready",
          history: {
            battles: [
              entry({ battleId: "b1" }),
              entry({
                battleId: "b2",
                outcomeForPlayer: "lost",
                playerLossCount: 4,
                enemyLossCount: 1,
              }),
              entry({
                battleId: "b3",
                involvesPlayer: false,
                outcomeForPlayer: "not-involved",
                enemyLossCount: 9,
              }),
            ],
          },
        }}
      />,
    );
    expect(screen.getByTestId("battle-summary").textContent).toContain(
      "2 battles fought · 1 won · 1 lost · 0 undecided · you lost 5 ships, the enemy lost 4 ships",
    );
    expect(screen.getByText("Not involved")).toBeTruthy();
    expect(screen.getByText("9 ships lost")).toBeTruthy();
  });

  it("shows the battle id only in a debug build", () => {
    debugFlag.on = true;
    render(<BattleHistorySection state={{ status: "ready", history: { battles: [entry({})] } }} />);
    expect(screen.getByText("battle_0007")).toBeTruthy();
  });

  it("lists lost ships by name, class, owner and cause, and only notes missing records for old battles", () => {
    const withShips = entry({
      lostShipIds: ["s1"],
      lostShips: [
        {
          name: "HMS Valiant",
          classId: "ironclad_battleship",
          nationName: "Britain",
          ownedByPlayer: true,
          month: "1880-03",
          cause: "torpedo",
        },
      ],
    });
    const { rerender } = render(
      <BattleHistorySection state={{ status: "ready", history: { battles: [withShips] } }} />,
    );
    const list = screen.getByRole("list", {
      name: "Ships lost in this battle",
    });
    expect(list.textContent).toContain("HMS Valiant");
    expect(list.textContent).toContain("sunk by torpedo");
    expect(screen.queryByText(/before ship records were kept/)).toBeNull();

    rerender(
      <BattleHistorySection
        state={{
          status: "ready",
          history: { battles: [entry({ lostShips: [] })] },
        }}
      />,
    );
    expect(screen.getByText(/before ship records were kept/)).toBeTruthy();
  });
});
