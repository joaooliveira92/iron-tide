import { animate } from "motion/react";
import { type PointerEvent as ReactPointerEvent, useRef } from "react";
import {
  CLICK_SLOP,
  clamp,
  FLICK_SPEED,
  LEAN_REACH,
  LEAN_SPEED,
  placement,
  PRESS_SCALE,
  releaseVelocity,
} from "./deckGeometry.js";
import type { DeckMotion, DeckRefs, DragState } from "./deckTypes.js";
import type { SendToBack } from "./useDeckFlight.js";

interface Listeners {
  move: (event: PointerEvent) => void;
  up: (event: PointerEvent) => void;
}

export interface DeckGestures {
  onDown: (event: ReactPointerEvent<HTMLDivElement>, index: number) => void;
  dispose: () => void;
}

function detach(listeners: Listeners): void {
  window.removeEventListener("pointermove", listeners.move);
  window.removeEventListener("pointerup", listeners.up);
  window.removeEventListener("pointercancel", listeners.up);
}

export function useDeckGestures(
  refs: DeckRefs,
  motion: DeckMotion,
  sendToBack: SendToBack,
  setDragging: (dragging: boolean) => void,
): DeckGestures {
  const { valuesFor, springFor, settleFace, placeAll } = motion;
  const handlersRef = useRef<Listeners | null>(null);
  const listenersRef = useRef<Listeners | null>(null);

  const lean = (drag: DragState): void => {
    const s = refs.settings.current;
    if (s.reduceMotion) return;
    const values = valuesFor(drag.card);
    const offsetX = values.x.get() - drag.homeX;
    const offsetY = values.y.get() - drag.homeY;
    const sideways =
      clamp(drag.vx / LEAN_SPEED, -1, 1) * 0.7 + clamp(offsetX / LEAN_REACH, -1, 1) * 0.3;
    const upward =
      clamp(-drag.vy / LEAN_SPEED, -1, 1) * 0.7 + clamp(-offsetY / LEAN_REACH, -1, 1) * 0.3;
    const follow = springFor("lean");
    animate(values.tiltY, sideways * s.tilt, follow);
    animate(values.tiltX, upward * s.tilt, follow);
    animate(values.spin, clamp(offsetX / LEAN_REACH, -1, 1) * 6, follow);
  };

  const onMove = (event: PointerEvent): void => {
    const drag = refs.drag.current;
    if (!drag || event.pointerId !== drag.id) return;
    const s = refs.settings.current;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const values = valuesFor(drag.card);
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < CLICK_SLOP) return;
      drag.moved = true;
      values.x.stop();
      values.y.stop();
      drag.originX = values.x.get() - dx;
      drag.originY = values.y.get() - dy;
      try {
        drag.element.setPointerCapture(drag.id);
      } catch {}
      setDragging(true);
    }
    values.x.set(drag.originX + dx);
    values.y.set(drag.originY + dy);
    drag.samples.push([event.clientX, event.clientY, event.timeStamp]);
    if (drag.samples.length > 12) drag.samples.shift();
    [drag.vx, drag.vy] = releaseVelocity(drag.samples, event.timeStamp);
    lean(drag);
    if (drag.idle !== null) clearTimeout(drag.idle);
    drag.idle = setTimeout(() => {
      if (refs.drag.current !== drag) return;
      drag.vx = 0;
      drag.vy = 0;
      lean(drag);
    }, 70);
    const progress = clamp(Math.hypot(dx, dy) / Math.max(s.threshold, 1), 0, 1);
    if (Math.abs(progress - drag.progress) > 0.02) {
      drag.progress = progress;
      placeAll({ lift: progress * 0.4, kind: "settle" });
    }
  };

  const onUp = (event: PointerEvent): void => {
    const drag = refs.drag.current;
    if (!drag || event.pointerId !== drag.id) return;
    refs.drag.current = null;
    if (drag.idle !== null) clearTimeout(drag.idle);
    detach(listenersRef.current as Listeners);
    try {
      drag.element.releasePointerCapture(drag.id);
    } catch {}
    const s = refs.settings.current;
    if (!drag.moved) {
      if (event.type === "pointerup") {
        if (s.tap === "sendToBack") sendToBack(null);
        else refs.onCardActivate.current?.(drag.card);
      } else {
        settleFace(valuesFor(drag.card));
      }
      return;
    }
    setDragging(false);
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const [vx, vy] = releaseVelocity(drag.samples, event.timeStamp);
    const distance = Math.hypot(dx, dy);
    const pace = Math.hypot(vx, vy);
    const flick = pace > FLICK_SPEED && distance > 16 && vx * dx + vy * dy > 0;
    if (event.type === "pointerup" && s.count > 1 && (distance > s.threshold || flick)) {
      sendToBack(pace > 300 ? [vx, vy] : [dx, dy], [vx, vy]);
    } else {
      placeAll({
        released: drag.card,
        velocity: [clamp(vx, -3000, 3000), clamp(vy, -3000, 3000)],
      });
    }
  };

  const onDown = (event: ReactPointerEvent<HTMLDivElement>, index: number): void => {
    if (event.button !== 0 || refs.drag.current) return;
    if (refs.flying.current.has(index)) return;
    if (refs.order.current[0] !== index) {
      event.preventDefault();
      refs.onCardActivate.current?.(index);
      return;
    }
    const s = refs.settings.current;
    const values = valuesFor(index);
    const home = placement(s.layout, 0, index, s.spread, s.depth);
    const bounds = event.currentTarget.getBoundingClientRect();
    values.grabX.set(clamp((event.clientX - bounds.left) / Math.max(bounds.width, 1), 0, 1));
    values.grabY.set(clamp((event.clientY - bounds.top) / Math.max(bounds.height, 1), 0, 1));
    if (!s.reduceMotion) animate(values.lift, PRESS_SCALE, springFor("press"));
    refs.drag.current = {
      card: index,
      id: event.pointerId,
      element: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      originX: 0,
      originY: 0,
      homeX: home.x,
      homeY: home.y,
      vx: 0,
      vy: 0,
      idle: null,
      moved: false,
      progress: 0,
      samples: [[event.clientX, event.clientY, event.timeStamp]],
    };
    if (event.pointerType === "mouse") event.preventDefault();
    const listeners = listenersRef.current as Listeners;
    window.addEventListener("pointermove", listeners.move);
    window.addEventListener("pointerup", listeners.up);
    window.addEventListener("pointercancel", listeners.up);
  };

  handlersRef.current = { move: onMove, up: onUp };
  if (!listenersRef.current) {
    listenersRef.current = {
      move: (event) => handlersRef.current?.move(event),
      up: (event) => handlersRef.current?.up(event),
    };
  }
  const stable = listenersRef.current;

  const dispose = (): void => {
    if (refs.drag.current?.idle != null) clearTimeout(refs.drag.current.idle);
    detach(stable);
  };

  return { onDown, dispose };
}
