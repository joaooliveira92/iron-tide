import { SafeInt } from "@bluewave/contracts";
import { describe, expect, it } from "vite-plus/test";
import { buildPlayerProjection } from "../src/projection.js";
import { fixtureNation, fixtureSnapshot, fixtureState } from "./fixtures.js";

const MONTH = { month: 3, year: 1880 } as const;
const threshold = (state: ReturnType<typeof fixtureState>) =>
  Number(state.snapshot.prestigeRules.sackingThreshold);

function projectionWith(
  prestige: number,
  extra: Partial<ReturnType<typeof fixtureSnapshot>> = {},
  nation: Partial<Parameters<typeof fixtureNation>[0]> = {},
) {
  const snapshot = {
    ...fixtureSnapshot([fixtureNation({ id: "uk", prestige: SafeInt(prestige), ...nation })]),
    ...extra,
  };
  const state = fixtureState(snapshot);
  return { state, projection: buildPlayerProjection(state, "uk", MONTH)! };
}

describe("player projection: prestige and career", () => {
  it("exposes current prestige and the ruleset threshold", () => {
    const { state, projection } = projectionWith(37);
    expect(projection.prestige.current).toBe(37);
    expect(projection.prestige.sackingThreshold).toBe(threshold(state));
    expect(projection.prestige.lastChange).toBeUndefined();
    expect(projection.career).toBeUndefined();
  });

  it("flags dismissal risk at or below the threshold and not above it", () => {
    const { state } = projectionWith(20);
    const t = threshold(state);
    expect(projectionWith(t + 1).projection.prestige.dismissalRisk).toBe(false);
    expect(projectionWith(t).projection.prestige.dismissalRisk).toBe(true);
    expect(projectionWith(t - 1).projection.prestige.dismissalRisk).toBe(true);
  });

  it("exposes the last change with its reason", () => {
    const { projection } = projectionWith(
      19,
      {},
      {
        prestigeLastChange: {
          reasonCode: "BATTLE_LOST",
          before: SafeInt(20),
          after: SafeInt(19),
          delta: SafeInt(-1),
          month: "1880-02",
        },
      },
    );
    expect(projection.prestige.lastChange).toEqual({
      reasonCode: "BATTLE_LOST",
      before: 20,
      after: 19,
      delta: -1,
      month: "1880-02",
    });
    expect(projection.prestige.changeExplanation).toBeUndefined();
  });

  it("explains a recorded last change from the applied rule", () => {
    const { projection } = projectionWith(
      19,
      {},
      {
        prestigeLastChange: {
          reasonCode: "BATTLE_LOST",
          before: SafeInt(20),
          after: SafeInt(19),
          delta: SafeInt(-1),
          month: "1880-02",
          appliedRule: { kind: "PROPORTIONAL_LOSS", basisPoints: SafeInt(500) },
          unclampedAfter: SafeInt(19),
          bounds: { lower: SafeInt(0), upper: SafeInt(100) },
        },
      },
    );
    const tree = projection.prestige.changeExplanation;
    expect(tree?.formulaId).toBe("prestige_change");
    expect(Number(tree?.result)).toBe(projection.prestige.lastChange?.after);
  });

  it("exposes the career result once it exists", () => {
    const { projection } = projectionWith(12, {
      careerResult: {
        nationId: "uk",
        score: SafeInt(12),
        reason: "SACKED",
        month: { year: SafeInt(1880), month: SafeInt(2) },
      },
    });
    expect(projection.career).toEqual({
      reason: "SACKED",
      score: 12,
      month: { year: 1880, month: 2 },
    });
  });
});
