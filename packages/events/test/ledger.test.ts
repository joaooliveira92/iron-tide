import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { EventLedger } from "../src/index.js";
import { asSafeInt, budgetEvent } from "./fixtures.js";

describe("EventLedger", () => {
  it("hashes an empty ledger deterministically", () => {
    expect(new EventLedger().hash()).toBe(sha256Hex(canonicalSerialize([])));
  });

  it("hashes appended events in ledger order", () => {
    const ledger = new EventLedger();
    const event = budgetEvent();
    ledger.append(event);
    expect(ledger.hash()).toBe(sha256Hex(canonicalSerialize([event])));
  });

  it("does not expose its mutable internal array", () => {
    const ledger = new EventLedger();
    ledger.append(budgetEvent());
    const snapshot = ledger.all;
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => (snapshot as unknown[]).push({})).toThrow();
    expect(ledger.all).toHaveLength(1);
  });

  it("rejects duplicate event identifiers", () => {
    const ledger = new EventLedger();
    ledger.append(budgetEvent());
    expect(() => ledger.append(budgetEvent())).toThrow(/Duplicate eventId/);
  });

  it("rejects non-increasing sequences for one aggregate", () => {
    const ledger = new EventLedger();
    ledger.append(budgetEvent());
    expect(() =>
      ledger.append(budgetEvent({ eventId: "evt-2", sequenceNumber: asSafeInt(1) })),
    ).toThrow(/sequenceNumber must increase/);
  });

  it("tracks sequence numbers independently per aggregate", () => {
    const ledger = new EventLedger();
    ledger.append(budgetEvent());
    ledger.append(budgetEvent({ eventId: "evt-2", aggregateId: "nation-2" }));
    expect(ledger.all).toHaveLength(2);
  });

  it("serializes readable JSON", () => {
    const ledger = new EventLedger();
    ledger.append(budgetEvent());
    expect(JSON.parse(ledger.toJSON())).toHaveLength(1);
  });
});
