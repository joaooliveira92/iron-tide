import { SafeInt } from "@bluewave/contracts";
import type { DomainEventBody, DomainEventEnvelope } from "@bluewave/events";
import { describe, expect, it } from "vite-plus/test";
import { foreignRevolutionsFromEvents } from "./revolutionReport.js";

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

const consequence = (
  nationId: string,
  kind: "STRIKE" | "REVOLUTION",
  government?: { readonly before: string; readonly after: string },
) =>
  envelope({
    kind: "UnrestConsequence",
    nationId,
    consequence: kind,
    unrest: SafeInt(9),
    rateBeforeBp: SafeInt(10000),
    rateAfterBp: SafeInt(8000),
    careerEnded: false,
    ...(government === undefined
      ? {}
      : { governmentBefore: government.before, governmentAfter: government.after }),
    rulesetVersion: "0.1.0",
  });

describe("foreignRevolutionsFromEvents", () => {
  it("reports a foreign revolution that changed the government", () => {
    expect(
      foreignRevolutionsFromEvents(
        [consequence("france", "REVOLUTION", { before: "autocratic", after: "communist" })],
        "uk",
      ),
    ).toEqual([
      { nationId: "france", governmentBefore: "autocratic", governmentAfter: "communist" },
    ]);
  });

  it("ignores the player's own revolution, strikes and revolutions without government fields", () => {
    expect(
      foreignRevolutionsFromEvents(
        [
          consequence("uk", "REVOLUTION", { before: "autocratic", after: "communist" }),
          consequence("france", "STRIKE", { before: "autocratic", after: "communist" }),
          consequence("russia", "REVOLUTION"),
        ],
        "uk",
      ),
    ).toEqual([]);
  });

  it("keeps event order for several nations", () => {
    const rows = foreignRevolutionsFromEvents(
      [
        consequence("france", "REVOLUTION", { before: "eastern", after: "limited_democracy" }),
        consequence("russia", "REVOLUTION", { before: "fascist", after: "limited_democracy" }),
      ],
      "uk",
    );
    expect(rows.map((row) => row.nationId)).toEqual(["france", "russia"]);
  });
});
