import { describe, expect, it } from "vite-plus/test";
import {
  nameGroups,
  namePoolFor,
  suggestClassName,
  type NamingProfile,
} from "./class-name-suggestions.js";

const profile: NamingProfile = {
  namingPolicy: {
    stems: { B: ["Devastation", "Thunderer"], DD: ["Havock"], CL: [] },
    convention: {},
  },
};

describe("namePoolFor", () => {
  it("returns the nation's stems for the type, and nothing when the profile is silent", () => {
    expect(namePoolFor(profile, "B")).toEqual(["Devastation", "Thunderer"]);
    expect(namePoolFor(profile, "CA")).toEqual([]);
    expect(namePoolFor(profile, "not-a-type")).toEqual([]);
    expect(namePoolFor(undefined, "B")).toEqual([]);
  });
});

describe("nameGroups", () => {
  it("puts the design's own type first, then the others, and drops empty types", () => {
    const groups = nameGroups(profile, "DD");
    expect(groups.map((g) => g.type)).toEqual(["DD", "B"]);
    expect(groups[0]!.current).toBe(true);
    expect(groups[1]!.current).toBe(false);
    expect(groups[0]!.label).toMatch(/^DD · /);
    expect(nameGroups(undefined, "DD")).toEqual([]);
  });
});

describe("suggestClassName", () => {
  const pool = ["A", "B", "C"];
  it("starts at the first name and walks the pool in order, wrapping", () => {
    const one = suggestClassName(pool, "", 0)!;
    expect(one).toEqual({ name: "A", cursor: 1 });
    const two = suggestClassName(pool, "A", one.cursor)!;
    expect(two.name).toBe("B");
    const three = suggestClassName(pool, "B", two.cursor)!;
    const four = suggestClassName(pool, "C", three.cursor)!;
    expect(four.name).toBe("A");
  });
  it("never suggests the name already in the field, ignoring case and spacing", () => {
    expect(suggestClassName(pool, " a ", 0)!.name).toBe("B");
  });
  it("is null for an empty pool and repeats a one-name pool", () => {
    expect(suggestClassName([], "", 0)).toBeNull();
    expect(suggestClassName(["Solo"], "Solo", 0)!.name).toBe("Solo");
  });
  it("is deterministic", () => {
    expect(suggestClassName(pool, "", 2)).toEqual(suggestClassName(pool, "", 2));
  });
});
