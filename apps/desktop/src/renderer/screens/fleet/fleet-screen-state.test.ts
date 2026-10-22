import { describe, expect, it } from "vite-plus/test";
import type { FleetScreenProjection } from "../../../shared/fleet-contract.js";
import type { FleetScreenState } from "./fleet-screen-state.js";
import {
  acceptMovementCommand,
  divisionPickerRows,
  initialFleetScreenState,
  movementCommandRows,
  nextDivisionSelection,
  orderStatusView,
  pendingRouteFor,
  projectFleetScreen,
  reachableAreas,
} from "./fleet-screen-state.js";
import {
  acceptCommand,
  applyProjection,
  applyRejection,
  applyTransportFailure,
  beginRequest,
} from "../../lib/command-screen-workflow.js";
import type { PreparedCommand, RequestKind } from "../../lib/command-screen-workflow.js";

const movementCommand = {
  commandId: "mcmd_1",
  divisionId: "Channel Squadron",
  fromAreaId: "area_northern_europe",
  toAreaId: "area_mediterranean",
  status: "submitted" as const,
  submittedAtRevision: 0,
};

const projection: FleetScreenProjection = {
  presence: { configured: false },
  overBaseShips: [],
  revision: 3,
  month: { year: 1900, month: 1 },
  playerNationId: "nation_uk",
  divisions: [
    {
      fleetName: "Home Fleet",
      divisionId: "Channel Squadron",
      areaId: "area_northern_europe",
      ships: [
        {
          shipId: "majestic",
          name: "HMS Majestic",
          designId: "design_majestic",
          status: "active",
          readiness: "ACTIVE",
          crewQuality: 100,
        },
      ],
    },
  ],
  areas: [
    { id: "area_northern_europe", name: "Northern Europe" },
    { id: "area_mediterranean", name: "Mediterranean" },
  ],
  areaEdges: [{ fromAreaId: "area_northern_europe", toAreaId: "area_mediterranean" }],
  ports: [
    {
      id: "port_portsmouth",
      name: "Portsmouth",
      areaId: "area_northern_europe",
      capacity: 40,
    },
  ],
  movementCommands: [movementCommand],
};

const workspace = {
  commands: [],
  movementCommands: [movementCommand],
  treasuryReserved: 0,
  capacityReserved: 0,
};

function loaded(): FleetScreenState {
  return applyProjection(initialFleetScreenState(), projection, projectFleetScreen(projection));
}

function prepared(kind: RequestKind, transportRequestId: string): PreparedCommand<unknown> {
  return {
    kind,
    context: { expectedRevision: 0, transportRequestId },
    send: async () => ({ outcome: "success", value: undefined, diagnostics: [] }),
  };
}

describe("fleet screen state", () => {
  it("maps the engine projection domain fields without deriving geography", () => {
    expect(projectFleetScreen(projection)).toEqual({
      month: projection.month,
      playerNationId: projection.playerNationId,
      divisions: projection.divisions,
      areas: projection.areas,
      areaEdges: projection.areaEdges,
      ports: projection.ports,
      movementCommands: projection.movementCommands,
    });
  });

  it("adopts the projection revision and clears every request marker", () => {
    const state = loaded();

    expect(state.revision).toBe(3);
    expect(state.divisions).toEqual(projection.divisions);
    expect(state.areas).toEqual(projection.areas);
    expect(state.areaEdges).toEqual(projection.areaEdges);
    expect(state.movementCommands).toEqual(projection.movementCommands);
    expect(state.pendingRequest).toBeNull();
    expect(state.requiresRefresh).toBe(false);
  });

  it("reports the submitted command as the pending route for a division", () => {
    const state = loaded();

    expect(pendingRouteFor(state.movementCommands, "Channel Squadron")).toEqual(movementCommand);
    expect(pendingRouteFor(state.movementCommands, "Mediterranean Squadron")).toBeNull();
  });

  it("ignores superseded and cancelled commands when reporting the pending route", () => {
    const state = applyProjection(
      initialFleetScreenState(),
      projection,
      projectFleetScreen({
        ...projection,
        movementCommands: [
          { ...movementCommand, status: "superseded" as const },
          {
            ...movementCommand,
            commandId: "mcmd_2",
            status: "cancelled" as const,
          },
        ],
      }),
    );

    expect(pendingRouteFor(state.movementCommands, "Channel Squadron")).toBeNull();
  });

  it("keeps the transport request identity of the request in flight", () => {
    const state = beginRequest(loaded(), prepared("submit", "tx-1"));

    expect(state.pendingRequest).toEqual({
      kind: "submit",
      transportRequestId: "tx-1",
    });
    expect(state.notice).toBeNull();
  });

  it("applies an accepted movement command from the engine response", () => {
    const { patch, notice } = acceptMovementCommand({
      command: movementCommand,
      workspace,
    });
    const state = acceptCommand(beginRequest(loaded(), prepared("submit", "tx-1")), patch, notice);

    expect(state.movementCommands).toEqual([movementCommand]);
    expect(state.pendingRequest).toBeNull();
    expect(state.notice).toContain("Order queued");
    expect(state.notice).not.toContain("mcmd_1");
  });

  it("shows the engine reason code and diagnostics for an illegal route", () => {
    const state = applyRejection(beginRequest(loaded(), prepared("submit", "tx-1")), {
      outcome: "rejected",
      reason: "VALIDATION_FAILED",
      diagnostics: ["NON_ADJACENT: No area edge connecting 'a' to 'b'"],
    });

    expect(state.notice).toContain("VALIDATION_FAILED");
    expect(state.notice).toContain("NON_ADJACENT");
    expect(state.requiresRefresh).toBe(false);
    expect(state.pendingRequest).toBeNull();
  });

  it("marks the projection as stale when the engine reports a newer revision", () => {
    const state = applyRejection(beginRequest(loaded(), prepared("replace", "tx-2")), {
      outcome: "rejected",
      reason: "STALE_REVISION",
      diagnostics: [],
      currentRevision: 5,
    });

    expect(state.revision).toBe(5);
    expect(state.requiresRefresh).toBe(true);
    expect(state.notice).toContain("current revision 5");
  });

  it("keeps the pending request after a transport failure so it can be retried", () => {
    const state = applyTransportFailure(
      beginRequest(loaded(), prepared("cancel", "tx-3")),
      "channel closed",
    );

    expect(state.pendingRequest).toEqual({
      kind: "cancel",
      transportRequestId: "tx-3",
    });
    expect(state.notice).toContain("TRANSPORT_FAILURE");
  });
});

