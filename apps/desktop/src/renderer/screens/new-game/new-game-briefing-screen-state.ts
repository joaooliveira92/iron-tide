/**
 * Opening Strategic Briefing screen state (game-onboarding INC-8, spec §8).
 * A 5-page linear sequence: Appointment / State of the Navy / Treasury /
 * Foreign Intelligence / Immediate Concerns. Back always returns to the prior
 * page (never exits); pages 2–4 use generic Next/Back, page 1's forward action
 * is the flavorful "Review Naval Estimates", and page 5 closes with
 * "Take command". There is deliberately no skip logic.
 */

export const OPENING_BRIEFING_PAGE_COUNT = 5;

export const OPENING_BRIEFING_PAGE_TITLES: readonly string[] = [
  "Appointment",
  "State of the Navy",
  "Treasury Position",
  "Foreign Intelligence",
  "Immediate Concerns",
];

/** The first page's forward label (spec §8: keeps the doc's flavorful label). */
export const PAGE_1_NEXT_LABEL = "Review Naval Estimates";
/** The closing page's action (spec §8). */
export const PAGE_LAST_ACTION_LABEL = "Take command";

export function canGoBack(pageIndex: number): boolean {
  return pageIndex > 0;
}

export function canGoNext(pageIndex: number): boolean {
  return pageIndex < OPENING_BRIEFING_PAGE_COUNT - 1;
}

export function previousPageIndex(pageIndex: number): number {
  return Math.max(0, pageIndex - 1);
}

export function nextPageIndex(pageIndex: number): number {
  return Math.min(OPENING_BRIEFING_PAGE_COUNT - 1, pageIndex + 1);
}
