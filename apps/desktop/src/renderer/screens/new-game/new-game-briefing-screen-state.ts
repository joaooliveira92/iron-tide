export const OPENING_BRIEFING_PAGE_COUNT = 5;

export const OPENING_BRIEFING_PAGE_TITLES: readonly string[] = [
  "Appointment",
  "State of the Navy",
  "Treasury Position",
  "Foreign Intelligence",
  "Immediate Concerns",
];

export const OPENING_BRIEFING_FORWARD_LABELS: readonly string[] = [
  "Review Naval Estimates",
  "Continue to Treasury Position",
  "Continue to Foreign Intelligence",
  "Continue to Immediate Concerns",
  "Take command",
];

export function forwardLabel(pageIndex: number): string {
  return OPENING_BRIEFING_FORWARD_LABELS[pageIndex] ?? PAGE_LAST_ACTION_LABEL;
}

export const PAGE_1_NEXT_LABEL = "Review Naval Estimates";
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
