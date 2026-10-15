import { describe, expect, it } from "vite-plus/test";
import {
  GUIDED_INSPECTION_STEPS,
  GUIDED_STEP_COUNT,
  dismissedInspectionState,
  emptyInspection,
  isInspectionActive,
  isInspectionFinished,
  nextInspectionState,
  restartedInspection,
  resumeStepIndex,
  shouldAutoOpen,
} from "./guided-inspection-state.js";
import type { UiStateFirstMonthInspection } from "../../shared/campaign-command-contract.js";

describe("guided-inspection-state", () => {
  it("defines seven steps in the correct order", () => {
    expect(GUIDED_STEP_COUNT).toBe(7);
    expect(GUIDED_INSPECTION_STEPS.map((s) => s.id)).toEqual([
      "overview",
      "treasury",
      "research",
      "construction",
      "fleet",
      "diplomacy",
      "advance-month",
    ]);
  });

  it("every step has a target selector and the last is header advance-month", () => {
    for (const step of GUIDED_INSPECTION_STEPS) {
      expect(step.targetSelector).toMatch(/data-guided-target/);
    }
    expect(GUIDED_INSPECTION_STEPS[6]!.targetSelector).toBe("[data-guided-target='advance-month']");
    expect(GUIDED_INSPECTION_STEPS[6]!.screenId).toBeNull();
  });

  it("shouldAutoOpen only when not_started or undefined", () => {
    expect(shouldAutoOpen(undefined)).toBe(true);
    expect(shouldAutoOpen({ status: "not_started", lastCompletedStep: 0 })).toBe(true);
    expect(shouldAutoOpen({ status: "in_progress", lastCompletedStep: 0 })).toBe(false);
    expect(shouldAutoOpen({ status: "completed", lastCompletedStep: 6 })).toBe(false);
    expect(shouldAutoOpen({ status: "dismissed", lastCompletedStep: 2 })).toBe(false);
  });

  it("isInspectionFinished only for completed/dismissed", () => {
    expect(isInspectionFinished(undefined)).toBe(false);
    expect(isInspectionFinished({ status: "completed", lastCompletedStep: 6 })).toBe(true);
    expect(isInspectionFinished({ status: "dismissed", lastCompletedStep: 1 })).toBe(true);
    expect(isInspectionFinished({ status: "in_progress", lastCompletedStep: 1 })).toBe(false);
  });

  it("isInspectionActive for not_started or in_progress", () => {
    expect(isInspectionActive({ status: "not_started", lastCompletedStep: 0 })).toBe(true);
    expect(isInspectionActive({ status: "in_progress", lastCompletedStep: 2 })).toBe(true);
    expect(isInspectionActive({ status: "completed", lastCompletedStep: 6 })).toBe(false);
  });

  it("resumeStepIndex returns lastCompletedStep+1 or 0 for not_started", () => {
    expect(resumeStepIndex(undefined)).toBe(0);
    expect(resumeStepIndex({ status: "not_started", lastCompletedStep: 0 })).toBe(0);
    expect(resumeStepIndex({ status: "in_progress", lastCompletedStep: 2 })).toBe(3);
    expect(resumeStepIndex({ status: "in_progress", lastCompletedStep: 5 })).toBe(6);
    expect(resumeStepIndex({ status: "completed", lastCompletedStep: 6 })).toBe(0);
  });

  it("nextInspectionState advances without completing until last step", () => {
    const cur: UiStateFirstMonthInspection = { status: "in_progress", lastCompletedStep: 0 };
    expect(nextInspectionState(cur, 0)).toEqual({ status: "in_progress", lastCompletedStep: 0 });
    expect(nextInspectionState(cur, 1)).toEqual({ status: "in_progress", lastCompletedStep: 1 });
    expect(nextInspectionState(cur, 5)).toEqual({ status: "in_progress", lastCompletedStep: 5 });
    expect(nextInspectionState(cur, 6)).toEqual({ status: "completed", lastCompletedStep: 6 });
  });

  it("dismissedInspectionState always dismissed", () => {
    expect(dismissedInspectionState(2)).toEqual({ status: "dismissed", lastCompletedStep: 2 });
    expect(dismissedInspectionState(0)).toEqual({ status: "dismissed", lastCompletedStep: 0 });
  });

  it("restartedInspection resets to not_started", () => {
    expect(restartedInspection()).toEqual({ status: "not_started", lastCompletedStep: 0 });
    expect(emptyInspection()).toEqual({ status: "not_started", lastCompletedStep: 0 });
  });

  it("persists lastCompletedStep and never fabricates domain values — pure", () => {
    const before: UiStateFirstMonthInspection = { status: "in_progress", lastCompletedStep: 3 };
    const next = nextInspectionState(before, 3);
    expect(next.lastCompletedStep).toBe(3);
    expect(next.status).toBe("in_progress");
    // No domain mutation: only status/lastCompletedStep change
    expect(Object.keys(next)).toEqual(["status", "lastCompletedStep"]);
  });
});
