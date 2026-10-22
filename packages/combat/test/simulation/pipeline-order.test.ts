import { describe, it, expect } from "vite-plus/test";
import { advanceMinutes } from "../../src/simulation/engine.js";
import { buildTestState } from "./advance.test.js";
import { canonicalEventOrder } from "../../src/battleLedger.js";

describe("AC-12 DESIGN-38 pipeline order (steps 4-8)", () => {
  const STEP_ORDER = [
    "update_contact_knowledge",
    "resolve_movement_intent",
    "resolve_propulsion_formation",
    "resolve_collisions_grounding",
    "resolve_sensors_spotting",
  ];

  it("emits phase events in DESIGN-38 step order for each minute", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 2,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
    });
    for (const minuteResult of res.results) {
      const phaseEvents = minuteResult.events.filter((e) => STEP_ORDER.includes(e.eventType));
      const idx = phaseEvents.map((e) => STEP_ORDER.indexOf(e.eventType));
      expect(idx).toEqual([...idx].sort((a, b) => a - b));
    }
  });

  it("each minute's events are canonically ordered (existing BattleLedger canonicalEventOrder)", () => {
    const state = buildTestState();
    const res = advanceMinutes({
      state,
      minutes: 3,
      observationTime: "1900-01-01T00:00:00.000Z",
      orders: { a1: { orderedHeading: 90, orderedSpeedBp: 20_000 } },
    });
    for (const minuteResult of res.results) {
      const sorted = [...minuteResult.events].sort(canonicalEventOrder);
      expect(minuteResult.events).toEqual(sorted);
    }
  });
});
