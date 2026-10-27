import type { DivisionView, UnassignedShipView } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import type { DivisionScreenProjection } from "../../../../shared/division-contract.js";
import {
  acceptDivisionCommand,
  canRemoveShip,
  costText,
  divisionTitle,
  groupUnassignedByArea,
  initialDivisionOrganizationState,
  projectDivisionOrganization,
  shipsAvailableToAdd,
} from "./division-organization-state.js";

const ship = (id: string, areaId: string, areaName: string): UnassignedShipView => ({
  shipId: id,
  name: `HMS ${id}`,
  classId: "c",
  areaId,
  areaName,
});

const division: DivisionView = {
  divisionId: "div_1",
  role: "CORE",
  formation: "LINE_AHEAD",
  flagshipShipId: "a",
  flagshipName: "HMS Alexandra",
  commanderVacant: true,
  experience: 20,
  cohesion: 30,
  areaId: "home",
  areaName: "English Home Waters",
  ships: [{ shipId: "a", name: "HMS Alexandra" }],
};

describe("division organization state", () => {
  it("starts empty with no pending work", () => {
    const s = initialDivisionOrganizationState();
    expect(s.divisions).toEqual([]);
    expect(s.pendingRequest).toBeNull();
    expect(s.notice).toBeNull();
  });

  it("projects the engine view's fields onto the state", () => {
    const projection = {
      revision: 3,
      month: { month: 1, year: 1880 },
      divisions: [division],
      unassignedShips: [ship("b", "home", "English Home Waters")],
      officers: [],
      roles: ["CORE"],
      formations: ["LINE_AHEAD"],
      maxShips: 5,
      maxDestroyers: 6,
      initial: { experience: 20, cohesion: 30 },
      penalties: {
        addShip: { experience: 5, cohesion: 10 },
        removeShip: { experience: 3, cohesion: 5 },
        changeFlagship: { experience: 5, cohesion: 10 },
        changeCommander: { experience: 5, cohesion: 10 },
        reorder: { experience: 0, cohesion: 3 },
        changeRole: { experience: 0, cohesion: 10 },
        changeFormation: { experience: 0, cohesion: 5 },
      },
    } satisfies DivisionScreenProjection;
    const patch = projectDivisionOrganization(projection);
    expect(patch.divisions).toHaveLength(1);
    expect(patch.penalties?.addShip.cohesion).toBe(10);
    expect(patch.roles).toEqual(["CORE"]);
  });

  it("says a queued command waits for the month to advance — never that it already happened", () => {
    for (const bodyType of [
      "CreateDivision",
      "AddShipToDivision",
      "RemoveShipFromDivision",
      "ChangeDivisionFlagship",
      "ReorderDivisionShips",
      "AssignOfficer",
      "RelieveOfficer",
      "DissolveDivision",
    ] as const) {
      const { notice } = acceptDivisionCommand({
        commandId: "c",
        bodyType,
        appliedOnNextTurn: true,
      });
      expect(notice).toMatch(/queued/);
      expect(notice).toMatch(/advance the month/);
    }
  });

  it("titles a division by role and flagship (divisions have no authored name)", () => {
    expect(divisionTitle(division)).toBe("Core division — HMS Alexandra");
  });
});

describe("shipsAvailableToAdd", () => {
  const unassigned = [
    ship("b", "home", "English Home Waters"),
    ship("c", "malta", "Malta"),
    ship("d", "home", "English Home Waters"),
  ];

  it("offers only ships in the division's own area", () => {
    expect(shipsAvailableToAdd(division, unassigned, 5).map((s) => s.shipId)).toEqual(["b", "d"]);
  });

  it("offers nothing once the division is full", () => {
    const full = {
      ...division,
      ships: Array.from({ length: 5 }, (_, i) => ({ shipId: `s${i}`, name: `S${i}` })),
    };
    expect(shipsAvailableToAdd(full, unassigned, 5)).toEqual([]);
  });
});

describe("groupUnassignedByArea", () => {
  it("groups by area and sorts areas by name", () => {
    const groups = groupUnassignedByArea([
      ship("c", "malta", "Malta"),
      ship("b", "home", "English Home Waters"),
      ship("d", "home", "English Home Waters"),
    ]);
    expect(groups.map((g) => [g.areaName, g.ships.map((s) => s.shipId)])).toEqual([
      ["English Home Waters", ["b", "d"]],
      ["Malta", ["c"]],
    ]);
  });

  it("is empty for no ships", () => {
    expect(groupUnassignedByArea([])).toEqual([]);
  });
});

describe("costText", () => {
  it("states both costs, one, or none", () => {
    expect(costText({ experience: 5, cohesion: 10 })).toBe("costs 5 experience and 10 cohesion");
    expect(costText({ experience: 0, cohesion: 3 })).toBe("costs 3 cohesion");
    expect(costText({ experience: 0, cohesion: 0 })).toBe("is free");
  });
});

describe("canRemoveShip", () => {
  it("never allows removing the only ship (that is Dissolve)", () => {
    expect(canRemoveShip(division)).toBe(false);
    expect(
      canRemoveShip({
        ships: [
          { shipId: "a", name: "A" },
          { shipId: "b", name: "B" },
        ],
      }),
    ).toBe(true);
  });
});
