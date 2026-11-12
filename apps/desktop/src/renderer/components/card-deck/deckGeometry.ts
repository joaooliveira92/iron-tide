import type { Layout, Placement, Sample, Vector } from "./deckTypes.js";

export const ORIGINS: Record<Layout, Vector> = {
  fan: [0.9, 0.9],
  cascade: [0.5, 0.5],
  deck: [0.5, 0],
  pile: [0.5, 0.5],
};

export const EXITS: Partial<Record<Layout, Vector>> = {
  fan: [1, -0.3],
  cascade: [0.8, 0.6],
  deck: [0, 1],
};

export const SHADOW = "0 14px 34px -10px rgba(0, 0, 0, 0.45), 0 3px 8px -2px rgba(0, 0, 0, 0.18)";
export const CLICK_SLOP = 6;
export const FLICK_SPEED = 650;
export const LEAN_SPEED = 1300;
export const LEAN_REACH = 260;
export const PRESS_SCALE = 1.035;

export const SPRINGS = {
  place: [260, 24],
  settle: [320, 34],
  tuck: [240, 28],
  face: [240, 30],
  lean: [240, 28],
  press: [420, 34],
  fling: [650, 42],
} as const;

export type SpringKind = keyof typeof SPRINGS;

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

export const noise = (seed: number): number => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};

export function placement(
  layout: Layout,
  position: number,
  card: number,
  spread: number,
  depth: number,
): Placement {
  if (layout === "cascade") {
    return {
      x: -position * spread * 28,
      y: -position * spread * 28,
      rotate: 0,
      scale: 1 - position * depth * 0.07,
    };
  }
  if (layout === "deck") {
    return { x: 0, y: -position * spread * 32, rotate: 0, scale: 1 - position * depth * 0.1 };
  }
  if (layout === "pile") {
    return {
      x: (noise(card + 1) - 0.5) * spread * 56,
      y: (noise(card + 2) - 0.5) * spread * 44,
      rotate: (noise(card + 3) - 0.5) * spread * 40,
      scale: 1 - position * depth * 0.03,
    };
  }
  return { x: 0, y: 0, rotate: position * spread * 8, scale: 1 - position * depth * 0.12 };
}

export function releaseVelocity(samples: Sample[], time: number): Vector {
  const recent = samples.filter((sample) => time - sample[2] <= 100);
  if (recent.length < 2) return [0, 0];
  const first = recent[0] as Sample;
  const last = recent[recent.length - 1] as Sample;
  const elapsed = Math.max((last[2] - first[2]) / 1000, 0.008);
  return [(last[0] - first[0]) / elapsed, (last[1] - first[1]) / elapsed];
}

export function initialOrder(count: number, topIndex: number | undefined): number[] {
  const base = Array.from({ length: count }, (_, index) => index);
  if (topIndex === undefined || topIndex <= 0 || topIndex >= count) return base;
  return [topIndex, ...base.filter((index) => index !== topIndex)];
}
