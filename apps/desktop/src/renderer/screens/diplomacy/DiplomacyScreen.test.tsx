/* @vitest-environment jsdom */
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DiplomacyScreenState } from "./diplomacy-screen-state.js";
import {
  diplomacyBeginAction,
  diplomacyBeginSubmit,
  diplomacyLoadSuccess,
  initialDiplomacyScreenState,
  diplomacySubmitRejected,
} from "./diplomacy-screen-state.js";
import { DiplomacyScreen } from "./DiplomacyScreen.js";

const fixtureProjection = {
  playerNationId: "uk",
  knownNations: [
    { nationId: "france", name: "France" },
    { nationId: "germany", name: "Germany" },
  ],
  relations: [
    {
      nationAId: "uk",
      nationBId: "france",
      relation: "at_war",
      tension: 9,
      nap: false,
      since: "1880-01",
      partnerNationId: "france",
      partnerName: "France",
    },
    {
      nationAId: "uk",
      nationBId: "germany",
      relation: "neutral",
      tension: 5,
      nap: true,
      since: "1880-01",
      partnerNationId: "germany",
      partnerName: "Germany",
    },
  ],
  wars: [
    {
      warId: "war_uk_france_1880-01",
      attackerSideId: "side_uk",
      defenderSideId: "side_france",
      attackerSideMembers: ["uk"],
      defenderSideMembers: ["france"],
      attackerWarScore: 3,
      defenderWarScore: 1,
      attackerId: "uk",
      defenderId: "france",
      startDate: "1880-01",
      status: "ACTIVE",
      playerSide: "attacker",
    },
  ],
  blockades: [
    {
      blockaderId: "uk",
      blockadedNationId: "france",
      areaId: "med_gibraltar",
      establishedMonth: "1880-02",
    },
  ],
  areas: [{ areaId: "med_gibraltar", name: "Gibraltar" }],
  revision: 1,
  month: { month: 2, year: 1880 },
};

function makeLoaded(overrides = {}): DiplomacyScreenState {
  const projection = { ...fixtureProjection, ...overrides };
  return diplomacyLoadSuccess(initialDiplomacyScreenState(), projection as never);
}

const hookMocks = vi.hoisted(() => {
  const stateFn = vi.fn(() => makeLoaded());
  const setRowAction = vi.fn();
  const setPeaceAction = vi.fn();
  const setBlockadeArea = vi.fn();
  const clearDraft = vi.fn();
  const submit = vi.fn();
  const reload = vi.fn().mockResolvedValue(undefined);
  const canSubmit = false;
  return {
    stateFn,
    setRowAction,
    setPeaceAction,
    setBlockadeArea,
    clearDraft,
    submit,
    reload,
    canSubmit,
  };
});

const ResizeObserverMock = vi.hoisted(
  () =>
    class implements ResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
);
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

const debugFlag = vi.hoisted(() => ({ on: false }));
vi.mock("../../shell/debug-flag.js", () => ({
  get DEBUG_MODE() {
    return debugFlag.on;
  },
}));

const battleHistoryMock = vi.hoisted(() => ({
  state: { status: "ready", history: { battles: [] } } as unknown,
}));
vi.mock("./hooks/useBattleHistory.js", () => ({
  useBattleHistory: () => battleHistoryMock.state,
}));

vi.mock("./hooks/useDiplomacyScreen.js", () => ({
  useDiplomacyScreen: (_sessionId: string) => ({
    state: hookMocks.stateFn(),
    setRowAction: hookMocks.setRowAction,
    setPeaceAction: hookMocks.setPeaceAction,
    setBlockadeArea: hookMocks.setBlockadeArea,
    clearDraft: hookMocks.clearDraft,
    submit: hookMocks.submit,
    reload: hookMocks.reload,
    canSubmit: hookMocks.canSubmit,
  }),
}));

afterEach(() => {
  cleanup();
  hookMocks.stateFn.mockClear();
  hookMocks.submit.mockClear();
});

