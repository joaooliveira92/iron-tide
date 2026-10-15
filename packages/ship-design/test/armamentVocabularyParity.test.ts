// Preserved from the deleted `armamentAdapter.test.ts` (ship-part-model ticket 15): it guards a
// cross-package invariant of the canonical vocabularies, not any adapter behaviour. The adapter
// that motivated the pairing is gone, but `@bluewave/armament` must keep the same closed
// source-status/confidence/provenance vocabularies as the national-profile model until the
// armament and part models converge (ticket 17).
import { describe, expect, it } from "vite-plus/test";
import {
  ARMAMENT_CONFIDENCE_LEVELS,
  ARMAMENT_PROVENANCE_KINDS,
  ARMAMENT_SOURCE_STATUSES,
} from "@bluewave/armament";
import { CONFIDENCE_LEVELS, PROVENANCE_KINDS, SOURCE_STATUSES } from "../src/index.js";

describe("armament provenance vocabulary parity", () => {
  it("keeps the armament package vocabulary identical to the canonical national-profile vocabulary", () => {
    expect([...ARMAMENT_SOURCE_STATUSES]).toEqual([...SOURCE_STATUSES]);
    expect([...ARMAMENT_CONFIDENCE_LEVELS]).toEqual([...CONFIDENCE_LEVELS]);
    expect([...ARMAMENT_PROVENANCE_KINDS]).toEqual([...PROVENANCE_KINDS]);
  });
});
