/* @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { DiplomacyScreenState } from "./diplomacy-screen-state.js";
import {
  diplomacyBeginAction,
  diplomacyBeginSubmit,
  diplomacyLoadSuccess,
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
  return diplomacyLoadSuccess(projection as never);
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
    loadError: null,
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
  hookMocks.stateFn.mockReset();
  hookMocks.stateFn.mockImplementation(() => makeLoaded());
  hookMocks.setRowAction.mockClear();
  hookMocks.setPeaceAction.mockClear();
  hookMocks.submit.mockClear();
});

const rail = () => within(screen.getByRole("list", { name: "Relations by threat" }));
const openTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name }));
const selectNation = (name: RegExp) => fireEvent.click(rail().getByRole("button", { name }));
const dossier = () => within(screen.getByTestId("nation-dossier"));

describe("DiplomacyScreen", () => {
  it("renders the real projection: threat-sorted rail, war front with scores and blockades", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);

    const ids = rail()
      .getAllByRole("button")
      .map((button) => button.getAttribute("data-nation-id"));
    expect(ids).toEqual(["france", "germany"]);
    expect(rail().getByRole("button", { name: /^France, At war/ })).not.toBeNull();
    expect(
      rail().getByRole("button", { name: /^Germany, Neutral, tension 5 of 10/ }),
    ).not.toBeNull();
    expect(rail().getByText("NAP, Neutral")).not.toBeNull();

    const front = within(screen.getByTestId("war-front"));
    expect(screen.queryByText("war_uk_france_1880-01")).toBeNull();
    expect(front.getByText("Active")).not.toBeNull();
    expect(front.getByText("Attacker, you")).not.toBeNull();
    expect(front.getByText("You are ahead")).not.toBeNull();
    expect(front.getByRole("button", { name: "Accept peace" })).toBeTruthy();
    expect(front.getByText("Gibraltar")).not.toBeNull();
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
    openTab("Not modelled");
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
    openTab("Not modelled");
    const panel = screen.getByTestId("intel-deferred");
    expect(panel.textContent).toContain("not yet modelled by the engine");
    for (const name of [
      "Intelligence level per nation",
      "Intelligence spending",
      "Intelligence reports",
    ]) {
      expect(panel.textContent).toContain(name);
    }
    expect(rail().getByRole("button", { name: /^France/ })).not.toBeNull();
  });

  it("renders honest empty states (no wars / no blockades) without fabrication", () => {
    hookMocks.stateFn.mockReturnValue(
      makeLoaded({
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
      }),
    );

    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getByText("No wars yet")).not.toBeNull();
    expect(screen.getAllByText("No blockades yet").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("war-front")).toBeNull();
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

  it("displays the honest queued copy on the loaded screen", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getAllByText(/next turn advance/).length).toBeGreaterThanOrEqual(1);
  });

  it("labels a drafted war declaration as such and warns it cannot be cancelled", () => {
    hookMocks.stateFn.mockReturnValue(diplomacyBeginAction(makeLoaded(), "germany", "DeclareWar"));
    render(<DiplomacyScreen sessionId="ses-1" />);
    const bar = within(screen.getByRole("group", { name: "Orders" }));
    expect(bar.getByText("Declare war with Germany")).not.toBeNull();
    expect(bar.getByRole("button", { name: "Declare war" })).not.toBeNull();
    expect(bar.getByRole("alert").textContent).toMatch(/cannot be cancelled/);
    expect(bar.queryByRole("button", { name: "Submit command" })).toBeNull();
  });

  it("keeps the generic submit label for non-war drafts", () => {
    hookMocks.stateFn.mockReturnValue(
      diplomacyBeginAction(makeLoaded(), "germany", "FormNonAggressionPact"),
    );
    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getByRole("button", { name: "Submit command" })).not.toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("disables submit and says so while nothing is drafted", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getByText(/Nothing drafted/)).not.toBeNull();
    expect(screen.getByRole("button", { name: "Submit command" }).hasAttribute("disabled")).toBe(
      true,
    );
  });

  it("opens on the overview and opens a dossier on selection from the rail", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getByTestId("overview-summary")).not.toBeNull();
    expect(screen.queryByTestId("nation-dossier")).toBeNull();

    selectNation(/^Germany/);
    expect(dossier().getByRole("heading", { name: "Germany" })).not.toBeNull();
    expect(dossier().getByRole("button", { name: /Declare war/ })).not.toBeNull();
    expect(dossier().getByRole("button", { name: /Break NAP/ })).not.toBeNull();

    selectNation(/^France/);
    expect(dossier().getByRole("heading", { name: "France" })).not.toBeNull();
    expect(dossier().queryByRole("button", { name: /Declare war/ })).toBeNull();
    expect(dossier().getByRole("button", { name: /Blockade/ })).not.toBeNull();
  });

  it("opens a dossier from a contact on the plot", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    const plot = within(screen.getByTestId("tension-plot"));
    fireEvent.click(plot.getByRole("button", { name: /^Germany, Neutral/ }));
    expect(dossier().getByRole("heading", { name: "Germany" })).not.toBeNull();
  });

  it("switches between the plot and the bands view", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    expect(screen.getByTestId("tension-plot")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Bands" }));
    expect(screen.queryByTestId("tension-plot")).toBeNull();
    const bands = within(screen.getByTestId("tension-bands"));
    fireEvent.click(bands.getByRole("button", { name: /^Germany/ }));
    expect(dossier().getByRole("heading", { name: "Germany" })).not.toBeNull();
  });

  it("drafts the clicked action for the selected nation", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    selectNation(/^Germany/);
    fireEvent.click(dossier().getByRole("button", { name: /Form alliance/ }));
    expect(hookMocks.setRowAction).toHaveBeenCalledWith("germany", "FormAlliance");
  });

  it("accepting peace drafts it and brings that enemy's dossier forward", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    selectNation(/^Germany/);
    fireEvent.click(
      within(screen.getByTestId("war-front")).getByRole("button", { name: "Accept peace" }),
    );
    expect(hookMocks.setPeaceAction).toHaveBeenCalledWith("war_uk_france_1880-01");
    expect(dossier().getByRole("heading", { name: "France" })).not.toBeNull();
  });

  it("moves the selection with the arrow keys and returns to the overview on Escape", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    const list = screen.getByRole("list", { name: "Relations by threat" });
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(dossier().getByRole("heading", { name: "France" })).not.toBeNull();
    fireEvent.keyDown(list, { key: "ArrowDown" });
    expect(dossier().getByRole("heading", { name: "Germany" })).not.toBeNull();
    fireEvent.keyDown(list, { key: "Escape" });
    expect(screen.getByTestId("overview-summary")).not.toBeNull();
  });

  it("summarises the posture in the overview and the status bar", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    const summary = within(screen.getByTestId("overview-summary"));
    expect(summary.getByRole("heading", { name: "At war" })).not.toBeNull();
    const status = within(screen.getByRole("region", { name: "Foreign status" }));
    expect(status.getByText("Standing")).not.toBeNull();
    expect(status.getByText("Closest to war")).not.toBeNull();
    expect(status.getByText("none queued")).not.toBeNull();
  });

  it("shows only the battles against the selected nation in its dossier", () => {
    const battle = (battleId: string, defenderName: string) => ({
      battleId,
      sequence: 1,
      areaId: "a",
      areaName: "Gibraltar",
      attackerId: "uk",
      attackerName: "your nation",
      defenderId: "x",
      defenderName,
      involvesPlayer: true,
      outcomeForPlayer: "won",
      playerLossCount: 0,
      enemyLossCount: 1,
      lostShipIds: [],
      lostShips: [],
    });
    battleHistoryMock.state = {
      status: "ready",
      history: { battles: [battle("b1", "France"), battle("b2", "Germany")] },
    };
    try {
      render(<DiplomacyScreen sessionId="ses-1" />);
      selectNation(/^France/);
      openTab("Battles");
      expect(screen.getByText(/your nation vs France/)).not.toBeNull();
      expect(screen.queryByText(/your nation vs Germany/)).toBeNull();
    } finally {
      battleHistoryMock.state = { status: "ready", history: { battles: [] } };
    }
  });

  it("shows the battle history, with an honest empty state", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
    openTab("Battles");
    expect(screen.getByText("No battles fought yet")).not.toBeNull();
  });

  it("hides engine metadata outside debug builds", () => {
    render(<DiplomacyScreen sessionId="ses-1" />);
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
