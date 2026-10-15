/* @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { NewGameLaunchingScreen } from "./NewGameLaunchingScreen.js";
import {
  CHECKLIST_LINES,
  CHECKLIST_REVEAL_INTERVAL_MS,
  FLAVOR_MESSAGES,
  FLAVOR_ROTATION_INTERVAL_MS,
} from "./world-generation-presentation.js";

beforeAll(() => {
  if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverStub {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
  }
});

describe("NewGameLaunchingScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("reveals the checklist one line at a time up to all nine, verbatim", () => {
    render(<NewGameLaunchingScreen error={null} onBackToReview={vi.fn()} />);

    expect(screen.getByText(CHECKLIST_LINES[0]!)).toBeTruthy();
    expect(screen.queryByText(CHECKLIST_LINES[1]!)).toBeNull();

    for (let revealed = 1; revealed < CHECKLIST_LINES.length; revealed += 1) {
      act(() => {
        vi.advanceTimersByTime(CHECKLIST_REVEAL_INTERVAL_MS);
      });
      expect(screen.getByText(CHECKLIST_LINES[revealed]!)).toBeTruthy();
    }

    // Holds on the final line — advancing further reveals nothing new.
    act(() => {
      vi.advanceTimersByTime(CHECKLIST_REVEAL_INTERVAL_MS * 3);
    });
    for (const line of CHECKLIST_LINES) {
      expect(screen.getByText(line)).toBeTruthy();
    }
  });

  it("rotates the four flavor-text messages verbatim on their own interval", () => {
    render(<NewGameLaunchingScreen error={null} onBackToReview={vi.fn()} />);

    expect(screen.getByText(FLAVOR_MESSAGES[0]!)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(FLAVOR_ROTATION_INTERVAL_MS);
    });
    expect(screen.getByText(FLAVOR_MESSAGES[1]!)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(FLAVOR_ROTATION_INTERVAL_MS);
    });
    expect(screen.getByText(FLAVOR_MESSAGES[2]!)).toBeTruthy();
  });

  it("shows the error state with a working Back to Commissioning Review action instead of the checklist", () => {
    const onBackToReview = vi.fn();
    render(<NewGameLaunchingScreen error="COMPILE_FAILED. boom" onBackToReview={onBackToReview} />);

    expect(screen.getByText("COMPILE_FAILED. boom")).toBeTruthy();
    expect(screen.queryByText(CHECKLIST_LINES[0]!)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back to Commissioning Review" }));
    expect(onBackToReview).toHaveBeenCalledTimes(1);
  });
});
