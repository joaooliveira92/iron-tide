import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../components/ui/button.js";
import {
  GUIDED_INSPECTION_STEPS,
  GUIDED_STEP_COUNT,
  dismissedInspectionState,
  nextInspectionState,
  type GuidedStep,
} from "./guided-inspection-state.js";

export interface GuidedInspectionOverlayProps {
  readonly stepIndex: number;
  readonly onStepChange: (nextIndex: number, completed: boolean) => void;
  readonly onDismiss: (stepIndex: number) => void;
  readonly onNavigate?: (screenId: string) => void;
}

interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function sameRect(current: Rect | null, next: Rect | null): boolean {
  if (current === null || next === null) return current === next;
  return (
    current.x === next.x &&
    current.y === next.y &&
    current.width === next.width &&
    current.height === next.height
  );
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
    const next = getTargetRect(step.targetSelector);
    setRect((current) => (sameRect(current, next) ? current : next));
  }, [step.targetSelector]);

  useLayoutEffect(() => {
    recompute();
    const handleScroll = () => {
      recompute();
      setScrolling(true);
      if (scrollEndTimer.current !== null) window.clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = window.setTimeout(() => setScrolling(false), 120);
    };
    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", handleScroll, { passive: true, capture: true });
    const id = window.setInterval(recompute, 300);
    return () => {
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.clearInterval(id);
      if (scrollEndTimer.current !== null) window.clearTimeout(scrollEndTimer.current);
    };
  }, [recompute]);

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

export { dismissedInspectionState, nextInspectionState };
