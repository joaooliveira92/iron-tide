import { describe, it, expect } from "vite-plus/test";
import {
  createContactTrack,
  ageContact,
  updateContact,
  isStale,
  CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE,
  CONTACT_STALE_THRESHOLD_BP,
} from "../../src/contact/index.js";

function fresh(overrides: Partial<Parameters<typeof createContactTrack>[0]> = {}) {
  return createContactTrack({
    battleId: "b1",
    assetId: "a1",
    sideId: "DEFENDER",
    estimatedIdentity: "unknown",
    position: [0, 0],
    course: 90,
    speedBpKnots: 10_000,
    observationTime: "1900-01-01T00:00:00.000Z",
    minute: 0,
    source: "visual",
    ...overrides,
  });
}

describe("AC-10 contact lifecycle", () => {
  it("creates a deterministic stable-keyed contact", () => {
    const c = fresh();
    expect(c.contactId).toBe("b1:a1");
    expect(c.confidence).toBe(10_000);
    expect(c.stale).toBe(false);
  });

  it("ages confidence by the versioned slope across minutes", () => {
    const c = fresh();
    const aged = ageContact(c, 10);
    expect(aged.confidence).toBe(10_000 - CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE * 10);
  });

  it("clamps confidence at zero and flags staleness at threshold", () => {
    const c = fresh();
    const aged = ageContact(c, 10_000);
    expect(aged.confidence).toBe(0);
    expect(aged.stale).toBe(true);
    expect(isStale(aged)).toBe(true);
  });

  it("marks stale at/under the staleness threshold", () => {
    const c = fresh();
    const aged = ageContact(
      c,
      Math.floor((10_000 - CONTACT_STALE_THRESHOLD_BP) / CONTACT_CONFIDENCE_DECAY_BP_PER_MINUTE),
    );
    expect(isStale(aged)).toBe(true);
  });

  it("refreshes a fresh observation and merges sources on update", () => {
    const c = fresh();
    const aged = ageContact(c, 60);
    expect(aged.confidence).toBeLessThan(10_000);
    const updated = updateContact(aged, {
      position: [100, 100],
      course: 180,
      speedBpKnots: 12_000,
      observationTime: "1900-01-01T00:01:00.000Z",
      minute: 1,
      source: "radar-inert",
    });
    expect(updated.confidence).toBe(10_000);
    expect(updated.stale).toBe(false);
    expect(updated.position).toEqual([100, 100]);
    expect(updated.sources).toContain("radar-inert");
    expect(updated.sources).toContain("visual");
  });
});
