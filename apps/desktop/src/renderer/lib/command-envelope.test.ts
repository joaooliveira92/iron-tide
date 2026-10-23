import { describe, expect, it } from "vite-plus/test";

import {
  createTransportRequestId,
  envelopeOf,
  requireIds,
  stampCommand,
} from "./command-envelope.js";

function sequentialIds() {
  let n = 0;
  return (prefix: string) => `${prefix}-id-${++n}`;
}

describe("stampCommand", () => {
  it("stamps the revision and a transport id drawn from the injected source", () => {
    const ids = sequentialIds();
    expect(stampCommand("answerDecision", 7, ids)).toEqual({
      expectedRevision: 7,
      transportRequestId: "answerDecision-id-1",
    });
    expect(stampCommand("answerDecision", 7, ids).transportRequestId).toBe("answerDecision-id-2");
  });

  it("defaults to fresh prefixed ids", () => {
    const first = stampCommand("resolveTurn", 1);
    const second = stampCommand("resolveTurn", 1);
    expect(first.transportRequestId).toMatch(/^resolveTurn-/);
    expect(first.transportRequestId).not.toBe(second.transportRequestId);
    expect(createTransportRequestId("x")).toMatch(/^x-/);
  });
});

describe("envelopeOf", () => {
  it("joins the session id with a stamp into the wire envelope", () => {
    expect(envelopeOf("s1", { expectedRevision: 4, transportRequestId: "tr-9" })).toEqual({
      sessionId: "s1",
      expectedRevision: 4,
      transportRequestId: "tr-9",
    });
  });
});

describe("requireIds", () => {
  it("returns the ids when all are present", () => {
    expect(requireIds({ decisionId: "d1", battleId: "b1" })).toEqual({
      _tag: "Ready",
      ids: { decisionId: "d1", battleId: "b1" },
    });
  });

  it("refuses naming the first missing or empty field", () => {
    expect(requireIds({ decisionId: undefined })).toEqual({
      _tag: "MissingRequiredId",
      field: "decisionId",
    });
    expect(requireIds({ interruptionId: "i1", battleId: "" })).toEqual({
      _tag: "MissingRequiredId",
      field: "battleId",
    });
    expect(requireIds({ battleId: null })).toEqual({
      _tag: "MissingRequiredId",
      field: "battleId",
    });
  });
});
