import { describe, expect, it } from "vite-plus/test";
import {
  DuplicateEventIdError,
  EmptyFormulaIdentifierError,
  EventLedger,
  EventSequenceNotIncreasingError,
  ExplanationBuilder,
  NonFiniteNumberError,
} from "../src/index.js";
import { asSafeInt, budgetEvent } from "./fixtures.js";

function capture(fn: () => void): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to throw");
}

describe("events tagged errors", () => {
  it("tags a duplicate event id and preserves the message verbatim", () => {
    const ledger = new EventLedger();
    ledger.append(budgetEvent());

    const thrown = capture(() => ledger.append(budgetEvent()));

    expect(thrown).toBeInstanceOf(Error);
    const tagged = thrown as DuplicateEventIdError;
    expect(tagged._tag).toBe("DuplicateEventIdError");
    expect(tagged.name).toBe("DuplicateEventIdError");
    expect(tagged.eventId).toBe("evt-1");
    expect(tagged.message).toBe("Duplicate eventId: evt-1");
  });

  it("tags a non-increasing sequence with the aggregate and both sequences", () => {
    const ledger = new EventLedger();
    ledger.append(budgetEvent());

    const thrown = capture(() =>
      ledger.append(budgetEvent({ eventId: "evt-2", sequenceNumber: asSafeInt(1) })),
    );

    const tagged = thrown as EventSequenceNotIncreasingError;
    expect(tagged._tag).toBe("EventSequenceNotIncreasingError");
    expect(tagged.name).toBe("EventSequenceNotIncreasingError");
    expect(tagged.aggregateType).toBe("Nation");
    expect(tagged.aggregateId).toBe("nation-1");
    expect(tagged.sequenceNumber).toBe(1);
    expect(tagged.previousSequence).toBe(1);
    expect(tagged.message).toBe("sequenceNumber must increase for Nation/nation-1: 1 <= 1");
  });

  it("tags a non-finite explanation value and preserves the message verbatim", () => {
    const thrown = capture(() => new ExplanationBuilder("formula", "1").withResult(Number.NaN));

    const tagged = thrown as NonFiniteNumberError;
    expect(tagged._tag).toBe("NonFiniteNumberError");
    expect(tagged.name).toBe("NonFiniteNumberError");
    expect(tagged.valueName).toBe("result");
    expect(tagged.message).toBe("result must be a finite number");
  });

  it("tags an empty formula identifier and preserves the message verbatim", () => {
    const thrown = capture(() => new ExplanationBuilder("", "1"));

    const tagged = thrown as EmptyFormulaIdentifierError;
    expect(tagged._tag).toBe("EmptyFormulaIdentifierError");
    expect(tagged.name).toBe("EmptyFormulaIdentifierError");
    expect(tagged.message).toBe("formulaId and formulaVersion must be non-empty");
  });
});

describe("tagged error serialization hazard", () => {
  it("JSON.stringify preserves _tag while structuredClone drops it", () => {
    const error = new DuplicateEventIdError({ eventId: "evt-1", message: "duplicate" });

    const viaJson = JSON.parse(JSON.stringify(error)) as { readonly _tag?: unknown };
    expect(viaJson._tag).toBe("DuplicateEventIdError");

    const viaClone = structuredClone(error) as { readonly _tag?: unknown };
    expect(viaClone).not.toBe(error);
    expect(viaClone._tag).toBeUndefined();
  });
});
