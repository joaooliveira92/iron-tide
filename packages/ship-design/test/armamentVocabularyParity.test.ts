import { describe, expect, it } from "vite-plus/test";
import {
  ARMAMENT_CONFIDENCE_LEVELS,
  ARMAMENT_PROVENANCE_KINDS,
  ARMAMENT_SOURCE_STATUSES,
} from "@bluewave/armament";
import { CONFIDENCE_LEVELS, PROVENANCE_KINDS, SOURCE_STATUSES } from "../src/nationProfile.js";

describe("armament provenance vocabulary parity", () => {
  it("keeps the armament package vocabulary identical to the canonical national-profile vocabulary", () => {
    expect([...ARMAMENT_SOURCE_STATUSES]).toEqual([...SOURCE_STATUSES]);
    expect([...ARMAMENT_CONFIDENCE_LEVELS]).toEqual([...CONFIDENCE_LEVELS]);
    expect([...ARMAMENT_PROVENANCE_KINDS]).toEqual([...PROVENANCE_KINDS]);
  });
});
