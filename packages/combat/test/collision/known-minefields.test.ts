import { describe, expect, it } from "vite-plus/test";
import {
  TACTICAL_MINEFIELD_RECORD_INVALID,
  decodeTacticalMinefieldRecords,
  minefieldsOfSide,
  projectKnownMinefields,
} from "@bluewave/combat/collision";

const raw = [
  { id: "mf-b", xM: 900, yM: 40, radiusM: 120, knownToSideIds: ["ATTACKER"], pressureBp: 7_000 },
  {
    id: "mf-a",
    xM: 300,
    yM: -20,
    radiusM: 80,
    knownToSideIds: ["ATTACKER", "DEFENDER"],
    pressureBp: 2_500,
  },
  { id: "mf-hidden", xM: 50, yM: 50, radiusM: 60, knownToSideIds: [], pressureBp: 9_900 },
];

describe("tactical minefield records", () => {
  it("decodes strictly", () => {
    expect(decodeTacticalMinefieldRecords(raw)).toHaveLength(3);
    expect(() => decodeTacticalMinefieldRecords([{ ...raw[0], extra: 1 }])).toThrow(
      TACTICAL_MINEFIELD_RECORD_INVALID,
    );
    expect(() => decodeTacticalMinefieldRecords([{ ...raw[0], radiusM: 0 }])).toThrow(
      TACTICAL_MINEFIELD_RECORD_INVALID,
    );
    expect(() => decodeTacticalMinefieldRecords([{ ...raw[0], pressureBp: 1.5 }])).toThrow(
      TACTICAL_MINEFIELD_RECORD_INVALID,
    );
  });

  it("rejects duplicate ids", () => {
    expect(() => decodeTacticalMinefieldRecords([raw[0], raw[0]])).toThrow(
      TACTICAL_MINEFIELD_RECORD_INVALID,
    );
  });
});

describe("known minefield projection", () => {
  const records = decodeTacticalMinefieldRecords(raw);

  it("gives each side only the fields it knows, in id order, as bare zones", () => {
    const bySide = projectKnownMinefields(records, ["ATTACKER", "DEFENDER"]);
    expect(bySide["ATTACKER"]).toEqual({
      minefields: [
        { id: "mf-a", xM: 300, yM: -20, radiusM: 80 },
        { id: "mf-b", xM: 900, yM: 40, radiusM: 120 },
      ],
    });
    expect(bySide["DEFENDER"]).toEqual({
      minefields: [{ id: "mf-a", xM: 300, yM: -20, radiusM: 80 }],
    });
  });

  it("never carries an unknown field to any side", () => {
    const bySide = projectKnownMinefields(records, ["ATTACKER", "DEFENDER", "NEUTRAL"]);
    const everything = JSON.stringify(bySide);
    expect(everything).not.toContain("mf-hidden");
    expect(bySide["NEUTRAL"]).toBeUndefined();
    expect(minefieldsOfSide(bySide, "NEUTRAL")).toEqual({});
  });

  it("ignores knowledge for sides that are not in the battle", () => {
    const bySide = projectKnownMinefields(records, ["DEFENDER"]);
    expect(Object.keys(bySide)).toEqual(["DEFENDER"]);
  });

  it("makes true pressure unobservable from the zones", () => {
    const flat = decodeTacticalMinefieldRecords(raw.map((r) => ({ ...r, pressureBp: 0 })));
    const loud = decodeTacticalMinefieldRecords(raw.map((r) => ({ ...r, pressureBp: 10_000 })));
    const sides = ["ATTACKER", "DEFENDER"];
    expect(projectKnownMinefields(flat, sides)).toEqual(projectKnownMinefields(loud, sides));
    expect(JSON.stringify(projectKnownMinefields(records, sides))).not.toMatch(/pressure/i);
  });

  it("does not depend on record order", () => {
    const sides = ["ATTACKER", "DEFENDER"];
    expect(projectKnownMinefields([...records].reverse(), sides)).toEqual(
      projectKnownMinefields(records, sides),
    );
  });

  it("looks up a side without leaking another side's view", () => {
    const bySide = projectKnownMinefields(records, ["ATTACKER", "DEFENDER"]);
    expect(minefieldsOfSide(bySide, "DEFENDER").minefields?.minefields).toHaveLength(1);
    expect(minefieldsOfSide(undefined, "DEFENDER")).toEqual({});
    expect(minefieldsOfSide(bySide, "constructor")).toEqual({});
  });
});
