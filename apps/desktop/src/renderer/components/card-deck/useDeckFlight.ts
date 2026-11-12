import { animate } from "motion/react";
import { EXITS, noise, placement } from "./deckGeometry.js";
import type { DeckMotion, DeckRefs, Flight, Vector } from "./deckTypes.js";

export type SendToBack = (direction: Vector | null, velocity?: Vector | null) => void;

export function useDeckFlight(
  refs: DeckRefs,
  motion: DeckMotion,
  commit: (next: number[]) => void,
): SendToBack {
  const { valuesFor, springFor, settleFace, placeCard } = motion;

  return (direction, velocity = null) => {
    const s = refs.settings.current;
    const current = refs.order.current;
    if (current.length < 2) return;
    const top = current[0] as number;
    if (refs.flying.current.has(top)) return;
    const next = [...current.slice(1), top];
    if (s.reduceMotion) {
      commit(next);
      refs.onChange.current?.(next[0] as number);
      return;
    }
    let dx: number;
    let dy: number;
    if (direction) {
      [dx, dy] = direction;
    } else {
      const exit = EXITS[s.layout];
      [dx, dy] = exit ?? [Math.cos(noise(top + 9) * 6.283), Math.sin(noise(top + 9) * 6.283)];
    }
    const length = Math.hypot(dx, dy) || 1;
    dx /= length;
    dy /= length;
    const bounds = refs.root.current?.getBoundingClientRect();
    const width = bounds?.width || 240;
    const height = bounds?.height || 240;
    const clearance = Math.min(
      width / Math.max(Math.abs(dx), 0.01),
      height / Math.max(Math.abs(dy), 0.01),
    );
    const home = placement(s.layout, 0, top, s.spread, s.depth);
    const travel = clearance * 1.12 + 40;
    const resting = new Map<number, DOMRect>();
    for (const [index, element] of refs.elements.current) {
      if (index !== top) resting.set(index, element.getBoundingClientRect());
    }
    const out: Vector = [home.x + dx * travel, home.y + dy * travel];
    const values = valuesFor(top);
    const launch = springFor("fling");
    const flight: Flight = { turned: false };
    refs.flying.current.set(top, flight);
    values.z.set(s.count + 1);
    animate(values.x, out[0], velocity ? { ...launch, velocity: velocity[0] } : launch);
    animate(values.y, out[1], velocity ? { ...launch, velocity: velocity[1] } : launch);
    settleFace(values);
    commit(next);
    refs.onChange.current?.(next[0] as number);
    const span = Math.max(Math.hypot(out[0] - values.x.get(), out[1] - values.y.get()), 1);
    let landed = false;
    const turn = (): void => {
      flight.turned = true;
      const position = refs.order.current.indexOf(top);
      if (position >= 0) placeCard(top, position, { kind: "tuck", keepZ: !landed });
    };
    const land = (): void => {
      landed = true;
      if (refs.flying.current.get(top) === flight) refs.flying.current.delete(top);
      const position = refs.order.current.indexOf(top);
      if (position >= 0) values.z.set(refs.settings.current.count - position);
    };
    const fallback = setTimeout(() => {
      if (!flight.turned) turn();
      if (!landed) land();
    }, 1500 / s.speed);
    const clearOfPile = (): boolean => {
      const element = refs.elements.current.get(top);
      if (!element) return true;
      const mine = element.getBoundingClientRect();
      for (const [index, box] of resting) {
        if (refs.flying.current.has(index) || valuesFor(index).opacity.get() < 0.5) {
          continue;
        }
        if (
          mine.left < box.right &&
          mine.right > box.left &&
          mine.top < box.bottom &&
          mine.bottom > box.top
        ) {
          return false;
        }
      }
      return true;
    };
    const watch = (): void => {
      if (!refs.alive.current || (flight.turned && landed)) {
        clearTimeout(fallback);
        return;
      }
      const x = values.x.get();
      const y = values.y.get();
      const outward = values.x.getVelocity() * dx + values.y.getVelocity() * dy;
      if (!flight.turned && (Math.hypot(out[0] - x, out[1] - y) <= span * 0.06 || outward < 0)) {
        turn();
      }
      if (!landed && (clearOfPile() || (flight.turned && outward < 0))) land();
      requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  };
}
