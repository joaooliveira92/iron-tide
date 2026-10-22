import type { UiStateFirstMonthInspection } from "../../shared/ui-state-contract.js";

export type InspectionStatus = UiStateFirstMonthInspection["status"];

export interface GuidedStep {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly targetSelector: string;
  readonly screenId: string | null;
}

export const GUIDED_INSPECTION_STEPS: readonly GuidedStep[] = [
  {
    id: "overview",
    title: "Overview — Your Naval Position",
    description:
      "The world map with your fleets, areas and nations; your treasury and balance sit in the status strip below.",
    targetSelector: "[data-guided-target='overview']",
    screenId: "overview",
  },
  {
    id: "treasury",
    title: "Treasury",
    description: "Income, maintenance, and projected balance for the coming month.",
    targetSelector: "[data-guided-target='treasury']",
    screenId: "treasury",
  },
  {
    id: "research",
    title: "Research & Technology",
    description: "Set field priorities to steer where your research budget is spent.",
    targetSelector: "[data-guided-target='research']",
    screenId: "research",
  },
  {
    id: "construction",
    title: "Construction",
    description: "Authorize and monitor ship construction projects.",
    targetSelector: "[data-guided-target='construction']",
    screenId: "construction",
  },
  {
    id: "fleet",
    title: "Fleet",
    description: "Inspect fleets, ships, and their readiness.",
    targetSelector: "[data-guided-target='fleet']",
    screenId: "fleet",
  },
  {
    id: "diplomacy",
    title: "Foreign Relations",
    description: "Track tensions and standing with other powers.",
    targetSelector: "[data-guided-target='diplomacy']",
    screenId: "diplomacy",
  },
  {
    id: "advance-month",
    title: "Advance Month",
    description:
      "When ready, advance the month to resolve the strategic turn and see the Monthly Naval Estimates.",
    targetSelector: "[data-guided-target='advance-month']",
    screenId: null,
  },
] as const;

export const GUIDED_STEP_COUNT = GUIDED_INSPECTION_STEPS.length;

export function emptyInspection(): UiStateFirstMonthInspection {
  return { status: "not_started", lastCompletedStep: 0 };
}

export function shouldAutoOpen(inspection: UiStateFirstMonthInspection | undefined): boolean {
  if (inspection === undefined) return true;
  return inspection.status === "not_started";
}

export function isInspectionActive(inspection: UiStateFirstMonthInspection | undefined): boolean {
  if (inspection === undefined) return false;
  return inspection.status === "in_progress" || inspection.status === "not_started";
}

export function isInspectionFinished(inspection: UiStateFirstMonthInspection | undefined): boolean {
  if (inspection === undefined) return false;
  return inspection.status === "completed" || inspection.status === "dismissed";
}

export function clampStep(n: number): number {
  if (n < 0) return 0;
  if (n >= GUIDED_STEP_COUNT) return GUIDED_STEP_COUNT - 1;
  return n;
}

export function resumeStepIndex(inspection: UiStateFirstMonthInspection | undefined): number {
  if (inspection === undefined) return 0;
  if (inspection.status === "not_started") return 0;
  if (inspection.status === "completed" || inspection.status === "dismissed") return 0;
  return clampStep(
    inspection.lastCompletedStep + 1 >= GUIDED_STEP_COUNT
      ? GUIDED_STEP_COUNT - 1
      : inspection.lastCompletedStep + 1,
  );
}

export function nextInspectionState(
  current: UiStateFirstMonthInspection | undefined,
  currentStepIndex: number,
): UiStateFirstMonthInspection {
  const nextIndex = clampStep(currentStepIndex);
  if (nextIndex >= GUIDED_STEP_COUNT - 1) {
    return { status: "completed", lastCompletedStep: GUIDED_STEP_COUNT - 1 };
  }
  return { status: "in_progress", lastCompletedStep: nextIndex };
}

export function dismissedInspectionState(currentStepIndex: number): UiStateFirstMonthInspection {
  return {
    status: "dismissed",
    lastCompletedStep: clampStep(currentStepIndex),
  };
}

export function restartedInspection(): UiStateFirstMonthInspection {
  return { status: "not_started", lastCompletedStep: 0 };
}
