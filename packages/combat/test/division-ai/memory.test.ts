import { describe, expect, it } from "vite-plus/test";
import { isBluewaveError } from "@bluewave/contracts";
import {
  DIVISION_AI_MEMORY_INVALID,
  DIVISION_AI_MEMORY_VERSION,
  createDivisionAiMemory,
  decideDivisionOrders,
  decodeDivisionAiMemory,
  decodeDivisionAiView,
  hashDivisionAiMemory,
  parseDivisionAiMemory,
  serializeDivisionAiMemory,
  type DivisionAiMemory,
} from "@bluewave/combat/division-ai";
import { fullForce } from "./fixtures.js";

function failureCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (isBluewaveError(error)) return error.message;
    throw error;
  }
  return "no failure";
}

function populated(): DivisionAiMemory {
  return decideDivisionOrders(fullForce(), createDivisionAiMemory()).memory;
}

describe("division AI memory", () => {
  it("starts empty and versioned", () => {
    expect(createDivisionAiMemory()).toEqual({
      version: DIVISION_AI_MEMORY_VERSION,
      divisions: [],
    });
  });

  it("round-trips through the canonical serialisation", () => {
    const memory = populated();
    const parsed = parseDivisionAiMemory(serializeDivisionAiMemory(memory));
    expect(parsed).toEqual(memory);
    expect(hashDivisionAiMemory(parsed)).toBe(hashDivisionAiMemory(memory));
  });

  it("hashes identically regardless of key insertion order", () => {
    const memory = populated();
    const entry = memory.divisions[0]!;
    const shuffled = {
      divisions: [
        {
          waypointIndex: entry.waypointIndex,
          patrolAnchor: entry.patrolAnchor,
          attacking: entry.attacking,
          supportSide: entry.supportSide,
          modeSinceMinute: entry.modeSinceMinute,
          mode: entry.mode,
          divisionId: entry.divisionId,
        },
        ...memory.divisions.slice(1),
      ],
      version: memory.version,
    };
    expect(hashDivisionAiMemory(decodeDivisionAiMemory(shuffled))).toBe(
      hashDivisionAiMemory(memory),
    );
  });

  it("produces the same memory hash on repeated runs", () => {
    const first = decideDivisionOrders(fullForce(), createDivisionAiMemory());
    const second = decideDivisionOrders(fullForce(), createDivisionAiMemory());
    expect(hashDivisionAiMemory(first.memory)).toBe(hashDivisionAiMemory(second.memory));
    expect(first.orders).toEqual(second.orders);
  });

  it("rejects excess keys", () => {
    expect(failureCode(() => decodeDivisionAiMemory({ ...populated(), extra: 1 }))).toBe(
      DIVISION_AI_MEMORY_INVALID,
    );
    const memory = populated();
    const polluted = { ...memory, divisions: [{ ...memory.divisions[0]!, extra: 1 }] };
    expect(failureCode(() => decodeDivisionAiMemory(polluted))).toBe(DIVISION_AI_MEMORY_INVALID);
  });

  it("rejects unsorted or duplicate entries and out-of-range values", () => {
    const memory = populated();
    const reversed = { ...memory, divisions: [...memory.divisions].reverse() };
    expect(failureCode(() => decodeDivisionAiMemory(reversed))).toBe(DIVISION_AI_MEMORY_INVALID);
    const duplicated = { ...memory, divisions: [memory.divisions[0]!, memory.divisions[0]!] };
    expect(failureCode(() => decodeDivisionAiMemory(duplicated))).toBe(DIVISION_AI_MEMORY_INVALID);
    const badIndex = { ...memory, divisions: [{ ...memory.divisions[0]!, waypointIndex: 4 }] };
    expect(failureCode(() => decodeDivisionAiMemory(badIndex))).toBe(DIVISION_AI_MEMORY_INVALID);
  });

  it("prunes entries for divisions absent from the view", () => {
    const first = decideDivisionOrders(fullForce(), createDivisionAiMemory());
    const reduced = fullForce();
    const without = {
      ...reduced,
      divisions: reduced.divisions.filter((d) => d.divisionId !== "G-PATROL"),
    };
    const second = decideDivisionOrders(without, first.memory);
    expect(second.memory.divisions.map((entry) => entry.divisionId)).not.toContain("G-PATROL");
    expect(first.memory.divisions.map((entry) => entry.divisionId)).toContain("G-PATROL");
  });

  it("rejects a view whose lead is missing or ids repeat", () => {
    const base = fullForce();
    expect(failureCode(() => decodeDivisionAiView({ ...base, leadDivisionId: "NOPE" }))).toBe(
      "DIVISION_AI_VIEW_INVALID",
    );
    expect(
      failureCode(() =>
        decodeDivisionAiView({ ...base, divisions: [...base.divisions, base.divisions[1]!] }),
      ),
    ).toBe("DIVISION_AI_VIEW_INVALID");
    expect(failureCode(() => decodeDivisionAiView({ ...base, extra: true }))).toBe(
      "DIVISION_AI_VIEW_INVALID",
    );
  });
});
