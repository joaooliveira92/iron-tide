import { SafeInt } from "@bluewave/contracts";
import type { DomainEventBody, DomainEventEnvelope } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import { neutralWarsFromEvents } from "./neutralWarReport.js";

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

const entered = (nationId: string, targetNationId: string) =>
  envelope({
    kind: "NeutralWarEntered",
    nationId,
    targetNationId,
    warId: `war_${nationId}_${targetNationId}_1880-03`,
    month: "1880-03",
    cause: "UNRESTRICTED_SUBMARINE_INCIDENTS",
    tension: SafeInt(10),
  });

describe("neutralWarsFromEvents", () => {
  it("is empty when the player is neither the declarer nor the target", () => {
    expect(neutralWarsFromEvents([entered("france", "germany")], "uk")).toEqual([]);
  });

  it("reports the declarer as forced into war against the raider", () => {
    expect(neutralWarsFromEvents([entered("uk", "germany")], "uk")).toEqual([
      {
        role: "DECLARER",
        otherNationId: "germany",
        warId: "war_uk_germany_1880-03",
        cause: "UNRESTRICTED_SUBMARINE_INCIDENTS",
        tension: 10,
      },
    ]);
  });

  it("reports the targeted raider as having war declared on it", () => {
    expect(neutralWarsFromEvents([entered("france", "uk")], "uk")).toEqual([
      {
        role: "TARGET",
        otherNationId: "france",
        warId: "war_france_uk_1880-03",
        cause: "UNRESTRICTED_SUBMARINE_INCIDENTS",
        tension: 10,
      },
    ]);
  });

  it("keeps every entry in event order", () => {
    const result = neutralWarsFromEvents(
      [entered("uk", "germany"), entered("france", "germany"), entered("italy", "uk")],
      "uk",
    );
    expect(result.map((war) => [war.role, war.otherNationId])).toEqual([
      ["DECLARER", "germany"],
      ["TARGET", "italy"],
    ]);
  });
});
