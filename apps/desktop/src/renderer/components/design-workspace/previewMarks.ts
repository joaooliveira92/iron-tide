import { createContext, useContext, useRef, useSyncExternalStore } from "react";
import { useLifecycle } from "../../shell/useExternalSync.js";
import type { PartKind } from "./panels/hull-plan/anatomy/anatomy-types.js";

export type PreviewKinds = ReadonlySet<PartKind>;

export interface PreviewMarks {
  readonly get: () => PreviewKinds;
  readonly subscribe: (listener: () => void) => () => void;
  readonly set: (owner: object, kinds: PreviewKinds) => void;
  readonly clear: (owner: object) => void;
}

const NONE: PreviewKinds = new Set();

const sameKinds = (a: PreviewKinds, b: PreviewKinds): boolean =>
  a.size === b.size && [...a].every((kind) => b.has(kind));

export function createPreviewMarks(): PreviewMarks {
  const owners = new Map<object, PreviewKinds>();
  const listeners = new Set<() => void>();
  let union: PreviewKinds = NONE;
  const publish = () => {
    const next = owners.size === 0 ? NONE : new Set([...owners.values()].flatMap((k) => [...k]));
    if (sameKinds(union, next)) return;
    union = next.size === 0 ? NONE : next;
    for (const listener of listeners) listener();
  };
  return {
    get: () => union,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    set(owner, kinds) {
      if (kinds.size === 0) owners.delete(owner);
      else owners.set(owner, kinds);
      publish();
    },
    clear(owner) {
      owners.delete(owner);
      publish();
    },
  };
}

export const PreviewMarksContext = createContext<PreviewMarks | null>(null);

const SILENT = { get: () => NONE, subscribe: () => () => undefined };

export function usePreviewKinds(): PreviewKinds {
  const marks = useContext(PreviewMarksContext) ?? SILENT;
  return useSyncExternalStore(marks.subscribe, marks.get, marks.get);
}

export function usePublishPreviewKinds(kinds: PreviewKinds): void {
  const marks = useContext(PreviewMarksContext);
  const owner = useRef({});
  useLifecycle(() => {
    if (marks === null) return;
    const mine = owner.current;
    marks.set(mine, kinds);
    return () => marks.clear(mine);
  }, [marks, kinds]);
}