describe("DiplomacyScreen", () => {
  it("renders the real projection: relations rows, war list with scores, blockades", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);

    expect(screen.getByText("At war")).not.toBeNull();
    expect(screen.getByText("tension 9/10")).not.toBeNull();
    expect(screen.getByText("NAP")).not.toBeNull();
    expect(screen.getByText("France", { selector: "span.text-sm.font-medium" })).not.toBeNull();
    expect(screen.getByText("Germany")).not.toBeNull();

    expect(screen.queryByText("war_uk_france_1880-01")).toBeNull();
    expect(screen.getByText("score 3:1")).not.toBeNull();
    expect(screen.getByText("you: attacker")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Accept peace" })).toBeTruthy();

    expect(screen.getByText("your nation → France")).not.toBeNull();
  });

  it("shows the raw war id only in a debug build", () => {
    debugFlag.on = true;
    try {
      render(<DiplomacyScreen sessionId="ses-1" />);
      expect(screen.getByText("war_uk_france_1880-01")).not.toBeNull();
    } finally {
      debugFlag.on = false;
    }
  });

  it("shows the war score as a player-vs-enemy bar derived from the engine's scores", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    const bar = screen.getByRole("img", { name: /War score:/ });
    expect(bar.getAttribute("aria-label")).toBe("War score: your nation 3, France 1");
  });

  it("lists the war-panel items the engine cannot supply as deferred, never as numbers", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    const panel = screen.getByTestId("war-deferred");
    expect(panel.textContent).toContain("Not yet modelled by the engine");
    for (const name of [
      "Trade protection",
      "Anti-submarine strength",
      "Submarine warfare policy",
      "Invasion planning",
    ]) {
      expect(panel.textContent).toContain(name);
    }
    expect(panel.textContent).not.toMatch(/\d+\s*(of|\/)\s*\d+/);
  });

  it("shows intelligence as not modelled, while relations stay real", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    const panel = screen.getByTestId("intel-deferred");
    expect(panel.textContent).toContain("not yet modelled by the engine");
    for (const name of [
      "Intelligence level per nation",
      "Intelligence spending",
      "Intelligence reports",
    ]) {
      expect(panel.textContent).toContain(name);
    }
    expect(screen.getByText("tension 9/10")).not.toBeNull();
  });

  it("renders honest empty states (no wars / no blockades) without fabrication", () => {
    const empty = makeLoaded({
      wars: [],
      blockades: [],
      relations: [
        {
          nationAId: "uk",
          nationBId: "germany",
          relation: "neutral",
          tension: 5,
          nap: false,
          since: "1880-01",
          partnerNationId: "germany",
          partnerName: "Germany",
        },
      ],
    });
    hookMocks.stateFn.mockReturnValue(empty);

    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getByText("No wars yet")).not.toBeNull();
    expect(screen.getByText("No blockades yet")).not.toBeNull();
  });

  it("shows an engine-code rejection notice verbatim when the submit was rejected", () => {
    const loaded = makeLoaded();
    let submitting = diplomacyBeginSubmit(
      diplomacyBeginAction(loaded, "france", "DeclareWar"),
      "req-1",
    );
    submitting = diplomacySubmitRejected(submitting, {
      reason: "BLOCKADE_NOT_AT_WAR",
      diagnostics: ["uk is not at war with france"],
    });
    hookMocks.stateFn.mockReturnValue(submitting);

    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getByText("Not applied")).not.toBeNull();
    expect(screen.getByText(/BLOCKADE_NOT_AT_WAR/)).not.toBeNull();
    expect(screen.getByText(/not at war/)).not.toBeNull();
  });

  it("displays the honest queued notice copy on the loaded screen", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getAllByText(/next turn advance/).length).toBeGreaterThanOrEqual(1);
  });

  it("labels a drafted war declaration as such and warns it cannot be cancelled", () => {
    hookMocks.stateFn.mockReturnValue(diplomacyBeginAction(makeLoaded(), "france", "DeclareWar"));
    render(<DiplomacyScreen sessionId="ses-1" />);
    const bar = within(screen.getByText("Command queue").closest("div.sticky") as HTMLElement);
    expect(bar.getByRole("button", { name: "Declare war" })).not.toBeNull();
    expect(bar.getByRole("alert").textContent).toMatch(/cannot be cancelled/);
    expect(bar.queryByRole("button", { name: "Submit command" })).toBeNull();
  });

  it("shows the battle history section, with an honest empty state", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getByText("Battle history")).not.toBeNull();
    expect(screen.getByText("No battles fought yet")).not.toBeNull();
  });

  it("keeps the generic submit label for non-war drafts", () => {
    hookMocks.stateFn.mockReturnValue(
      diplomacyBeginAction(makeLoaded(), "france", "FormNonAggressionPact"),
    );
    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getByRole("button", { name: "Submit command" })).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows a relation once (no duplicate badge) and hides engine metadata outside debug builds", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getAllByText("Neutral")).toHaveLength(1);
    expect(screen.queryByText("neutral")).toBeNull();
    expect(screen.queryByText(/^REV /)).toBeNull();
  });

  it("shows the revision badge in a debug build", () => {
    debugFlag.on = true;
    try {
      render(<DiplomacyScreen sessionId="ses-1" />);
      expect(screen.getByText(/^REV /)).not.toBeNull();
    } finally {
      debugFlag.on = false;
    }
  });
});
