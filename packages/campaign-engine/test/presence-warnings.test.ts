import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import type { FleetState, Ship } from "@bluewave/campaign";
import type { CommandBody } from "@bluewave/commands";
import { buildPresenceWarnings, presenceOrderFromCommand } from "../src/presence-warnings.js";
import { fixtureDesign, fixtureNation, fixtureSnapshot } from "./fixtures.js";

const RULES = {
  requiredTonsPerPossessionWeight: 100,
  noPortValueWeight: 2,
  crampedOrShortRangeCountBp: 5_000,
};

function ship(id: string, areaId: string): Ship {
  return {
    id,
    name: id,
    classId: id,
    nationId: "uk",
    locationAreaId: areaId,
    designVersionId: "d-plain",
    hitPoints: SafeInt(10),
    maxHitPoints: SafeInt(10),
    speed: SafeInt(1),
    firepower: SafeInt(1),
    armor: SafeInt(1),
    isUnderConstruction: false,
    constructionProgress: SafeInt(0),
    constructionTotalWork: SafeInt(0),
    readiness: "ACTIVE",
    crewQuality: SafeInt(100),
  };
}

function scenario() {
  const fleet: FleetState = {
    id: "f1",
    nationId: "uk",
    name: "f1",
    ships: [ship("s1", "india")],
    locationAreaId: "india",
  };
  return fixtureSnapshot([fixtureNation({ id: "uk", fleets: [fleet] })], [], {
    world: {
      areas: [
        { id: "india", name: "India", type: "sea" },
        { id: "malta", name: "Malta", type: "sea" },
      ],
      routes: [{ id: "r1", from: "india", to: "malta", type: "sea", distance: SafeInt(1) }],
      ports: [],
      possessions: [{ id: "p1", nationId: "uk", areaId: "india" }],
    },
    designs: new Map([
      ["d-plain", fixtureDesign("uk", "d-plain", { normalizedDisplacementKg: SafeInt(4_000_000) })],
    ]),
  });
}

const MONTH = { month: 3, year: 1880 };

describe("presenceOrderFromCommand", () => {
  it("maps the five presence-relevant commands and ignores others and other nations", () => {
    const move: CommandBody = { type: "MoveFleet", nationId: "uk", fleetId: "f1", toAreaId: "x" };
    expect(presenceOrderFromCommand(move, "uk")).toEqual({
      type: "MOVE_FLEET",
      fleetId: "f1",
      toAreaId: "x",
    });
    expect(presenceOrderFromCommand(move, "fra")).toBeUndefined();
    expect(
      presenceOrderFromCommand(
        { type: "SetShipReadiness", nationId: "uk", shipIds: ["s1"], readiness: "RESERVE" },
        "uk",
      ),
    ).toEqual({ type: "SET_READINESS", shipIds: ["s1"], readiness: "RESERVE" });
    expect(
      presenceOrderFromCommand(
        { type: "AssignForeignStation", nationId: "uk", shipIds: ["s1"] },
        "uk",
      ),
    ).toEqual({ type: "ASSIGN_STATION", shipIds: ["s1"] });
    expect(
      presenceOrderFromCommand(
        { type: "ClearForeignStation", nationId: "uk", shipIds: ["s1"] },
        "uk",
      ),
    ).toEqual({ type: "CLEAR_STATION", shipIds: ["s1"] });
    expect(
      presenceOrderFromCommand(
        { type: "HoldFleetExercise", nationId: "uk", shipIds: ["s1"] },
        "uk",
      ),
    ).toEqual({ type: "HOLD_EXERCISE", shipIds: ["s1"] });
  });
});

describe("buildPresenceWarnings", () => {
  it("returns nothing without queued presence orders", () => {
    expect(buildPresenceWarnings(scenario(), "uk", [], MONTH, RULES)).toEqual([]);
  });

  it("warns when a queued move leaves a possession area and names the command and explanation", () => {
    const warnings = buildPresenceWarnings(
      scenario(),
      "uk",
      [
        {
          commandId: "cmd-1",
          body: { type: "MoveFleet", nationId: "uk", fleetId: "f1", toAreaId: "malta" },
        },
      ],
      MONTH,
      RULES,
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({
      areaId: "india",
      requiredTons: 200,
      presentTonsBefore: 4000,
      presentTonsAfter: 0,
      shortfallBefore: 0,
      shortfallAfter: 200,
      causeCommandIds: ["cmd-1"],
    });
    expect(Number(warnings[0]!.explanation.result)).toBe(200);
  });

  it("stays quiet for a queued order that keeps the area covered", () => {
    expect(
      buildPresenceWarnings(
        scenario(),
        "uk",
        [
          {
            commandId: "cmd-2",
            body: {
              type: "SetShipReadiness",
              nationId: "uk",
              shipIds: ["s1"],
              readiness: "ACTIVE",
            },
          },
        ],
        MONTH,
        RULES,
      ),
    ).toEqual([]);
  });
});
