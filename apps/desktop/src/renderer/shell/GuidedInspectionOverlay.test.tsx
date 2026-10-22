/* @vitest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import { GuidedInspectionOverlay } from "./GuidedInspectionOverlay.js";

describe("GuidedInspectionOverlay", () => {
  it("renders step title and N of 7 progress", () => {
    render(<GuidedInspectionOverlay stepIndex={0} onStepChange={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByText("Overview — Your Naval Position")).toBeTruthy();
    expect(screen.getByText("1 of 7")).toBeTruthy();
  });

  it("shows Back only after first step and Next on every step", async () => {
    const { rerender } = render(
      <GuidedInspectionOverlay stepIndex={0} onStepChange={vi.fn()} onDismiss={vi.fn()} />,
    );
    expect(screen.queryByTestId("guided-inspection-back")).toBeNull();
    expect(screen.getByTestId("guided-inspection-next")).toBeTruthy();
    expect(screen.getByTestId("guided-inspection-end")).toBeTruthy();

    rerender(<GuidedInspectionOverlay stepIndex={2} onStepChange={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByTestId("guided-inspection-back")).toBeTruthy();
    expect(screen.getByText("3 of 7")).toBeTruthy();
  });

  it("calls onStepChange on Next and onDismiss on End inspection (must-not: no domain mutation)", async () => {
    const onStepChange = vi.fn();
    const onDismiss = vi.fn();
    render(
      <GuidedInspectionOverlay stepIndex={1} onStepChange={onStepChange} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByTestId("guided-inspection-next"));
    expect(onStepChange).toHaveBeenCalledWith(1, false);
    fireEvent.click(screen.getByTestId("guided-inspection-end"));
    expect(onDismiss).toHaveBeenCalledWith(1);
  });

  it("is non-blocking: overlay has pointer-events-none, card is interactive, no focus trap", () => {
    render(<GuidedInspectionOverlay stepIndex={0} onStepChange={vi.fn()} onDismiss={vi.fn()} />);
    const overlay = screen.getByTestId("guided-inspection-overlay");
    expect(overlay.className).toMatch(/pointer-events-none/);
    const card = screen.getByTestId("guided-inspection-card");
    expect(card.className).toMatch(/pointer-events-auto/);
    expect(card.getAttribute("aria-modal")).toBeNull();
  });

  it("step 7 advance-month is informational: Next on last step signals completion", async () => {
    const onStepChange = vi.fn();
    render(
      <GuidedInspectionOverlay stepIndex={6} onStepChange={onStepChange} onDismiss={vi.fn()} />,
    );
    expect(screen.getByText("Advance Month")).toBeTruthy();
    expect(screen.getByTestId("guided-inspection-next").textContent).toBe("Complete");
    fireEvent.click(screen.getByTestId("guided-inspection-next"));
    expect(onStepChange).toHaveBeenCalledWith(6, true);
  });

  it("tracks nested-container scroll in the capture phase and disables the transition while scrolling", () => {
    const target = document.createElement("div");
    target.setAttribute("data-guided-target", "overview");
    target.getBoundingClientRect = () =>
      ({
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        top: 20,
        left: 10,
        right: 110,
        bottom: 70,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(target);
    render(<GuidedInspectionOverlay stepIndex={0} onStepChange={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByTestId("guided-inspection-highlight").style.transition).toBe(
      "all 180ms ease-out",
    );
    fireEvent.scroll(window);
    expect(screen.getByTestId("guided-inspection-highlight").style.transition).toBe("none");
    target.remove();
  });

  it("respects prefers-reduced-motion: highlight renders without matchMedia", () => {
    const original = (window as unknown as { matchMedia?: unknown }).matchMedia;
    (window as unknown as { matchMedia?: unknown }).matchMedia = undefined;
    const target = document.createElement("div");
    target.setAttribute("data-guided-target", "overview");
    document.body.appendChild(target);
    render(<GuidedInspectionOverlay stepIndex={0} onStepChange={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByTestId("guided-inspection-overlay")).toBeTruthy();
    target.remove();
    (window as unknown as { matchMedia?: unknown }).matchMedia =
      original as unknown as typeof window.matchMedia;
  });
});
