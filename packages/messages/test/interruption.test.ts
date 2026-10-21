import { describe, expect, it } from "vite-plus/test";
import {
  computeInputHash,
  decodeBattleResultInput,
  decodeDecisionAnswer,
  decodeInterruptionPayload,
  decodeOfferResponseInput,
  decodeRecordedInput,
  decodeRecordedInputs,
  makeRecordedInput,
  OFFER_RESPONSES,
  type BattleResultInput,
  type DecisionAnswer,
  type OfferResponseInput,
} from "../src/index.js";

// Schema parity (spec #109 R3 / ticket #111): the offer response is additive. The existing decision-answer and
// battle-result fixtures (the shapes the phase-engine interruption seam records) must still round-trip unchanged.
const decisionAnswer: DecisionAnswer = {
  interruptionId: "i-0",
  decisionId: "dec-1",
  optionId: "approve",
};
const tiedResult: BattleResultInput = {
  interruptionId: "i-1",
  battleId: "battle-1",
  winnerId: null,
  loserId: null,
  attackerLosses: [],
  defenderLosses: [],
  damageReport: {},
};
const decidedResult: BattleResultInput = {
  interruptionId: "i-2",
  battleId: "battle-2",
  winnerId: "GBR",
  loserId: "FRA",
  attackerLosses: ["s1"],
  defenderLosses: ["s2", "s3"],
  damageReport: { s1: 10 },
};
const offerFor = (response: OfferResponseInput["response"]): OfferResponseInput => ({
  interruptionId: "i-3",
  battleId: "battle-3",
  response,
});

describe("offer-response schema", () => {
  it("round-trips accept, decline and delegate", () => {
    expect(OFFER_RESPONSES).toEqual(["accept", "decline", "delegate"]);
    for (const response of OFFER_RESPONSES) {
      const payload = offerFor(response);
      expect(decodeOfferResponseInput(JSON.parse(JSON.stringify(payload)))).toEqual(payload);
      const recorded = makeRecordedInput({
        ordinal: 3,
        kind: "offer",
        interruptionId: payload.interruptionId,
        payload,
      });
      expect(decodeRecordedInput(JSON.parse(JSON.stringify(recorded)))).toEqual(recorded);
      expect(decodeInterruptionPayload("offer", payload)).toEqual(payload);
    }
  });

  it("rejects excess keys, unknown responses and missing or empty fields", () => {
    expect(() => decodeOfferResponseInput({ ...offerFor("accept"), surprise: 1 })).toThrow();
    expect(() => decodeOfferResponseInput({ ...offerFor("accept"), response: "ignore" })).toThrow();
    expect(() => decodeOfferResponseInput({ ...offerFor("accept"), battleId: "" })).toThrow();
    expect(() => decodeOfferResponseInput({ interruptionId: "i", battleId: "b" })).toThrow();
    expect(() =>
      decodeRecordedInput({
        ...makeRecordedInput({
          ordinal: 0,
          kind: "offer",
          interruptionId: "i-3",
          payload: offerFor("accept"),
        }),
        kind: "weird",
      }),
    ).toThrow();
  });

  it("binds the hash to the response, so a swapped answer no longer validates", () => {
    const base = { ordinal: 0, kind: "offer" as const, interruptionId: "i-3" };
    const accept = computeInputHash({ ...base, payload: offerFor("accept") });
    expect(computeInputHash({ ...base, payload: offerFor("decline") })).not.toBe(accept);
    expect(computeInputHash({ ...base, payload: offerFor("accept") })).toBe(accept);
  });
});

describe("existing interruption fixtures still round-trip", () => {
  it("decodes decision answers and battle results exactly as before", () => {
    expect(decodeDecisionAnswer(decisionAnswer)).toEqual(decisionAnswer);
    expect(decodeBattleResultInput(tiedResult)).toEqual(tiedResult);
    expect(decodeBattleResultInput(decidedResult)).toEqual(decidedResult);
    expect(decodeInterruptionPayload("decision", decisionAnswer)).toEqual(decisionAnswer);
    expect(decodeInterruptionPayload("battle", decidedResult)).toEqual(decidedResult);
  });

  it("keeps battle-result strictness: excess keys rejected, an offer response is not a battle result", () => {
    expect(() => decodeBattleResultInput({ ...decidedResult, surprise: 1 })).toThrow();
    expect(() => decodeBattleResultInput(offerFor("accept"))).toThrow();
  });

  it("round-trips a mixed ordered input list", () => {
    const inputs = [
      makeRecordedInput({
        ordinal: 0,
        kind: "decision",
        interruptionId: "i-0",
        payload: decisionAnswer,
      }),
      makeRecordedInput({ ordinal: 1, kind: "battle", interruptionId: "i-1", payload: tiedResult }),
      makeRecordedInput({
        ordinal: 2,
        kind: "offer",
        interruptionId: "i-3",
        payload: offerFor("delegate"),
      }),
    ];
    expect(decodeRecordedInputs(JSON.parse(JSON.stringify(inputs)))).toEqual(inputs);
  });
});
