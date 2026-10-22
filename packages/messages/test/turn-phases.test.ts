import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { TurnPhaseSchema, TURN_PHASES } from "../src/index.js";

describe("turn phase wire contract", () => {
  const decode = Schema.decodeUnknownSync(TurnPhaseSchema);

  it("accepts every phase of the shared contract", () => {
    for (const phase of TURN_PHASES) {
      expect(decode(phase)).toBe(phase);
    }
  });

  it("rejects a phase outside the shared contract", () => {
    expect(() => decode("unscheduled_phase")).toThrow();
  });
});
