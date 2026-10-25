import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { DivisionView, UnassignedShipView } from "@bluewave/campaign-engine";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import { FleetOrganizationView } from "./FleetOrganizationSection.js";
import {
  initialDivisionOrganizationState,
  type DivisionOrganizationState,
} from "./division-organization-state.js";

const ship = (id: string, name: string, areaId: string, areaName: string): UnassignedShipView => ({
  shipId: id,
  name,
  classId: "c",
  areaId,
  areaName,
});

const division = (over: Partial<DivisionView> = {}): DivisionView => ({
  divisionId: "div_1",
  role: "CORE",
  formation: "LINE_AHEAD",
  flagshipShipId: "alex",
  flagshipName: "HMS Alexandra",
  commanderVacant: true,
  experience: 20,
  cohesion: 30,
  areaId: "home",
  areaName: "English Home Waters",
  ships: [
    { shipId: "alex", name: "HMS Alexandra" },
    { shipId: "dread", name: "HMS Dreadnought" },
  ],
  ...over,
});

function makeState(over: Partial<DivisionOrganizationState> = {}): DivisionOrganizationState {
  return {
    ...initialDivisionOrganizationState(),
    roles: ["INDEPENDENT", "CORE", "SUPPORT"],
    formations: ["LINE_AHEAD", "LINE_ABREAST"],
    maxShips: 5,
    initial: { experience: 20, cohesion: 30 },
    penalties: {
      addShip: { experience: 5, cohesion: 10 },
      removeShip: { experience: 3, cohesion: 5 },
      changeFlagship: { experience: 5, cohesion: 10 },
      reorder: { experience: 0, cohesion: 3 },
      changeRole: { experience: 0, cohesion: 10 },
      changeFormation: { experience: 0, cohesion: 5 },
    },
    ...over,
  };
}

function renderView(
  state: DivisionOrganizationState,
  over: {
    busy?: boolean;
    loadError?: string | null;
    outcomeUnknown?: boolean;
    send?: (command: unknown) => Promise<CommandOutcome>;
  } = {},
) {
  const send = over.send ?? vi.fn((): Promise<CommandOutcome> => Promise.resolve("accepted"));
  const onRetry = vi.fn();
  const onReload = vi.fn();
  render(
    <FleetOrganizationView
      state={state}
      loadError={over.loadError ?? null}
      busy={over.busy ?? false}
      outcomeUnknown={over.outcomeUnknown ?? false}
      onRetry={onRetry}
      onReload={onReload}
      send={send}
    />,
  );
  return { send, onRetry, onReload };
}

