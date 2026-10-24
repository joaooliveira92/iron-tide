import { describe, expect, it } from "vite-plus/test";
import { parseMonthInput } from "./monthInput.js";

const valid = {
  schema: "month_input_v1",
  commands: [],
  commandOutcomes: [],
  shipBuildingContentHash: "ship-hash",
};

describe("month input decoding", () => {
  it("accepts the modelled shape", () => {
    expect(parseMonthInput(valid)).not.toBeNull();
  });

  it("rejects an unmodelled top-level key instead of dropping it", () => {
    expect(parseMonthInput({ ...valid, surprise: true })).toBeNull();
  });
});