describe("movementCommandRows", () => {
  it("resolves area and division ids to display names for the table", () => {
    const rows = movementCommandRows(
      [movementCommand],
      (areaId) => (areaId === "area_northern_europe" ? "Northern Europe" : "Mediterranean"),
      () => "Home Fleet",
    );
    expect(rows).toEqual([
      {
        commandId: "mcmd_1",
        divisionName: "Home Fleet",
        fromName: "Northern Europe",
        toName: "Mediterranean",
        status: "submitted",
        submittedAtRevision: 0,
      },
    ]);
  });
});

describe("divisionPickerRows", () => {
  it("resolves each division's area to a display name", () => {
    const rows = divisionPickerRows(projection.divisions, (areaId) =>
      areaId === "area_northern_europe" ? "Northern Europe" : areaId,
    );
    expect(rows).toEqual([
      {
        divisionId: "Channel Squadron",
        fleetName: "Home Fleet",
        areaName: "Northern Europe",
        ships: projection.divisions[0]?.ships,
      },
    ]);
  });
});

describe("orderStatusView", () => {
  const nameOfArea = (areaId: string) =>
    ({ area_northern_europe: "Northern Europe", area_mediterranean: "Mediterranean" })[areaId] ??
    areaId;

  it("is empty until a division is selected", () => {
    expect(orderStatusView(null, null, nameOfArea)).toEqual({
      divisionName: null,
      locationName: null,
      routeFromName: null,
      routeToName: null,
    });
  });

  it("names the division, its location, and its pending route", () => {
    const division = projection.divisions[0] ?? null;
    expect(orderStatusView(division, movementCommand, nameOfArea)).toEqual({
      divisionName: "Home Fleet",
      locationName: "Northern Europe",
      routeFromName: "Northern Europe",
      routeToName: "Mediterranean",
    });
    expect(orderStatusView(division, null, nameOfArea)).toEqual({
      divisionName: "Home Fleet",
      locationName: "Northern Europe",
      routeFromName: null,
      routeToName: null,
    });
  });
});

describe("nextDivisionSelection", () => {
  const divisions = [
    { divisionId: "d1", fleetName: "One", areaId: "a", ships: [] },
    { divisionId: "d2", fleetName: "Two", areaId: "a", ships: [] },
  ];

  it("keeps the selection while the division still exists", () => {
    expect(nextDivisionSelection("d2", divisions)).toBe("d2");
  });

  it("falls back to the first division when the selection is gone", () => {
    expect(nextDivisionSelection("gone", divisions)).toBe("d1");
    expect(nextDivisionSelection(null, divisions)).toBe("d1");
  });

  it("is null when there are no divisions", () => {
    expect(nextDivisionSelection("gone", [])).toBeNull();
  });
});

describe("reachableAreas", () => {
  const areas = [
    { id: "a", name: "Alpha" },
    { id: "b", name: "Bravo" },
    { id: "c", name: "Charlie" },
    { id: "d", name: "Delta" },
  ];
  const edges = [
    { fromAreaId: "a", toAreaId: "b" },
    { fromAreaId: "c", toAreaId: "a" },
    { fromAreaId: "b", toAreaId: "d" },
  ];
  it("lists areas one hop away in either direction, by name, excluding the origin", () => {
    expect(reachableAreas(areas, edges, "a").map((x) => x.id)).toEqual(["b", "c"]);
    expect(reachableAreas(areas, edges, "d").map((x) => x.id)).toEqual(["b"]);
    expect(reachableAreas(areas, edges, "zzz")).toEqual([]);
  });
});