describe("FleetOrganizationView", () => {
  afterEach(cleanup);

  it("explains an empty fleet organization and offers to found a division", () => {
    renderView(
      makeState({
        unassignedShips: [
          ship("alex", "HMS Alexandra", "home", "English Home Waters"),
          ship("temp", "HMS Temeraire", "malta", "Malta"),
        ],
      }),
    );
    expect(screen.getByText(/No divisions yet/)).toBeTruthy();
    expect(screen.getByText("Create a division")).toBeTruthy();
    const flagship = screen.getByLabelText("Flagship") as HTMLSelectElement;
    expect([...flagship.querySelectorAll("optgroup")].map((g) => g.label)).toEqual([
      "English Home Waters",
      "Malta",
    ]);
    expect(screen.getByText(/starts at 20 experience and 30 cohesion/)).toBeTruthy();
  });

  it("creates a division from the chosen flagship, role and formation", () => {
    const { send } = renderView(
      makeState({
        unassignedShips: [
          ship("alex", "HMS Alexandra", "home", "English Home Waters"),
          ship("dread", "HMS Dreadnought", "home", "English Home Waters"),
        ],
      }),
    );
    fireEvent.change(screen.getByLabelText("Flagship"), { target: { value: "dread" } });
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "SUPPORT" } });
    fireEvent.change(screen.getByLabelText("Formation"), { target: { value: "LINE_ABREAST" } });
    fireEvent.click(screen.getByRole("button", { name: "Create division" }));
    expect(send).toHaveBeenCalledWith({
      type: "CreateDivision",
      flagshipShipId: "dread",
      role: "SUPPORT",
      formation: "LINE_ABREAST",
    });
  });

  it("defaults the role to Core and the first formation, without the player touching anything", () => {
    const { send } = renderView(
      makeState({
        unassignedShips: [ship("alex", "HMS Alexandra", "home", "English Home Waters")],
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Create division" }));
    expect(send).toHaveBeenCalledWith({
      type: "CreateDivision",
      flagshipShipId: "alex",
      role: "CORE",
      formation: "LINE_AHEAD",
    });
  });

  it("shows a division with its real stats, vacant commander and flagship", () => {
    renderView(makeState({ divisions: [division({ experience: 35, cohesion: 60 })] }));
    expect(screen.getByRole("heading", { name: "Core division — HMS Alexandra" })).toBeTruthy();
    expect(screen.getByText("English Home Waters")).toBeTruthy();
    expect(screen.getByText("Commander vacant")).toBeTruthy();
    expect(screen.getByText("35")).toBeTruthy();
    expect(screen.getByText("60")).toBeTruthy();
    const flagship = screen.getByRole("list", { name: /Flagship of Core division/ });
    expect(within(flagship).getByRole("img", { name: "Flagship" })).toBeTruthy();
    expect(within(flagship).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByText("HMS Dreadnought")).toBeTruthy();
  });

  it("reorders the non-flagship ships by keyboard and queues one command, keeping the flagship first", () => {
    const { send } = renderView(
      makeState({
        divisions: [
          division({
            ships: [
              { shipId: "alex", name: "HMS Alexandra" },
              { shipId: "dread", name: "HMS Dreadnought" },
              { shipId: "warspite", name: "HMS Warspite" },
            ],
          }),
        ],
      }),
    );
    expect(screen.queryByRole("button", { name: "Reorder HMS Alexandra" })).toBeNull();

    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder HMS Dreadnought" }), {
      key: "ArrowDown",
    });
    expect(screen.getByText(/Reordering ships costs 3 cohesion/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Apply order" }));
    expect(send).toHaveBeenLastCalledWith({
      type: "ReorderDivisionShips",
      divisionId: "div_1",
      shipOrder: ["alex", "warspite", "dread"],
    });
    expect(
      (screen.getByRole("button", { name: "Reorder queued" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("does not claim a reorder is queued when the engine rejects it", async () => {
    const send = vi.fn((): Promise<CommandOutcome> => Promise.resolve("rejected"));
    renderView(
      makeState({
        divisions: [
          division({
            ships: [
              { shipId: "alex", name: "HMS Alexandra" },
              { shipId: "dread", name: "HMS Dreadnought" },
              { shipId: "warspite", name: "HMS Warspite" },
            ],
          }),
        ],
      }),
      { send },
    );
    fireEvent.keyDown(screen.getByRole("button", { name: "Reorder HMS Dreadnought" }), {
      key: "ArrowDown",
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply order" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Apply order" })).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Reorder queued" })).toBeNull();
  });

  it("changes flagship and removes a non-flagship ship, stating each cost", () => {
    const { send } = renderView(makeState({ divisions: [division()] }));
    const makeFlagship = screen.getByRole("button", { name: "Make flagship" });
    expect(makeFlagship.getAttribute("title")).toBe(
      "Changing the flagship costs 5 experience and 10 cohesion",
    );
    fireEvent.click(makeFlagship);
    expect(send).toHaveBeenLastCalledWith({
      type: "ChangeDivisionFlagship",
      divisionId: "div_1",
      newFlagshipShipId: "dread",
    });

    const remove = screen.getAllByRole("button", { name: "Remove" });
    expect(remove[0]?.getAttribute("title")).toBe(
      "Removing a ship costs 3 experience and 5 cohesion",
    );
    fireEvent.click(remove[1]!);
    expect(send).toHaveBeenLastCalledWith({
      type: "RemoveShipFromDivision",
      divisionId: "div_1",
      shipId: "dread",
    });
  });

  it("changes only the doctrine the player edits, naming each cost and sending nothing until it differs", () => {
    const { send } = renderView(makeState({ divisions: [division()] }));
    const change = screen.getByRole("button", { name: "Change doctrine" }) as HTMLButtonElement;
    expect(change.disabled).toBe(true);
    expect(screen.getByText(/Changing the role costs 10 cohesion/)).toBeTruthy();
    expect(screen.getByText(/changing the formation costs 5 cohesion/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Role of/), { target: { value: "SUPPORT" } });
    expect(change.disabled).toBe(false);
    fireEvent.click(change);
    expect(send).toHaveBeenLastCalledWith({
      type: "ChangeDivisionDoctrine",
      divisionId: "div_1",
      role: "SUPPORT",
    });

    fireEvent.change(screen.getByLabelText(/^Formation of/), { target: { value: "LINE_ABREAST" } });
    fireEvent.click(change);
    expect(send).toHaveBeenLastCalledWith({
      type: "ChangeDivisionDoctrine",
      divisionId: "div_1",
      role: "SUPPORT",
      formation: "LINE_ABREAST",
    });
  });

  it("warns, without blocking anything, when a slower ship holds the division back", () => {
    renderView(
      makeState({
        divisions: [
          division({
            speedWarning: {
              slowestShipName: "HMS Dreadnought",
              slowestSpeed: 12,
              fastestSpeed: 17,
            },
          }),
        ],
      }),
    );
    expect(screen.getByRole("note").textContent).toBe(
      "HMS Dreadnought holds this division to speed 12; its fastest ship could make 17.",
    );
    expect(
      (screen.getByRole("button", { name: "Make flagship" }) as HTMLButtonElement).disabled,
    ).toBe(false);
  });

  it("shows no speed warning for a division of equal speed", () => {
    renderView(makeState({ divisions: [division()] }));
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("never offers to remove the only ship (Dissolve is the way to end a division)", () => {
    renderView(
      makeState({ divisions: [division({ ships: [{ shipId: "alex", name: "HMS Alexandra" }] })] }),
    );
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });

  it("offers only unassigned ships from the division's own area, and says what adding costs", () => {
    const { send } = renderView(
      makeState({
        divisions: [division()],
        unassignedShips: [
          ship("inflex", "HMS Inflexible", "home", "English Home Waters"),
          ship("temp", "HMS Temeraire", "malta", "Malta"),
        ],
      }),
    );
    const select = screen.getByLabelText(/Ship to add to Core division/) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(["HMS Inflexible"]);
    expect(screen.getByText(/Adding a ship costs 5 experience and 10 cohesion/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Add ship" }));
    expect(send).toHaveBeenCalledWith({
      type: "AddShipToDivision",
      divisionId: "div_1",
      shipId: "inflex",
    });
  });

  it("explains when there is nobody to add, or the division is full", () => {
    const { unmount } = render(
      <FleetOrganizationView
        state={makeState({
          divisions: [division()],
          unassignedShips: [ship("t", "T", "malta", "Malta")],
        })}
        loadError={null}
        busy={false}
        outcomeUnknown={false}
        onRetry={() => undefined}
        onReload={() => undefined}
        send={() => Promise.resolve("accepted" as CommandOutcome)}
      />,
    );
    expect(screen.getByText("No unassigned ships in English Home Waters to add.")).toBeTruthy();
    unmount();

    const full = division({
      ships: Array.from({ length: 5 }, (_, i) => ({ shipId: `s${i}`, name: `S${i}` })),
    });
    render(
      <FleetOrganizationView
        state={makeState({
          divisions: [full],
          unassignedShips: [ship("x", "X", "home", "English Home Waters")],
        })}
        loadError={null}
        busy={false}
        outcomeUnknown={false}
        onRetry={() => undefined}
        onReload={() => undefined}
        send={() => Promise.resolve("accepted" as CommandOutcome)}
      />,
    );
    expect(screen.getByText("Full (5 ships maximum)")).toBeTruthy();
  });

  it("asks before dissolving, then sends the command", () => {
    const { send } = renderView(makeState({ divisions: [division()] }));
    fireEvent.click(screen.getByRole("button", { name: "Dissolve division" }));
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByText(/Its ships return to the unassigned pool/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Dissolve" }));
    expect(send).toHaveBeenCalledWith({ type: "DissolveDivision", divisionId: "div_1" });
  });

  it("disables every action while a request is in flight", () => {
    renderView(
      makeState({
        divisions: [division()],
        unassignedShips: [ship("inflex", "HMS Inflexible", "home", "English Home Waters")],
      }),
      { busy: true },
    );
    for (const name of ["Create division", "Add ship", "Make flagship", "Dissolve division"]) {
      expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("shows the engine's verdict verbatim, a refresh when stale, and a retry when the outcome is unknown", () => {
    const { onReload, onRetry } = renderView(
      makeState({
        notice:
          "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE: Ship already in another division: alex\ncurrent revision 4",
        requiresRefresh: true,
      }),
      { outcomeUnknown: true, loadError: "TRANSPORT_FAILURE: down" },
    );
    expect(screen.getByRole("status").textContent).toContain(
      "DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE",
    );
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    fireEvent.click(screen.getByRole("button", { name: "Reload" }));
    expect(onReload).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("says plainly when there is nothing to organise", () => {
    renderView(makeState());
    expect(screen.getByText(/Every commissioned ship already belongs to a division/)).toBeTruthy();
  });
});
