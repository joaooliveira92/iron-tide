import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { parseDomainEventBody } from "../src/index.js";

const attacked = (over: Record<string, unknown> = {}) => ({
  kind: "SubmarineWarshipAttacked",
  nationId: "GER",
  boatId: "ger-u-1",
  victimNationId: "GBR",
  victimShipId: "gbr-dn-1",
  month: "1880-06",
  chanceBp: SafeInt(250),
  outcome: "DAMAGED",
  damageBp: SafeInt(1200),
  ...over,
});

describe("SubmarineWarshipAttacked (#1158)", () => {
  it("parses a damaging hit and a sinking", () => {
    expect(parseDomainEventBody(attacked())).toMatchObject({ outcome: "DAMAGED" });
    expect(
      parseDomainEventBody(attacked({ outcome: "SUNK", damageBp: SafeInt(10000) })),
    ).toMatchObject({ outcome: "SUNK" });
  });

  it("rejects an undeclared outcome, a bad month, out-of-range basis points and excess properties", () => {
    expect(() => parseDomainEventBody(attacked({ outcome: "INTERNED" }))).toThrow();
    expect(() => parseDomainEventBody(attacked({ month: "1880-13" }))).toThrow();
    expect(() => parseDomainEventBody(attacked({ chanceBp: SafeInt(10001) }))).toThrow();
    expect(() => parseDomainEventBody(attacked({ extra: 1 }))).toThrow();
  });
});
