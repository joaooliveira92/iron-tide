import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { BattleAbsenceSchema } from "../src/battleAbsence.js";
import { GATE_REASON_TAGS } from "../src/eligibility.js";

const decode = Schema.decodeUnknownResult(BattleAbsenceSchema, { onExcessProperty: "error" });

describe("BattleAbsenceSchema", () => {
  it("accepts every gate reason tag the evaluator can return", () => {
    for (const tag of GATE_REASON_TAGS) {
      expect(Result.isSuccess(decode({ shipId: "s-1", reasons: [tag] }))).toBe(true);
    }
  });

  it("rejects empty, unknown, over-keyed and short records", () => {
    for (const bad of [
      { shipId: "s-1", reasons: [] },
      { shipId: "s-1", reasons: ["CrewTooPoor"] },
      { shipId: "", reasons: ["Mothballed"] },
      { shipId: "s-1", reasons: ["Mothballed"], extra: 1 },
      { shipId: "s-1" },
    ]) {
      expect(Result.isFailure(decode(bad))).toBe(true);
    }
  });
});
