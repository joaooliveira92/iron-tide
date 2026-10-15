import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button.js";
import {
  GUIDED_INSPECTION_STEPS,
  GUIDED_STEP_COUNT,
  dismissedInspectionState,
  nextInspectionState,
  type GuidedStep,
} from "./guided-inspection-state.js";

export interface GuidedInspectionOverlayProps {
  /** Current step index (0-based). */
  readonly stepIndex: number;
  /** Called when the user advances one step (or completes on last step). */
  readonly onStepChange: (nextIndex: number, completed: boolean) => void;
  /** Called when the user ends/dismisses the guide. */
  readonly onDismiss: (stepIndex: number) => void;
  /** Called to navigate to a screen; overlay does not block navigation. */
  readonly onNavigate?: (screenId: string) => void;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

function getTargetRect(selector: string): Rect | null {
  const el = document.querySelector<HTMLElement>(selector);
  if (el === null) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return { x: r.x, y: r.y, width: r.width, height: r.height };
}

export function GuidedInspectionOverlay({
  stepIndex,
  onStepChange,
  onDismiss,
  onNavigate,
}: GuidedInspectionOverlayProps) {
  const clamped = Math.max(0, Math.min(stepIndex, GUIDED_STEP_COUNT - 1));
  const step: GuidedStep = GUIDED_INSPECTION_STEPS[clamped]!;
  const [rect, setRect] = useState<Rect | null>(null);
  const [scrolling, setScrolling] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollEndTimer = useRef<number | null>(null);

  const recompute = useCallback(() => {
    setRect(getTargetRect(step.targetSelector));
  }, [step.targetSelector]);

  useLayoutEffect(() => {
    recompute();
    // The shell scrolls a nested `overflow-auto` element, not the window, and `scroll`
    // does not bubble — so track it in the capture phase and keep the ring glued to the
    // target instead of trailing it. Suppress the transition while scrolling so the ring
    // does not animate lazily behind a moving target.
    const handleScroll = () => {
      recompute();
      setScrolling(true);
      if (scrollEndTimer.current !== null) window.clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = window.setTimeout(() => setScrolling(false), 120);
    };
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", handleScroll, true);
    // Recompute on navigation/re-render — a short interval covers SPA re-mounts without
    // needing a MutationObserver; the interval is cleaned up on unmount.
    const id = window.setInterval(recompute, 300);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", handleScroll, true);
      window.clearInterval(id);
      if (scrollEndTimer.current !== null) window.clearTimeout(scrollEndTimer.current);
    };
  }, [recompute]);

  // Keep step card keyboard-reachable; no focus trap.
  useEffect(() => {
    // Announce step change to assistive tech via live region (handled by aria-live).
  }, [clamped]);

  const isLast = clamped === GUIDED_STEP_COUNT - 1;

  const handleNext = () => {
    if (isLast) {
      onStepChange(clamped, true);
      return;
    }
    const next = clamped + 1;
    const nextStep = GUIDED_INSPECTION_STEPS[next];
    if (nextStep?.screenId !== undefined && nextStep.screenId !== null) {
      onNavigate?.(nextStep.screenId);
    }
    // Persist lastCompletedStep as current, so resume lands on next.
    // The caller maps this to the inspection state via nextInspectionState.
    onStepChange(clamped, false);
  };

  const handleBack = () => {
    if (clamped === 0) return;
    const prev = clamped - 1;
    const prevStep = GUIDED_INSPECTION_STEPS[prev];
    if (prevStep?.screenId !== undefined && prevStep.screenId !== null) {
      onNavigate?.(prevStep.screenId);
    }
    onStepChange(prev, false);
  };

  const handleDismiss = () => {
    onDismiss(clamped);
  };

  // Scrim + punch-out: four covering rects around the highlight; no pointer-events trap
  // over the page except on the card itself. The highlight ring is pointer-events:none.
  const hasRect = rect !== null;
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <div
      ref={overlayRef}
      data-testid="guided-inspection-overlay"
      aria-live="polite"
      className="fixed inset-0 z-40 pointer-events-none"
    >
      <div
        data-testid="guided-inspection-scrim"
        className="absolute inset-0 bg-black/40"
        style={{ opacity: hasRect ? 0.4 : 0.4 }}
        aria-hidden="true"
      />
      {hasRect && (
        <div
          data-testid="guided-inspection-highlight"
          aria-hidden="true"
          className="absolute rounded-lg border-2 border-white shadow-lg"
          style={{
            left: rect.x - 6,
            top: rect.y - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            transition: prefersReducedMotion || scrolling ? "none" : "all 180ms ease-out",
            pointerEvents: "none",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.35), 0 0 18px rgba(255,255,255,0.6)",
          }}
        />
      )}

      {/* Step card — pointer-events auto so it is interactive; overlay itself is non-blocking. */}
      <div
        data-testid="guided-inspection-card"
        className="pointer-events-auto absolute max-w-sm rounded-lg border bg-card p-4 shadow-xl"
        style={{
          top: 80,
          right: 24,
        }}
        role="dialog"
        aria-label={`${step.title} — step ${clamped + 1} of ${GUIDED_STEP_COUNT}`}
      >
        <div className="space-y-2">
          <h2 className="text-sm font-semibold">{step.title}</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
          <p className="text-xs text-muted-foreground">
            {clamped + 1} of {GUIDED_STEP_COUNT}
          </p>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {clamped > 0 && (
            <Button
              variant="outline"
              size="sm"
              data-testid="guided-inspection-back"
              onClick={handleBack}
            >
              Back
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            data-testid="guided-inspection-next"
            onClick={handleNext}
          >
            {isLast ? "Complete" : "Next"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="guided-inspection-end"
            onClick={handleDismiss}
          >
            End inspection
          </Button>
        </div>
      </div>
    </div>
  );
}

// Re-export helpers for test convenience
export { dismissedInspectionState, nextInspectionState };
