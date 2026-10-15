import type { CommandRecord, CommandStatus } from "@bluewave/commands";
import { describe, expect, it } from "vite-plus/test";
import { isTerminal, uiStatusFor } from "./command-status.js";

function record(status: CommandStatus): CommandRecord {
  return { status } as CommandRecord;
}

const IN_FLIGHT: CommandStatus[] = [
  "SUBMITTED",
  "VALIDATED",
  "AUTHORIZED",
  "RESERVED",
  "ACCEPTED",
  "LOCKED",
  "RESOLVING",
];
const TERMINAL: CommandStatus[] = [
  "COMPLETED",
  "PARTIALLY_COMPLETED",
  "REJECTED",
  "CANCELLED",
  "SUPERSEDED",
];

describe("uiStatusFor", () => {
  it("maps SUPERSEDED and CANCELLED onto their own UI statuses", () => {
    expect(uiStatusFor(record("SUPERSEDED"))).toBe("superseded");
    expect(uiStatusFor(record("CANCELLED"))).toBe("cancelled");
  });

  it("treats every non-terminal status as submitted", () => {
    for (const status of IN_FLIGHT) expect(uiStatusFor(record(status))).toBe("submitted");
  });
});

describe("isTerminal", () => {
  it("is true for exactly the machinery's terminal statuses", () => {
    for (const status of TERMINAL) expect(isTerminal(record(status))).toBe(true);
  });

  it("is false for every in-flight status", () => {
    for (const status of IN_FLIGHT) expect(isTerminal(record(status))).toBe(false);
  });
});
