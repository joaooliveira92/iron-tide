export const WHEEL_THRESHOLD_PX = 32;
export const WHEEL_COOLDOWN_MS = 360;

const LINE_HEIGHT_PX = 16;
const PAGE_HEIGHT_PX = 100;

const DOM_DELTA_LINE = 1;
const DOM_DELTA_PAGE = 2;

export function normalizeIndex(index: number, count: number): number {
  if (count === 0) return 0;
  return ((index % count) + count) % count;
}

export interface WheelStepper {
  readonly push: (deltaY: number, deltaMode: number) => void;
  readonly dispose: () => void;
}

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
