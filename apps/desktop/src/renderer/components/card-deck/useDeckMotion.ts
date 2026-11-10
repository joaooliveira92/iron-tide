import { animate, motionValue, type ValueAnimationTransition } from "motion/react";
import { mix, placement, SPRINGS, type SpringKind } from "./deckGeometry.js";
import type {
  DeckMotion,
  DeckRefs,
  MotionValues,
  PlaceAllOptions,
  PlaceOptions,
} from "./deckTypes.js";

export function useDeckMotion(refs: DeckRefs): DeckMotion {
  const valuesFor = (index: number): MotionValues => {
    let values = refs.values.current.get(index);
    if (!values) {
      const s = refs.settings.current;
      const position = Math.max(0, refs.order.current.indexOf(index));
      const start = placement(
        s.layout,
        s.reduceMotion ? Math.min(position, s.visible - 1) : 0,
        index,
        s.spread,
        s.depth,
      );
      values = {
        x: motionValue(start.x),
        y: motionValue(start.y),
        rotate: motionValue(start.rotate),
        scale: motionValue(start.scale),
        tiltX: motionValue(0),
        tiltY: motionValue(0),
        spin: motionValue(0),
        lift: motionValue(1),
        grabX: motionValue(0.5),
        grabY: motionValue(0.5),
        z: motionValue(s.count - position),
        opacity: motionValue(position < s.visible ? 1 : 0),
        shade: motionValue(0),
      };
      refs.values.current.set(index, values);
    }
    return values;
  };

  const springFor = (
    kind: SpringKind,
    extra: { delay?: number } = {},
  ): ValueAnimationTransition => {
    const s = refs.settings.current;
    if (s.reduceMotion) return { duration: 0.2, ease: "easeOut", delay: extra.delay ?? 0 };
    const [stiffness, damping] = SPRINGS[kind];
    return {
      type: "spring",
      stiffness: stiffness * s.speed * s.speed,
      damping: damping * s.speed,
      restDelta: 0.01,
      restSpeed: 0.5,
      ...extra,
    };
  };

  const settleFace = (values: MotionValues, delay = 0): void => {
    const transition = springFor("face", { delay });
    animate(values.tiltX, 0, transition);
    animate(values.tiltY, 0, transition);
    animate(values.spin, 0, transition);
    animate(values.lift, 1, transition);
  };

  const placeCard = (index: number, position: number, options: PlaceOptions = {}): void => {
    const { delay = 0, lift = 0, kind = "place", velocity = null, keepZ = false } = options;
    const s = refs.settings.current;
    const values = valuesFor(index);
    const shown = Math.min(position, s.visible - 1);
    const target = placement(s.layout, shown, index, s.spread, s.depth);
    if (lift > 0 && shown > 0) {
      const ahead = placement(s.layout, shown - 1, index, s.spread, s.depth);
      target.x = mix(target.x, ahead.x, lift);
      target.y = mix(target.y, ahead.y, lift);
      target.rotate = mix(target.rotate, ahead.rotate, lift);
      target.scale = mix(target.scale, ahead.scale, lift);
    }
    const motionSpring = springFor(kind, { delay });
    const fade: ValueAnimationTransition = {
      duration: s.reduceMotion ? 0.2 : 0.35 / s.speed,
      ease: "easeOut",
      delay,
    };
    if (!keepZ) values.z.set(s.count - position);
    animate(
      values.x,
      target.x,
      velocity ? { ...motionSpring, velocity: velocity[0] } : motionSpring,
    );
    animate(
      values.y,
      target.y,
      velocity ? { ...motionSpring, velocity: velocity[1] } : motionSpring,
    );
    animate(values.rotate, target.rotate, motionSpring);
    animate(values.scale, target.scale, motionSpring);
    settleFace(values, delay);
    animate(values.opacity, position < s.visible ? 1 : 0, fade);
    animate(values.shade, Math.min(0.6, shown * s.depth * 0.14 * (1 - lift)), fade);
  };

  const placeAll = (options: PlaceAllOptions = {}): void => {
    const { stagger = 0, lift = 0, released = -1, velocity = null, kind = "place" } = options;
    const drag = refs.drag.current;
    refs.order.current.forEach((index, position) => {
      const flight = refs.flying.current.get(index);
      if (flight && !flight.turned) return;
      if (drag && drag.moved && drag.card === index) return;
      const isReleased = index === released;
      placeCard(index, position, {
        delay: position * stagger,
        lift: position > 0 ? lift : 0,
        kind: flight ? "tuck" : isReleased ? "settle" : kind,
        velocity: isReleased ? velocity : null,
        keepZ: !!flight,
      });
    });
  };

  return { valuesFor, springFor, settleFace, placeCard, placeAll };
}
