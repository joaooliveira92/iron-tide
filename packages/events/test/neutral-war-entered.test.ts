import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { parseDomainEventBody } from "../src/index.js";

const entered = (over: Record<string, unknown> = {}) => ({
  kind: "NeutralWarEntered",
  nationId: "GBR",
  targetNationId: "FRA",
  warId: "war_GBR_FRA_1880-06",
  month: "1880-06",
  cause: "UNRESTRICTED_SUBMARINE_INCIDENTS",
  tension: SafeInt(10),
  ...over,
});

describe("NeutralWarEntered (#1135)", () => {
  it("parses a neutral war entry", () => {
    expect(parseDomainEventBody(entered())).toMatchObject({
      kind: "NeutralWarEntered",
      cause: "UNRESTRICTED_SUBMARINE_INCIDENTS",
    });
  });

  it("rejects an undeclared cause, a bad month and excess properties", () => {
    expect(() => parseDomainEventBody(entered({ cause: "PIRACY" }))).toThrow();
    expect(() => parseDomainEventBody(entered({ month: "1880-13" }))).toThrow();
    expect(() => parseDomainEventBody(entered({ extra: 1 }))).toThrow();
  });
});
