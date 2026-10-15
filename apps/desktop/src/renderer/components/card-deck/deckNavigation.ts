/**
 * Pure navigation helpers shared by every master card deck (Fleet Dispatch and
 * the Rules-of-the-Naval-Age preset deck), so the two surfaces cannot drift on
 * how arrows wrap or how the wheel steps. Presentation-only: nothing here reads
 * or draws authoritative state or randomness.
 */

/** Accumulated wheel travel, in px, that must be crossed before the deck steps. */
export const WHEEL_THRESHOLD_PX = 32;
/** After a step, further wheel input is ignored for this long. */
export const WHEEL_COOLDOWN_MS = 360;

const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 100;

const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

/** Wraps `index` into `[0, count)`; an empty deck is index 0 rather than NaN. */
export function normalizeIndex(index: number, count: number): number {
  if (count === 0) return 0;
  return ((index % count) + count) % count;
}

export interface WheelStepper {
  /** Feeds one wheel event's `deltaY`/`deltaMode`; calls `onStep` when it crosses the threshold. */
  readonly push: (deltaY: number, deltaMode: number) => void;
  /** Cancels the pending cooldown timer. */
  readonly dispose: () => void;
}

/**
 * Turns a stream of wheel deltas into discrete ±1 steps: pixel-normalised
 * accumulation, a threshold, then a cooldown so one flick moves one card.
 */
export function createWheelStepper(onStep: (direction: 1 | -1) => void): WheelStepper {
  let accumulated = 0;
  let locked = false;
  let unlockTimer: ReturnType<typeof setTimeout> | null = null;

  const push = (deltaY: number, deltaMode: number): void => {
    if (locked) return;

    let delta = deltaY;
    if (deltaMode === DOM_DELTA_LINE) delta *= LINE_HEIGHT_PX;
    else if (deltaMode === DOM_DELTA_PAGE) delta *= PAGE_HEIGHT_PX;

    accumulated += delta;
    if (Math.abs(accumulated) < WHEEL_THRESHOLD_PX) return;

    const direction = accumulated > 0 ? 1 : -1;
    locked = true;
    accumulated = 0;
    if (unlockTimer !== null) clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => {
      locked = false;
      unlockTimer = null;
    }, WHEEL_COOLDOWN_MS);
    onStep(direction);
  };

  const dispose = (): void => {
    if (unlockTimer !== null) clearTimeout(unlockTimer);
    unlockTimer = null;
    locked = false;
  };

  return { push, dispose };
}
