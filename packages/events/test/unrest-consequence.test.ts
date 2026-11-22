import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { parseDomainEventBody } from "../src/index.js";

const consequence = (over: Record<string, unknown> = {}) => ({
  kind: "UnrestConsequence",
  nationId: "FRA",
  consequence: "REVOLUTION",
  unrest: SafeInt(9),
  rateBeforeBp: SafeInt(2000),
  rateAfterBp: SafeInt(2000),
  careerEnded: false,
  rulesetVersion: "0.1.0",
  ...over,
});

describe("UnrestConsequence government change (#1018)", () => {
  it("still parses the body recorded before the government fields existed", () => {
    expect(parseDomainEventBody(consequence())).toMatchObject({ consequence: "REVOLUTION" });
  });

  it("parses a body carrying both government ends", () => {
    expect(
      parseDomainEventBody(
        consequence({ governmentBefore: "autocratic", governmentAfter: "communist" }),
      ),
    ).toMatchObject({ governmentBefore: "autocratic", governmentAfter: "communist" });
  });

  it("rejects an empty government and an unknown field", () => {
    expect(() => parseDomainEventBody(consequence({ governmentAfter: "" }))).toThrow();
    expect(() => parseDomainEventBody(consequence({ governmentNow: "communist" }))).toThrow();
  });
});
