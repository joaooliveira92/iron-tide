import { describe, expect, it } from "vite-plus/test";
import {
  OPENING_BRIEFING_PAGE_COUNT,
  PAGE_1_NEXT_LABEL,
  PAGE_LAST_ACTION_LABEL,
  canGoBack,
  canGoNext,
  nextPageIndex,
  previousPageIndex,
} from "./new-game-briefing-screen-state.js";

describe("new-game-briefing-screen-state", () => {
  it("defines the five-page linear sequence with the specified labels", () => {
    expect(OPENING_BRIEFING_PAGE_COUNT).toBe(5);
    expect(PAGE_1_NEXT_LABEL).toBe("Review Naval Estimates");
    expect(PAGE_LAST_ACTION_LABEL).toBe("Take command");
  });

  it("clamps back/next navigation to the first and last pages", () => {
    expect(canGoBack(0)).toBe(false);
    expect(canGoBack(1)).toBe(true);
    expect(canGoNext(4)).toBe(false);
    expect(canGoNext(3)).toBe(true);

    expect(previousPageIndex(0)).toBe(0);
    expect(previousPageIndex(2)).toBe(1);
    expect(nextPageIndex(4)).toBe(4);
    expect(nextPageIndex(2)).toBe(3);
  });
});
