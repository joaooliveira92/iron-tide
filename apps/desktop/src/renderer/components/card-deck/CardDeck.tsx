"use client";

import { motion, useReducedMotion } from "motion/react";
import {
  type CSSProperties,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import "./CardDeck.css";
import { DeckContext, type DeckContextValue, useDeck } from "./deckContext.js";
import { clamp, initialOrder, ORIGINS, SHADOW } from "./deckGeometry.js";
import type {
  AutoplayPause,
  Elevation,
  Layout,
  PlaceAllOptions,
  Settings,
  TapAction,
  Vector,
} from "./deckTypes.js";
import { useDeckFlight } from "./useDeckFlight.js";
import { useDeckGestures } from "./useDeckGestures.js";
import { useDeckMotion } from "./useDeckMotion.js";
import { useDeckRefs } from "./useDeckRefs.js";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface CardDeckRootProps {
  count: number;
  layout?: Layout;
  visible?: number;
  spread?: number;
  depth?: number;
  radius?: number;
  frame?: number;
  frameColor?: string;
  elevation?: Elevation;
  tilt?: number;
  threshold?: number;
  speed?: number;
  tap?: TapAction;
  onChange?: (index: number) => void;
  topIndex?: number;
  onCardActivate?: (index: number) => void;
  children?: ReactNode;
}

function CardDeckRoot({
  count,
  layout = "fan",
  visible = 4,
  spread = 0.5,
  depth = 0.5,
  radius = 16,
  frame = 0,
  frameColor = "#ffffff",
  elevation = "raised",
  tilt = 30,
  threshold = 90,
  speed = 1,
  tap = "activate",
  onChange,
  topIndex,
  onCardActivate,
  children,
}: CardDeckRootProps): React.JSX.Element {
  const shape: Layout = layout in ORIGINS ? layout : "fan";
  const reduceMotion = useReducedMotion();
  const [order, setOrder] = useState<number[]>(() => initialOrder(count, topIndex));
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const mountedRef = useRef(false);

  const settings: Settings = {
    layout: shape,
    visible: clamp(Math.round(visible), 1, Math.max(count, 1)),
    spread: clamp(spread, 0, 2),
    depth: clamp(depth, 0, 1),
    tilt: clamp(tilt, 0, 89),
    threshold: Math.max(threshold, 0),
    speed: clamp(speed, 0.2, 4),
    tap,
    count,
    reduceMotion: !!reduceMotion,
  };
  const refs = useDeckRefs(settings, order, onChange, onCardActivate);

  if (order.length !== count || order.some((index) => index >= count)) {
    const next = order.filter((index) => index < count);
    for (let index = 0; index < count; index++) if (!next.includes(index)) next.push(index);
    refs.order.current = next;
    setOrder(next);
  }

  const commit = (next: number[]): void => {
    refs.order.current = next;
    setOrder(next);
  };

  const motion = useDeckMotion(refs);
  const sendToBack = useDeckFlight(refs, motion, commit);
  const gestures = useDeckGestures(refs, motion, sendToBack, setDragging);
  const latest = useRef({ placeAll: motion.placeAll, sendToBack, grab: gestures.onDown });
  latest.current = { placeAll: motion.placeAll, sendToBack, grab: gestures.onDown };

  useIsomorphicLayoutEffect(() => {
    refs.order.current = order;
    const options: PlaceAllOptions = { stagger: mountedRef.current ? 0 : 0.06 };
    latest.current.placeAll(options);
    mountedRef.current = true;
  }, [order, shape, visible, spread, depth, speed, count]);

  useEffect(() => {
    if (topIndex === undefined || topIndex < 0 || topIndex >= count) return;
    const current = refs.order.current;
    if (current[0] === topIndex) return;
    if (!current.includes(topIndex)) return;
    commit([topIndex, ...current.filter((index) => index !== topIndex)]);
  }, [topIndex, count]);

  useEffect(() => {
    refs.alive.current = true;
    const values = refs.values.current;
    return () => {
      refs.alive.current = false;
      gestures.dispose();
      values.forEach((group) => {
        for (const value of Object.values(group)) value.stop();
      });
      values.clear();
      refs.elements.current.clear();
      refs.flying.current.clear();
    };
  }, []);

  const actions = useMemo<DeckContextValue["actions"]>(
    () => ({
      sendToBack: (direction: Vector | null) => latest.current.sendToBack(direction),
      setHovered,
      grab: (event, index) => latest.current.grab(event, index),
      attach: (index, element) => {
        if (element) refs.elements.current.set(index, element);
        else refs.elements.current.delete(index);
      },
    }),
    [refs],
  );

  const value: DeckContextValue = {
    state: {
      order,
      count,
      visible: settings.visible,
      shape,
      origin: ORIGINS[shape],
      dragging,
      hovered,
      radius,
      frame,
      frameColor,
      elevation,
    },
    actions,
    meta: { rootRef: refs.root, valuesFor: motion.valuesFor },
  };

  return <DeckContext value={value}>{children}</DeckContext>;
}

export interface CardDeckStackProps {
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

function CardDeckStack({ className = "", style, children }: CardDeckStackProps) {
  const { actions, meta } = useDeck("CardDeck.Stack");
  return (
    <div
      ref={meta.rootRef}
      className={`card-deck ${className}`.trim()}
      style={style}
      onMouseEnter={() => actions.setHovered(true)}
      onMouseLeave={() => actions.setHovered(false)}
    >
      {children}
    </div>
  );
}

export interface CardDeckCardProps {
  index: number;
  children?: ReactNode;
}

function CardDeckCard({ index, children }: CardDeckCardProps) {
  const { state, actions, meta } = useDeck("CardDeck.Card");
  const values = meta.valuesFor(index);
  const isTop = state.order[0] === index;
  const position = Math.max(0, state.order.indexOf(index));
  const [originX, originY] = state.origin;
  const innerRadius = Math.max(0, state.radius - state.frame);
  return (
    <motion.div
      ref={(element) => {
        actions.attach(index, element);
      }}
      className="card-deck-card"
      data-top={isTop ? "" : undefined}
      style={{
        x: values.x,
        y: values.y,
        rotate: values.rotate,
        scale: values.scale,
        zIndex: values.z,
        opacity: values.opacity,
        pointerEvents: position < state.visible ? "auto" : "none",
        originX,
        originY,
        cursor: isTop ? (state.dragging ? "grabbing" : "grab") : "pointer",
        touchAction: isTop ? "pan-y" : "auto",
      }}
      onPointerDown={(event) => actions.grab(event, index)}
    >
      <motion.div
        className="card-deck-card-face"
        style={{
          rotateX: values.tiltX,
          rotateY: values.tiltY,
          rotate: values.spin,
          scale: values.lift,
          originX: values.grabX,
          originY: values.grabY,
          transformPerspective: 800,
          borderRadius: state.radius,
          padding: state.frame,
          backgroundColor: state.frame > 0 ? state.frameColor : "transparent",
          boxShadow: state.elevation === "raised" ? SHADOW : "none",
        }}
      >
        <div className="card-deck-card-content" style={{ borderRadius: innerRadius }}>
          {children}
        </div>
        <motion.div
          className="card-deck-card-shade"
          style={{ opacity: values.shade, borderRadius: state.radius }}
        />
      </motion.div>
    </motion.div>
  );
}

export interface CardDeckAutoplayProps {
  delay?: number;
  pause?: AutoplayPause;
}

function CardDeckAutoplay({ delay = 3000, pause = "never" }: CardDeckAutoplayProps) {
  const { state, actions } = useDeck("CardDeck.Autoplay");
  useEffect(() => {
    if (state.count < 2 || state.dragging || (pause === "hover" && state.hovered)) {
      return undefined;
    }
    const timer = setTimeout(() => actions.sendToBack(null), Math.max(300, delay));
    return () => clearTimeout(timer);
  }, [delay, pause, state.hovered, state.dragging, state.order, state.count, actions]);
  return null;
}

export const CardDeck = {
  Root: CardDeckRoot,
  Stack: CardDeckStack,
  Card: CardDeckCard,
  Autoplay: CardDeckAutoplay,
};
