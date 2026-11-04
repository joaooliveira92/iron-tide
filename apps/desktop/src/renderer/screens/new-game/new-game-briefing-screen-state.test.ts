import { describe, expect, it } from "vite-plus/test";
import {
  OPENING_BRIEFING_PAGES,
  OPENING_BRIEFING_PAGE_COUNT,
  OPENING_BRIEFING_PAGE_TITLES,
  PAGE_LAST_ACTION_LABEL,
  BRIEFING_SCREEN_TITLE,
  canGoBack,
  canGoNext,
  forwardLabel,
  nextPageIndex,
  nextPageTitle,
  openingBriefingPageAt,
  previousPageIndex,
} from "./new-game-briefing-screen-state.js";

describe("new-game-briefing-screen-state", () => {
  it("defines the five-page linear sequence with the specified labels", () => {
    expect(OPENING_BRIEFING_PAGE_COUNT).toBe(5);
    expect(OPENING_BRIEFING_PAGES.map((page) => page.id)).toEqual([
      "appointment",
      "state_of_the_navy",
      "treasury_position",
      "foreign_intelligence",
      "immediate_concerns",
    ]);
    expect(OPENING_BRIEFING_PAGES.map((page) => page.forwardLabel)).toEqual([
      "Review Naval Estimates",
      "Continue to Treasury Position",
      "Continue to Foreign Intelligence",
      "Continue to Immediate Concerns",
      "Take command",
    ]);
    expect(OPENING_BRIEFING_PAGE_TITLES).toEqual(OPENING_BRIEFING_PAGES.map((page) => page.title));
  });

  it("marks only the foreign-intelligence page as review-only", () => {
    expect(OPENING_BRIEFING_PAGES.filter((page) => page.reviewOnly).map((page) => page.id)).toEqual(
      ["foreign_intelligence"],
    );
  });

  it("resolves a page by index and reads the neighbour titles", () => {
    expect(openingBriefingPageAt(0)?.title).toBe("Appointment");
    expect(openingBriefingPageAt(3)?.id).toBe("foreign_intelligence");
    expect(openingBriefingPageAt(5)).toBeNull();
    expect(openingBriefingPageAt(-1)).toBeNull();

    expect(forwardLabel(0)).toBe("Review Naval Estimates");
    expect(forwardLabel(99)).toBe(PAGE_LAST_ACTION_LABEL);
    expect(nextPageTitle(3)).toBe("Immediate Concerns");
    expect(nextPageTitle(4)).toBe("");
    expect(BRIEFING_SCREEN_TITLE).toBe("Opening Strategic Briefing");
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
