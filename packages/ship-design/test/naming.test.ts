// SB3-R13 (DESIGN-23 section 4): the ship-name allocator is deterministic, pool-driven and ambient-randomness-free.
import { describe, expect, it } from "vite-plus/test";
import { allocateShipNames, PLACEHOLDER_NAME_POOL_ID, type ShipNamePool } from "../src/index.js";

const pool = (stems: readonly string[]): ShipNamePool => ({ poolId: "name_pool:uk:B", stems });

describe("allocateShipNames is a deterministic pool allocator (SB3-R13)", () => {
  it("draws stems in authored order and records the source pool and pool ordinal", () => {
    const result = allocateShipNames({
      pool: pool(["Devastation", "Thunderer", "Dreadnought"]),
      count: 2,
      taken: [],
      placeholderStem: "Class X",
    });
    expect(result.exhausted).toBe(false);
    expect(result.allocations).toEqual([
      { name: "Devastation", pool: "name_pool:uk:B", ordinal: 1 },
      { name: "Thunderer", pool: "name_pool:uk:B", ordinal: 2 },
    ]);
  });

  it("skips names already taken (existing ships, class names, earlier batches)", () => {
    const result = allocateShipNames({
      pool: pool(["Devastation", "Thunderer", "Dreadnought"]),
      count: 2,
      taken: ["Thunderer"],
      placeholderStem: "Class X",
    });
    expect(result.allocations.map((a) => a.name)).toEqual(["Devastation", "Dreadnought"]);
    expect(result.exhausted).toBe(false);
  });

  it("resolves a collision with a numbered variant and marks the pool exhausted", () => {
    const result = allocateShipNames({
      pool: pool(["Devastation", "Thunderer"]),
      count: 3,
      taken: [],
      placeholderStem: "Class X",
    });
    expect(result.exhausted).toBe(true);
    expect(result.allocations).toEqual([
      { name: "Devastation", pool: "name_pool:uk:B", ordinal: 1 },
      { name: "Thunderer", pool: "name_pool:uk:B", ordinal: 2 },
      // Every base is taken: the earliest stem's first free numbered variant.
      { name: "Devastation 2", pool: "name_pool:uk:B", ordinal: 1 },
    ]);
  });

  it("numbers past an already-taken variant rather than reusing it", () => {
    const result = allocateShipNames({
      pool: pool(["Devastation"]),
      count: 2,
      taken: ["Devastation", "Devastation 2"],
      placeholderStem: "Class X",
    });
    expect(result.allocations.map((a) => a.name)).toEqual(["Devastation 3", "Devastation 4"]);
  });

  it("falls back to a clearly marked placeholder when the profile is silent for the type", () => {
    const result = allocateShipNames({
      pool: pool([]),
      count: 2,
      taken: [],
      placeholderStem: "Class X",
    });
    expect(result.exhausted).toBe(true);
    expect(result.allocations).toEqual([
      { name: "Class X", pool: PLACEHOLDER_NAME_POOL_ID, ordinal: 0 },
      { name: "Class X 2", pool: PLACEHOLDER_NAME_POOL_ID, ordinal: 0 },
    ]);
  });

  it("does not reuse a placeholder name already taken", () => {
    const result = allocateShipNames({
      pool: pool([]),
      count: 1,
      taken: ["Class X"],
      placeholderStem: "Class X",
    });
    expect(result.allocations[0]!.name).toBe("Class X 2");
  });

  it("allocates nothing for a zero count and draws no ambient randomness", () => {
    const result = allocateShipNames({
      pool: pool(["A"]),
      count: 0,
      taken: [],
      placeholderStem: "X",
    });
    expect(result.allocations).toEqual([]);
    expect(result.exhausted).toBe(false);
  });

  it("same batch and pool produce the same names across independent calls", () => {
    const input = { pool: pool(["A", "B", "C"]), count: 5, taken: ["B"], placeholderStem: "X" };
    const first = allocateShipNames(input);
    const second = allocateShipNames({ ...input, taken: [...input.taken] });
    expect(second).toEqual(first);
  });
});
