import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { PlayerBattleDivisionOrderSchema } from "../shared/player-battle-schemas.js";
import { PlayerBattleSaveSchema } from "./playerBattleSidecar.js";

const stepWith = (speedPercent: number) => ({
  schemaVersion: "1.0.0",
  turnId: "t",
  battleId: "b",
  steps: [{ mode: "minute", divisions: [{ divisionId: "d", stance: "HOLD", speedPercent }] }],
});

describe("player battle save steps share the wire order schema", () => {
  const wire = Schema.decodeUnknownResult(PlayerBattleDivisionOrderSchema);
  const save = Schema.decodeUnknownResult(PlayerBattleSaveSchema, { onExcessProperty: "error" });

  it.each([0, 5, 100, -1, 101, 1.5, Number.NaN])("agrees on speedPercent %s", (speedPercent) => {
    const order = { divisionId: "d", stance: "HOLD", speedPercent };
    expect(Result.isSuccess(save(stepWith(speedPercent)))).toBe(Result.isSuccess(wire(order)));
  });

  it("rejects unknown stances and empty division ids in both", () => {
    expect(Result.isFailure(wire({ divisionId: "", stance: "HOLD", speedPercent: 1 }))).toBe(true);
    expect(Result.isFailure(wire({ divisionId: "d", stance: "RAM", speedPercent: 1 }))).toBe(true);
  });
});
