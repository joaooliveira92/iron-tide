import type { HullPlanEditing } from "./useHullPlanEditing.js";

export function PlanDragGhost({
  useGhostPosition,
}: {
  readonly useGhostPosition: HullPlanEditing["useGhostPosition"];
}) {
  const at = useGhostPosition();
  return at === null ? null : (
    <circle
      cx={at.x}
      cy={at.y}
      r={7}
      fill="none"
      stroke="currentColor"
      strokeDasharray="3 2"
      pointerEvents="none"
      data-testid="plan-drag-ghost"
      aria-hidden="true"
    />
  );
}
