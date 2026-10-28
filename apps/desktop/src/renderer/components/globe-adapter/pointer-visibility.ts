import type { HorizonClass } from "../globe-spike/horizon.js";

export const HORIZON_HYSTERESIS_DEGREES = 0.05;

export interface PointerCandidate {
  readonly id: string;
  readonly horizon: HorizonClass;
  readonly rendered: boolean;
  readonly projectVisible?: boolean;
  readonly hidden?: boolean;
}

export function isHorizonSelectable(horizon: HorizonClass): boolean {
  return horizon !== "back";
}

export function selectPointerTarget(candidates: readonly PointerCandidate[]): string | null {
  for (const candidate of candidates) {
    if (candidate.hidden === true) continue;
    if (!candidate.rendered) continue;
    if (!isHorizonSelectable(candidate.horizon)) continue;
    return candidate.id;
  }
  return null;
}

export function renderedPointerTargets(candidates: readonly PointerCandidate[]): readonly string[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.hidden !== true && candidate.rendered && isHorizonSelectable(candidate.horizon),
    )
    .map((candidate) => candidate.id);
}

export function projectOnlyFalsePositive(
  candidates: readonly PointerCandidate[],
): readonly string[] {
  return candidates
    .filter((candidate) => candidate.projectVisible === true && !candidate.rendered)
    .map((candidate) => candidate.id);
}

export function stableHorizonClass(
  previous: HorizonClass | null,
  next: HorizonClass,
  marginDegrees: number,
): HorizonClass {
  if (previous === null) return next;
  if (previous !== "front" && previous !== "horizon" && previous !== "back") return next;
  if (previous === next) return next;
  if (Math.abs(marginDegrees) <= HORIZON_HYSTERESIS_DEGREES) return previous;
  return next;
}

export function backSideCannotBeSelected(candidate: PointerCandidate): boolean {
  return candidate.horizon === "back" && selectPointerTarget([candidate]) === null;
}
