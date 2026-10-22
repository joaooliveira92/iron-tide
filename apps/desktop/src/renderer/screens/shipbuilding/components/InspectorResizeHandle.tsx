import type { KeyboardEvent, PointerEvent } from "react";
import {
  INSPECTOR_DEFAULT_PX,
  INSPECTOR_MAX_PX,
  INSPECTOR_MIN_PX,
  INSPECTOR_RESIZE_STEP_PX,
} from "../inspector-layout.js";

export interface InspectorResizeHandleProps {
  readonly widthPx: number;
  readonly onChange: (px: number) => void;
  readonly controls: string;
  readonly className?: string;
}

export function InspectorResizeHandle({
  widthPx,
  onChange,
  controls,
  className,
}: InspectorResizeHandleProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === "ArrowLeft"
        ? widthPx + INSPECTOR_RESIZE_STEP_PX
        : e.key === "ArrowRight"
          ? widthPx - INSPECTOR_RESIZE_STEP_PX
          : e.key === "Home"
            ? INSPECTOR_MIN_PX
            : e.key === "End"
              ? INSPECTOR_MAX_PX
              : e.key === "Enter"
                ? INSPECTOR_DEFAULT_PX
                : null;
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  };
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.parentElement?.getBoundingClientRect();
    if (box && box.width > 0) onChange(box.right - e.clientX);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize inspector"
      aria-controls={controls}
      aria-valuenow={widthPx}
      aria-valuemin={INSPECTOR_MIN_PX}
      aria-valuemax={INSPECTOR_MAX_PX}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e);
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      onPointerCancel={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onDoubleClick={() => onChange(INSPECTOR_DEFAULT_PX)}
      className={`group relative cursor-col-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary"
      />
    </div>
  );
}
