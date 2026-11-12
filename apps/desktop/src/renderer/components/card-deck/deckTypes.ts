import type { MotionValue, ValueAnimationTransition } from "motion/react";
import type { RefObject } from "react";
import type { SpringKind } from "./deckGeometry.js";

export type Layout = "fan" | "cascade" | "deck" | "pile";
export type Elevation = "raised" | "flat";
export type TapAction = "activate" | "sendToBack";
export type AutoplayPause = "never" | "hover";
export type Placement = { x: number; y: number; rotate: number; scale: number };
export type Sample = [number, number, number];
export type Vector = [number, number];

export interface Settings {
  layout: Layout;
  visible: number;
  spread: number;
  depth: number;
  tilt: number;
  threshold: number;
  speed: number;
  tap: TapAction;
  count: number;
  reduceMotion: boolean;
}

export interface MotionValues {
  x: MotionValue<number>;
  y: MotionValue<number>;
  rotate: MotionValue<number>;
  scale: MotionValue<number>;
  tiltX: MotionValue<number>;
  tiltY: MotionValue<number>;
  spin: MotionValue<number>;
  lift: MotionValue<number>;
  grabX: MotionValue<number>;
  grabY: MotionValue<number>;
  z: MotionValue<number>;
  opacity: MotionValue<number>;
  shade: MotionValue<number>;
}

export interface DragState {
  card: number;
  id: number;
  element: HTMLElement;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  homeX: number;
  homeY: number;
  vx: number;
  vy: number;
  idle: ReturnType<typeof setTimeout> | null;
  moved: boolean;
  progress: number;
  samples: Sample[];
}

export interface PlaceOptions {
  delay?: number;
  lift?: number;
  kind?: SpringKind;
  velocity?: Vector | null;
  keepZ?: boolean;
}

export interface PlaceAllOptions {
  stagger?: number;
  lift?: number;
  released?: number;
  velocity?: Vector | null;
  kind?: SpringKind;
}

export interface Flight {
  turned: boolean;
}

export interface Ref<T> {
  current: T;
}

export interface DeckRefs {
  root: RefObject<HTMLDivElement | null>;
  order: Ref<number[]>;
  values: Ref<Map<number, MotionValues>>;
  elements: Ref<Map<number, HTMLElement>>;
  flying: Ref<Map<number, Flight>>;
  drag: Ref<DragState | null>;
  alive: Ref<boolean>;
  settings: Ref<Settings>;
  onChange: Ref<((index: number) => void) | undefined>;
  onCardActivate: Ref<((index: number) => void) | undefined>;
}

export interface DeckMotion {
  valuesFor: (index: number) => MotionValues;
  springFor: (kind: SpringKind, extra?: { delay?: number }) => ValueAnimationTransition;
  settleFace: (values: MotionValues, delay?: number) => void;
  placeCard: (index: number, position: number, options?: PlaceOptions) => void;
  placeAll: (options?: PlaceAllOptions) => void;
}
