import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { parseDomainEventBody } from "../src/index.js";

const engaged = (over: Record<string, unknown> = {}) => ({
  kind: "RaiderEngaged",
  nationId: "FRA",
  shipId: "r1",
  victimNationId: "GBR",
  month: "1880-06",
  encounter: "INTERCEPTION",
  chanceBp: SafeInt(2000),
  outcome: "SURVIVED",
  damageBp: SafeInt(1200),
  ...over,
});

describe("raider events (#1013)", () => {
  it("parses an engagement, an internment and a release", () => {
    expect(parseDomainEventBody(engaged())).toMatchObject({ kind: "RaiderEngaged" });
    expect(
      parseDomainEventBody({
        kind: "RaiderInterned",
        nationId: "FRA",
        shipId: "r1",
        month: "1880-06",
        cause: "FUEL_EXHAUSTION",
      }),
    ).toMatchObject({ cause: "FUEL_EXHAUSTION" });
    expect(
      parseDomainEventBody({
        kind: "RaiderReleased",
        nationId: "FRA",
        shipId: "r1",
        month: "1880-06",
      }),
    ).toMatchObject({ kind: "RaiderReleased" });
  });

  it("rejects an unknown outcome, encounter and a basis point above 10_000", () => {
    expect(() => parseDomainEventBody(engaged({ outcome: "CAPTURED" }))).toThrow();
    expect(() => parseDomainEventBody(engaged({ encounter: "AMBUSH" }))).toThrow();
    expect(() => parseDomainEventBody(engaged({ damageBp: SafeInt(10_001) }))).toThrow();
  });

  it("rejects an internment cause outside the declared set", () => {
    expect(() =>
      parseDomainEventBody({
        kind: "RaiderInterned",
        nationId: "FRA",
        shipId: "r1",
        month: "1880-06",
        cause: "MUTINY",
      }),
    ).toThrow();
  });
});
