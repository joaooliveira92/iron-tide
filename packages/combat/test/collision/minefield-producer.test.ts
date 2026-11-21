import { describe, expect, it } from "vite-plus/test";
import {
  TACTICAL_MINEFIELD_RECORD_INVALID,
  layTacticalMinefield,
  projectKnownMinefields,
  recordMinefieldSweep,
} from "@bluewave/combat/collision";

const lay = (pressureBp?: number) =>
  layTacticalMinefield({
    id: "mf-1",
    xM: 1_200,
    yM: -300,
    radiusM: 150,
    layerSideId: "ATTACKER",
    ...(pressureBp === undefined ? {} : { pressureBp }),
  });

describe("tactical minefield producer", () => {
  it("lays a record known only to the layer", () => {
    expect(lay(4_000)).toEqual({
      id: "mf-1",
      xM: 1_200,
      yM: -300,
      radiusM: 150,
      knownToSideIds: ["ATTACKER"],
      pressureBp: 4_000,
    });
    expect(projectKnownMinefields([lay()], ["ATTACKER", "DEFENDER"])).toEqual({
      ATTACKER: { minefields: [{ id: "mf-1", xM: 1_200, yM: -300, radiusM: 150 }] },
    });
  });

  it("keeps the radius independent of the pressure", () => {
    expect(lay(100).radiusM).toBe(lay(9_900).radiusM);
  });

  it("rejects a record the strict decoder would reject", () => {
    expect(() =>
      layTacticalMinefield({ id: "mf-1", xM: 0, yM: 0, radiusM: 0, layerSideId: "ATTACKER" }),
    ).toThrow(TACTICAL_MINEFIELD_RECORD_INVALID);
    expect(() =>
      layTacticalMinefield({ id: "mf-1", xM: 0.5, yM: 0, radiusM: 10, layerSideId: "ATTACKER" }),
    ).toThrow(TACTICAL_MINEFIELD_RECORD_INVALID);
    expect(() =>
      layTacticalMinefield({ id: "mf-1", xM: 0, yM: 0, radiusM: 10, layerSideId: "" }),
    ).toThrow(TACTICAL_MINEFIELD_RECORD_INVALID);
  });

  it("makes a swept field known to the sweeper without changing its geometry", () => {
    const swept = recordMinefieldSweep([lay(4_000)], "mf-1", "DEFENDER");
    expect(swept).toEqual([{ ...lay(4_000), knownToSideIds: ["ATTACKER", "DEFENDER"] }]);
    expect(projectKnownMinefields(swept, ["DEFENDER"])).toEqual({
      DEFENDER: { minefields: [{ id: "mf-1", xM: 1_200, yM: -300, radiusM: 150 }] },
    });
  });

  it("is idempotent for a side that already knows the field and leaves the input unchanged", () => {
    const original = [lay()];
    const once = recordMinefieldSweep(original, "mf-1", "ATTACKER");
    expect(once).toEqual(original);
    recordMinefieldSweep(original, "mf-1", "DEFENDER");
    expect(original[0]?.knownToSideIds).toEqual(["ATTACKER"]);
  });

  it("refuses a sweep of a field that was never laid", () => {
    expect(() => recordMinefieldSweep([lay()], "mf-missing", "DEFENDER")).toThrow(
      TACTICAL_MINEFIELD_RECORD_INVALID,
    );
  });
});
