import { describe, expect, it } from "vite-plus/test";
import {
  FLEET_MORALE_MAX,
  FLEET_MORALE_MIN,
  fleetMoraleOf,
  isLongBlockadeCramped,
  resolveFleetMoraleMonth,
  type FleetMoraleRules,
  type LongBlockadeInput,
} from "../src/fleetMorale.js";

const RULES: FleetMoraleRules = {
  unpaidFundsLoss: 10,
  blockadeCrampedLoss: 5,
  longWarMonths: 6,
  recoveryPerMonth: 4,
};

describe("fleetMoraleOf", () => {
  it("reads an absent value as full morale", () => {
    expect(fleetMoraleOf({})).toBe(FLEET_MORALE_MAX);
    expect(fleetMoraleOf({ fleetMorale: 40 })).toBe(40);
  });
});

describe("resolveFleetMoraleMonth", () => {
  it("does nothing at full morale with no driver", () => {
    expect(
      resolveFleetMoraleMonth({
        current: undefined,
        rules: RULES,
        unpaid: false,
        blockadedCramped: false,
      }),
    ).toBeUndefined();
  });

  it("lowers morale for an unpaid month and records the contribution", () => {
    const change = resolveFleetMoraleMonth({
      current: undefined,
      rules: RULES,
      unpaid: true,
      blockadedCramped: false,
    });
    expect(change).toEqual({
      before: 100,
      after: 90,
      unclampedAfter: 90,
      contributions: [{ reasonCode: "UNPAID_FUNDS", delta: -10 }],
    });
  });

  it("stacks the blockade driver on top of the unpaid driver", () => {
    const change = resolveFleetMoraleMonth({
      current: 80,
      rules: RULES,
      unpaid: true,
      blockadedCramped: true,
    });
    expect(change?.after).toBe(65);
    expect(change?.contributions).toEqual([
      { reasonCode: "UNPAID_FUNDS", delta: -10 },
      { reasonCode: "BLOCKADE_CRAMPED", delta: -5 },
    ]);
  });

  it("clamps at the floor and keeps the unclamped figure", () => {
    const change = resolveFleetMoraleMonth({
      current: 3,
      rules: RULES,
      unpaid: true,
      blockadedCramped: false,
    });
    expect(change?.after).toBe(FLEET_MORALE_MIN);
    expect(change?.unclampedAfter).toBe(-7);
  });

  it("recovers toward full morale when no driver is active", () => {
    const change = resolveFleetMoraleMonth({
      current: 50,
      rules: RULES,
      unpaid: false,
      blockadedCramped: false,
    });
    expect(change).toEqual({
      before: 50,
      after: 54,
      unclampedAfter: 54,
      contributions: [{ reasonCode: "RECOVERY", delta: 4 }],
    });
  });

  it("never recovers past full morale", () => {
    const change = resolveFleetMoraleMonth({
      current: 98,
      rules: RULES,
      unpaid: false,
      blockadedCramped: false,
    });
    expect(change?.after).toBe(FLEET_MORALE_MAX);
    expect(change?.contributions).toEqual([{ reasonCode: "RECOVERY", delta: 2 }]);
  });

  it("does not recover in a month that has a driver", () => {
    const change = resolveFleetMoraleMonth({
      current: 50,
      rules: RULES,
      unpaid: false,
      blockadedCramped: true,
    });
    expect(change?.contributions).toEqual([{ reasonCode: "BLOCKADE_CRAMPED", delta: -5 }]);
  });
});

function snapshotWith(options: {
  readonly warStart: string;
  readonly blockadeMonth?: string;
  readonly cramped: boolean;
  readonly warStatus?: "ACTIVE" | "ENDED";
}): LongBlockadeInput {
  return {
    fleets: [{ ships: [{ designVersionId: "d1" }] }],
    designs: new Map([["d1", options.cramped ? { crampedAccommodation: true as const } : {}]]),
    wars: [
      {
        attackerSideMembers: ["n1"],
        defenderSideMembers: ["n2"],
        startDate: options.warStart,
        status: options.warStatus ?? "ACTIVE",
      },
    ],
    blockadeState:
      options.blockadeMonth === undefined
        ? []
        : [{ blockadedNationId: "n1", establishedMonth: options.blockadeMonth }],
  };
}

describe("isLongBlockadeCramped", () => {
  it("is true for a blockaded nation in a war at least longWarMonths old with a cramped ship", () => {
    const snapshot = snapshotWith({ warStart: "1880-01", blockadeMonth: "1880-03", cramped: true });
    expect(isLongBlockadeCramped(snapshot, "n1", "1880-07", RULES)).toBe(true);
  });

  it("is false before the war is long", () => {
    const snapshot = snapshotWith({ warStart: "1880-01", blockadeMonth: "1880-03", cramped: true });
    expect(isLongBlockadeCramped(snapshot, "n1", "1880-06", RULES)).toBe(false);
  });

  it("is false without a blockade", () => {
    const snapshot = snapshotWith({ warStart: "1880-01", cramped: true });
    expect(isLongBlockadeCramped(snapshot, "n1", "1881-01", RULES)).toBe(false);
  });

  it("is false without a cramped ship", () => {
    const snapshot = snapshotWith({
      warStart: "1880-01",
      blockadeMonth: "1880-03",
      cramped: false,
    });
    expect(isLongBlockadeCramped(snapshot, "n1", "1881-01", RULES)).toBe(false);
  });

  it("is false once the war has ended", () => {
    const snapshot = snapshotWith({
      warStart: "1880-01",
      blockadeMonth: "1880-03",
      cramped: true,
      warStatus: "ENDED",
    });
    expect(isLongBlockadeCramped(snapshot, "n1", "1881-01", RULES)).toBe(false);
  });
});
