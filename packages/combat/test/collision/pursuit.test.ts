import { describe, expect, it } from "vite-plus/test";
import { createContactTrack } from "@bluewave/combat/contact";
import type { TerrainView } from "@bluewave/combat/terrain";
import { decodeKnownMinefieldView } from "@bluewave/combat/collision";
import { pursuitOrders } from "../../src/battleResolution/pursuit.js";
import { buildTestState } from "../simulation/advance.test.js";

const M = 1_000_000;

const wall: TerrainView = {
  land: [
    {
      id: "wall",
      vertices: [
        { xM: 600, yM: -3000 },
        { xM: 700, yM: -3000 },
        { xM: 700, yM: 3000 },
        { xM: 600, yM: 3000 },
      ],
    },
  ],
  shallows: [],
  exclusions: [],
};

function input(terrain?: TerrainView) {
  const state = buildTestState();
  const movementStates = {
    a1: { ...state.movementStates!["a1"]!, position: [0, 0] as [number, number], heading: 0 },
    d1: { ...state.movementStates!["d1"]!, position: [3_000 * M, 0] as [number, number] },
  };
  const battleState = {
    ...state,
    movementStates,
    contacts: [
      createContactTrack({
        battleId: "b1",
        assetId: "d1",
        sideId: "DEFENDER",
        estimatedIdentity: "unknown",
        position: [3_000 * M, 0],
        course: 180,
        speedBpKnots: 10_000,
        observationTime: "1900-01-01T00:00:00.000Z",
        minute: 0,
      }),
    ],
  };
  return {
    battleId: "b1",
    battleState,
    damage: { battleId: "b1", targets: {} },
    units: state.units!,
    baseOrders: {
      a1: { orderedHeading: 0, orderedSpeedBp: 20_000 },
      d1: { orderedHeading: 180, orderedSpeedBp: 20_000 },
    },
    ...(terrain ? { terrain } : {}),
  };
}

describe("AI pursuit orders never steer into land", () => {
  it("heads straight at the contact when no terrain is supplied", () => {
    expect(pursuitOrders(input())["a1"]!.orderedHeading).toBe(0);
  });

  it("turns away from a wall inside the 60 second look-ahead", () => {
    const heading = pursuitOrders(input(wall))["a1"]!.orderedHeading;
    expect(heading).not.toBe(0);
  });
});

describe("AI pursuit orders never steer into a known minefield", () => {
  const view = decodeKnownMinefieldView({
    minefields: [{ id: "mf", xM: 650, yM: 0, radiusM: 100 }],
  });
  const minefieldsBySide = { ATTACKER: view };

  it("turns away from a known minefield inside the 60 second look-ahead", () => {
    const heading = pursuitOrders({ ...input(), minefieldsBySide })["a1"]!.orderedHeading;
    expect(heading).not.toBe(0);
  });

  it("keeps the pursuit heading when the minefield is behind the ship", () => {
    const behind = decodeKnownMinefieldView({
      minefields: [{ id: "mf", xM: -650, yM: 0, radiusM: 100 }],
    });
    expect(
      pursuitOrders({ ...input(), minefieldsBySide: { ATTACKER: behind } })["a1"]!.orderedHeading,
    ).toBe(0);
  });

  it("steers clear of land and minefields together", () => {
    const heading = pursuitOrders({ ...input(wall), minefieldsBySide })["a1"]!.orderedHeading;
    expect(heading).not.toBe(0);
  });

  it("never steers a side around a field only the other side knows", () => {
    const base = pursuitOrders(input());
    const ahead = decodeKnownMinefieldView({
      minefields: [{ id: "mf-d", xM: 2_750, yM: 0, radiusM: 100 }],
    });
    const otherKnows = pursuitOrders({ ...input(), minefieldsBySide: { DEFENDER: ahead } });
    expect(otherKnows["a1"]).toEqual(base["a1"]);
    expect(otherKnows["d1"]).not.toEqual(base["d1"]);
    const sameSide = pursuitOrders({ ...input(), minefieldsBySide: { ATTACKER: ahead } });
    expect(sameSide["d1"]).toEqual(base["d1"]);
  });
});
