import type { TacticalBattleOutcome } from "@bluewave/campaign-engine";
import { describe, expect, it } from "vite-plus/test";
import { groupEventsByType } from "./event-groups.js";

describe("event-groups", () => {
  it("groups battle events by type in descending count order", () => {
    const outcome = {
      battleEventLedger: {
        battleId: "battle_1",
        events: [
          { turn: 1, eventType: "gunnery_shot", data: {} },
          { turn: 1, eventType: "gunnery_shot", data: {} },
          { turn: 2, eventType: "mine_strike", data: {} },
        ],
      },
    } as unknown as TacticalBattleOutcome;

    const grouped = groupEventsByType(outcome);
    expect(grouped[0]).toEqual({ eventType: "gunnery_shot", count: 2 });
    expect(grouped[1]).toEqual({ eventType: "mine_strike", count: 1 });
  });
});
