import type { KeyboardEvent, PointerEvent } from "react";
import { SPLIT_DEFAULT, SPLIT_MAX, SPLIT_MIN } from "./useSplitWidth.js";

const STEP = 2;

/**
 * The draggable bar between the ship view and the tab content (WAI-ARIA window splitter). Arrow keys move it,
 * Home/End jump to the limits, Enter restores the default; dragging sets the share from the pointer position
 * within `container`.
 */
export function SplitDivider({
  value,
  onChange,
  controls,
  className,
}: {
  /** Ship-view share of the workspace, in percent. */
  readonly value: number;
  readonly onChange: (pct: number) => void;
  /** Id of the pane whose size this divider sets. */
  readonly controls: string;
  readonly className?: string;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const next =
      e.key === "ArrowLeft"
        ? value - STEP
        : e.key === "ArrowRight"
          ? value + STEP
          : e.key === "Home"
            ? SPLIT_MIN
            : e.key === "End"
              ? SPLIT_MAX
              : e.key === "Enter"
                ? SPLIT_DEFAULT
                : null;
    if (next === null) return;
    e.preventDefault();
    onChange(next);
  };
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.parentElement?.getBoundingClientRect();
    if (box && box.width > 0) onChange(((e.clientX - box.left) / box.width) * 100);
  };
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize ship view"
      aria-controls={controls}
      aria-valuenow={value}
      aria-valuemin={SPLIT_MIN}
      aria-valuemax={SPLIT_MAX}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={(e) => e.currentTarget.setPointerCapture(e.pointerId)}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e);
      }}
      onPointerUp={(e) => e.currentTarget.releasePointerCapture(e.pointerId)}
      onDoubleClick={() => onChange(SPLIT_DEFAULT)}
      className={`group relative cursor-col-resize touch-none justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
    >
      <span
        aria-hidden="true"
        className="h-full w-px bg-border transition-colors group-hover:bg-primary group-focus-visible:bg-primary"
      />
    </div>
  );
}
