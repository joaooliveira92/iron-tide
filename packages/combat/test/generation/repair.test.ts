//packages/combat/test/generation/repair.test.ts
import { describe, it, expect } from "vite-plus/test";
import {
  battleCompositionRepairV1,
  assertRepairable,
  REPAIR_MAX_PASSES,
  REPAIR_ORDER,
  REPAIR_MIN_PASSES,
  REPAIR_MAX_RANGE,
  BATTLE_COMPOSITION_REPAIR_V1,
} from "../../src/generation/repair.js";
import { BATTLE_COMPOSITION_IRREPARABLE } from "../../src/generation/reasonCodes.js";

describe("composition repair (AC-9)", () => {
  it("uses only permitted ops and at most 3 passes", () => {
    expect(BATTLE_COMPOSITION_REPAIR_V1).toBe("battle_composition_repair_v1");
    expect(REPAIR_MAX_PASSES).toBe(3);
    expect(REPAIR_MIN_PASSES).toBe(1);
    expect(REPAIR_MAX_RANGE).toBe(5);
    expect(REPAIR_ORDER).toEqual([
      "REMOVE_OPTIONAL_INELIGIBLE",
      "REPLACE_OPTIONAL",
      "SPLIT_PERMANENT_REMNANT",
      "FILL_OPTIONAL_COMMAND_VACANCY",
      "REDUCE_GENERATED_ELEMENTS",
      "CHANGE_OPTIONAL_FORMATION",
    ]);
  });

  it("removes optional ineligible assets and replaces with next legal candidate", () => {
    const r = battleCompositionRepairV1(["bad1", "bad2"], ["good1", "good2"]);
    expect(r.passes).toBe(2);
    expect(r.repaired).toBe(true);
    expect(r.actions[0]).toEqual({ kind: "REMOVE_OPTIONAL_INELIGIBLE", assetId: "bad1" });
    expect(r.actions[1]).toEqual({ kind: "REPLACE_OPTIONAL", assetId: "good1" });
  });

  it("irreparable after >3 passes -> BATTLE_COMPOSITION_IRREPARABLE", () => {
    expect(() => assertRepairable(4, {})).toThrow(new RegExp(BATTLE_COMPOSITION_IRREPARABLE));
    expect(() => assertRepairable(REPAIR_MAX_PASSES, {})).not.toThrow();
  });
});
