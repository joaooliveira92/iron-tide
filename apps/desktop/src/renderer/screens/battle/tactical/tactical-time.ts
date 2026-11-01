export const TACTICAL_TIME_SCALES = [1, 2, 4, 8] as const;
export type TacticalTimeScale = (typeof TACTICAL_TIME_SCALES)[number];

export const DEFAULT_TIME_SCALE: TacticalTimeScale = 1;
export const PROVISIONAL_BASE_STEP_INTERVAL_MS = 1_000;

export function stepIntervalMs(scale: TacticalTimeScale): number {
  return Math.floor(PROVISIONAL_BASE_STEP_INTERVAL_MS / scale);
}

export function isTimeScale(value: number): value is TacticalTimeScale {
  return TACTICAL_TIME_SCALES.some((scale) => scale === value);
}

export function formatTacticalClock(minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
