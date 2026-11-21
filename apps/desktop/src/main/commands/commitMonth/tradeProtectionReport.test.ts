import { SafeInt } from "@bluewave/contracts";
import type { DomainEventBody, DomainEventEnvelope } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import { tradeProtectionFromEvents } from "./tradeProtectionReport.js";

function envelope(body: DomainEventBody): DomainEventEnvelope {
  return {
    eventId: `evt-${body.kind}`,
    version: "1",
    aggregateType: "nation",
    aggregateId: "uk",
    eventType: body.kind,
    timestamp: "1880-01-01T00:00:00.000Z",
    body,
    sequenceNumber: SafeInt(1),
  };
}

const assessed = (nationId: string) =>
  envelope({
    kind: "TradeProtectionAssessed",
    nationId,
    month: "1880-03",
    quota: SafeInt(4),
    assigned: SafeInt(1),
    shortfall: SafeInt(3),
    shortfallBp: SafeInt(7_500),
  });

const lost = (nationId: string) =>
  envelope({
    kind: "MerchantLossSuffered",
    nationId,
    month: "1880-03",
    raiderHits: SafeInt(2),
    submarineHits: SafeInt(1),
    pressureHit: true,
    lossBp: SafeInt(2_500),
    poolBefore: SafeInt(10_000),
    poolAfter: SafeInt(7_500),
  });

describe("tradeProtectionFromEvents", () => {
  it("is absent without an assessment for the player", () => {
    expect(tradeProtectionFromEvents([assessed("france"), lost("uk")], "uk")).toBe(undefined);
  });

  it("carries the assessment and, when present, the merchant loss", () => {
    expect(tradeProtectionFromEvents([assessed("uk")], "uk")).toEqual({
      quota: 4,
      assigned: 1,
      shortfall: 3,
      shortfallBp: 7_500,
    });
    expect(tradeProtectionFromEvents([assessed("uk"), lost("uk"), lost("france")], "uk")).toEqual({
      quota: 4,
      assigned: 1,
      shortfall: 3,
      shortfallBp: 7_500,
      loss: {
        raiderHits: 2,
        submarineHits: 1,
        pressureHit: true,
        lossBp: 2_500,
        poolBefore: 10_000,
        poolAfter: 7_500,
      },
    });
  });

  it("lists the player's own raider engagements, internments and releases (#1013)", () => {
    const engaged = (nationId: string) =>
      envelope({
        kind: "RaiderEngaged",
        nationId,
        shipId: `${nationId}-r1`,
        victimNationId: "france",
        month: "1880-03",
        encounter: "BREAKOUT",
        chanceBp: SafeInt(3_500),
        outcome: "INTERNED",
        damageBp: SafeInt(5_000),
      });
    const interned = envelope({
      kind: "RaiderInterned",
      nationId: "uk",
      shipId: "uk-r1",
      month: "1880-03",
      cause: "DAMAGE",
    });
    const released = envelope({
      kind: "RaiderReleased",
      nationId: "uk",
      shipId: "uk-r2",
      month: "1880-03",
    });
    expect(
      tradeProtectionFromEvents(
        [assessed("uk"), engaged("uk"), engaged("france"), interned, released],
        "uk",
      )?.raiders,
    ).toEqual([
      {
        shipId: "uk-r1",
        event: "ENGAGED",
        encounter: "BREAKOUT",
        victimNationId: "france",
        outcome: "INTERNED",
      },
      { shipId: "uk-r1", event: "INTERNED", cause: "DAMAGE" },
      { shipId: "uk-r2", event: "RELEASED" },
    ]);
  });
});
