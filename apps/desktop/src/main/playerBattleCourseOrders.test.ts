import { DIVISION_ORDER_MAX_HEADING_DEG, DIVISION_ORDER_MAX_KNOTS } from "@bluewave/combat/orders";
import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { MAX_COURSE_DEG, MAX_SPEED_KNOTS } from "../shared/player-battle-orders.js";
import {
  AdvancePlayerBattlePayloadSchema,
  PlayerBattleDivisionOrderSchema,
} from "../shared/player-battle-schemas.js";
import { PlayerBattleSaveSchema } from "./playerBattleSidecar.js";

const strict = { onExcessProperty: "error" } as const;
const decodeOrder = Schema.decodeUnknownResult(PlayerBattleDivisionOrderSchema, strict);
const decodeSave = Schema.decodeUnknownResult(PlayerBattleSaveSchema, strict);
const decodeAdvance = Schema.decodeUnknownResult(AdvancePlayerBattlePayloadSchema, strict);

const base = { divisionId: "d", stance: "ENGAGE", speedPercent: 100 } as const;

describe("course and knots orders on the wire", () => {
  it("keeps the shared bounds equal to the combat order bounds", () => {
    expect(MAX_COURSE_DEG).toBe(DIVISION_ORDER_MAX_HEADING_DEG);
    expect(MAX_SPEED_KNOTS).toBe(DIVISION_ORDER_MAX_KNOTS);
  });

  it("still decodes a stance and percent order saved before course orders existed", () => {
    const legacy = {
      schemaVersion: "1.0.0",
      turnId: "t",
      battleId: "b",
      steps: [
        { mode: "minute", divisions: [{ divisionId: "d", stance: "HOLD", speedPercent: 40 }] },
      ],
    };
    const decoded = decodeSave(legacy);
    expect(Result.isSuccess(decoded)).toBe(true);
    expect(Result.isSuccess(decodeOrder(legacy.steps[0]!.divisions[0]))).toBe(true);
  });

  it.each([0, 1, 90, 359])("accepts course %s", (courseDeg) => {
    expect(Result.isSuccess(decodeOrder({ ...base, courseDeg }))).toBe(true);
  });

  it.each([-1, 360, 1.5, Number.NaN, Number.POSITIVE_INFINITY, "90"])(
    "rejects course %s",
    (courseDeg) => {
      expect(Result.isFailure(decodeOrder({ ...base, courseDeg }))).toBe(true);
    },
  );

  it.each([1, 12, MAX_SPEED_KNOTS])("accepts speed %s knots", (speedKnots) => {
    expect(Result.isSuccess(decodeOrder({ ...base, speedKnots }))).toBe(true);
  });

  it.each([0, -4, MAX_SPEED_KNOTS + 1, 2.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])(
    "rejects speed %s knots",
    (speedKnots) => {
      expect(Result.isFailure(decodeOrder({ ...base, speedKnots }))).toBe(true);
    },
  );

  it("rejects excess keys on an order", () => {
    expect(Result.isFailure(decodeOrder({ ...base, rudder: 3 }))).toBe(true);
  });

  it("shares the order schema with the saved steps and the advance command", () => {
    const order = { ...base, courseDeg: 270, speedKnots: 14 };
    expect(
      Result.isSuccess(
        decodeSave({
          schemaVersion: "1.0.0",
          turnId: "t",
          battleId: "b",
          steps: [{ mode: "minute", divisions: [order] }],
        }),
      ),
    ).toBe(true);
    expect(
      Result.isSuccess(
        decodeAdvance({ sessionId: "s", battleId: "b", mode: "minute", divisions: [order] }),
      ),
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeAdvance({
          sessionId: "s",
          battleId: "b",
          mode: "minute",
          divisions: [{ ...order, courseDeg: 360 }],
        }),
      ),
    ).toBe(true);
  });
});
