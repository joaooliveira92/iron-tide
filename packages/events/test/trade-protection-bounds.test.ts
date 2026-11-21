import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { parseDomainEventBody } from "../src/index.js";

const assessed = (shortfallBp: number) => ({
  kind: "TradeProtectionAssessed",
  nationId: "GBR",
  month: "1880-04",
  quota: SafeInt(4),
  assigned: SafeInt(1),
  shortfall: SafeInt(3),
  shortfallBp: SafeInt(shortfallBp),
});

const lost = (poolBefore: number, poolAfter: number) => ({
  kind: "MerchantLossSuffered",
  nationId: "GBR",
  month: "1880-04",
  raiderHits: SafeInt(1),
  pressureHit: false,
  submarineHits: 0,
  lossBp: SafeInt(100),
  poolBefore: SafeInt(poolBefore),
  poolAfter: SafeInt(poolAfter),
});

describe("trade protection event bounds (#1037)", () => {
  it("accepts shortfallBp, poolBefore and poolAfter at 0 and 10_000", () => {
    expect(parseDomainEventBody(assessed(0))).toMatchObject({ shortfallBp: 0 });
    expect(parseDomainEventBody(assessed(10_000))).toMatchObject({ shortfallBp: 10_000 });
    expect(parseDomainEventBody(lost(10_000, 0))).toMatchObject({ poolBefore: 10_000 });
  });

  it("rejects shortfallBp above 10_000", () => {
    expect(() => parseDomainEventBody(assessed(10_001))).toThrow();
  });

  it("rejects poolBefore above 10_000", () => {
    expect(() => parseDomainEventBody(lost(10_001, 9_000))).toThrow();
  });

  it("rejects poolAfter above 10_000", () => {
    expect(() => parseDomainEventBody(lost(10_000, 10_001))).toThrow();
  });
});
