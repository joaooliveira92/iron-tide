export type OpeningBriefingPageId =
  | "appointment"
  | "state_of_the_navy"
  | "treasury_position"
  | "foreign_intelligence"
  | "immediate_concerns";

export interface OpeningBriefingPage {
  readonly id: OpeningBriefingPageId;
  readonly title: string;
  readonly forwardLabel: string;
  readonly reviewOnly: boolean;
}

export const BRIEFING_SCREEN_TITLE = "Opening Strategic Briefing";

export const PAGE_LAST_ACTION_LABEL = "Take command";

export const OPENING_BRIEFING_PAGES: readonly OpeningBriefingPage[] = [
  {
    id: "appointment",
    title: "Appointment",
    forwardLabel: "Review Naval Estimates",
    reviewOnly: false,
  },
  {
    id: "state_of_the_navy",
    title: "State of the Navy",
    forwardLabel: "Continue to Treasury Position",
    reviewOnly: false,
  },
  {
    id: "treasury_position",
    title: "Treasury Position",
    forwardLabel: "Continue to Foreign Intelligence",
    reviewOnly: false,
  },
  {
    id: "foreign_intelligence",
    title: "Foreign Intelligence",
    forwardLabel: "Continue to Immediate Concerns",
    reviewOnly: true,
  },
  {
    id: "immediate_concerns",
    title: "Immediate Concerns",
    forwardLabel: PAGE_LAST_ACTION_LABEL,
    reviewOnly: false,
  },
];

export const OPENING_BRIEFING_PAGE_COUNT = OPENING_BRIEFING_PAGES.length;

export const OPENING_BRIEFING_PAGE_TITLES: readonly string[] = OPENING_BRIEFING_PAGES.map(
  (page) => page.title,
);

export function openingBriefingPageAt(index: number): OpeningBriefingPage | null {
  return OPENING_BRIEFING_PAGES[index] ?? null;
}

export function forwardLabel(pageIndex: number): string {
  return openingBriefingPageAt(pageIndex)?.forwardLabel ?? PAGE_LAST_ACTION_LABEL;
}

export function nextPageTitle(pageIndex: number): string {
  return openingBriefingPageAt(pageIndex + 1)?.title ?? "";
}

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
