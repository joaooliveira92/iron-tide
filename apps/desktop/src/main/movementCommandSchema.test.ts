import { Result, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { SubmitMovementCommandPayloadSchema } from "../shared/campaignCommandSchemas.js";

const movement = {
  sessionId: "s",
  expectedRevision: 0,
  transportRequestId: "req-1",
  divisionId: "fleet-1",
  fromAreaId: "a",
  toAreaId: "b",
};

const accepts = (input: unknown): boolean =>
  Result.isSuccess(Schema.decodeUnknownResult(SubmitMovementCommandPayloadSchema)(input));

describe("SubmitMovementCommandPayloadSchema shipIds", () => {
  it("accepts an order without shipIds and with a non-empty subset", () => {
    expect(accepts(movement)).toBe(true);
    expect(accepts({ ...movement, shipIds: ["s1", "s2"] })).toBe(true);
  });

  it("rejects an empty or non-string subset", () => {
    expect(accepts({ ...movement, shipIds: [] })).toBe(false);
    expect(accepts({ ...movement, shipIds: [""] })).toBe(false);
    expect(accepts({ ...movement, shipIds: [1] })).toBe(false);
  });
});
