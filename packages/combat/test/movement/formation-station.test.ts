import { describe, it, expect } from "vite-plus/test";
import {
  computeDesiredStation,
  helmSteerToStation,
  onStation,
  type MovementState,
  LINE_AHEAD_COLUMN_INTERVAL_UM,
} from "@bluewave/combat/movement";
import type { DivisionFormation } from "@bluewave/campaign";

function state(overrides: Partial<MovementState> = {}): MovementState {
  return {
    position: [0, 0],
    heading: 0,
    orderedSpeed: 10_000,
    currentSpeed: 10_000,
    acceleration: 0,
    turningRate: 1_000,
    collisionRadius: 5_000_000,
    propulsionState: "steam",
    machineryReliability: 10_000,
    fuelState: "coal",
    formationStation: "LEAD",
    ...overrides,
  };
}

describe("AC-5 formation stations", () => {
  it("computes a LINE_AHEAD column station behind the lead", () => {
    const lead: [number, number] = [0, 0];
    const station = computeDesiredStation({
      formation: "LINE_AHEAD",
      ordinal: 2,
      leadPosition: lead,
      leadHeading: 0,
    });
    expect(station.heading).toBe(0);
    expect(station.position[0]).toBe(-2 * LINE_AHEAD_COLUMN_INTERVAL_UM);
    expect(station.position[1]).toBe(0);
  });

  it("computes an abeam station for LINE_ABREAST", () => {
    const station = computeDesiredStation({
      formation: "LINE_ABREAST",
      ordinal: 1,
      leadPosition: [0, 0],
      leadHeading: 0,
    });
    expect(station.position[0]).toBe(0);
    expect(Math.abs(station.position[1])).toBeGreaterThan(0);
  });

  it("helm steers toward a distant station and holds on-station", () => {
    const s = state({ position: [0, 0] });
    const desired = {
      position: [LINE_AHEAD_COLUMN_INTERVAL_UM, 0] as [number, number],
      heading: 0,
      offStation: false,
    };
    const steer = helmSteerToStation(s, desired);
    expect(steer.offStation).toBe(true);
    const on = onStation(s, desired);
    expect(on).toBe(false);
  });

  it("reports on-station within tolerance", () => {
    const s = state({ position: [10_000, 0] });
    const desired = {
      position: [0, 0] as [number, number],
      heading: 0,
      offStation: false,
    };
    expect(onStation(s, desired)).toBe(true);
  });

  it("ships are deterministically ordered by ordinal + lead", () => {
    const lead: [number, number] = [1_000_000_000, 2_000_000_000];
    const a = computeDesiredStation({
      formation: "LINE_AHEAD" as DivisionFormation,
      ordinal: 0,
      leadPosition: lead,
      leadHeading: 0,
    });
    const b = computeDesiredStation({
      formation: "LINE_AHEAD" as DivisionFormation,
      ordinal: 1,
      leadPosition: lead,
      leadHeading: 0,
    });
    expect(a.position).toEqual(lead);
    expect(b.position[0]).toBeLessThan(a.position[0]);
  });
});
