import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";

const SRC = join(import.meta.dirname, "..", "src");

function read(file: string): string {
  return readFileSync(join(SRC, file), "utf8");
}

describe("event schemas own their types", () => {
  it("does not hand-mirror event body interfaces", () => {
    expect(read("envelope.ts")).not.toMatch(
      /export interface (?:NationBudgetChanged|DomainEventBody|DomainEventEnvelope)\b/,
    );
  });

  it("does not cast decoded events to a hand-written type", () => {
    expect(read("validation.ts")).not.toMatch(/\bas DomainEvent(?:Body|Envelope)\b/);
  });

  it("exports every body kind named in the union", () => {
    const index = read("index.ts");
    expect(index).toMatch(/\bShipReadinessChanged\b/);
    expect(index).toMatch(/\bShipStationAssignmentChanged\b/);
  });
});
