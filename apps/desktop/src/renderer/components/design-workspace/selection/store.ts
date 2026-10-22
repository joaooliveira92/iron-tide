import type { SectionId } from "../panels/hull-plan/sections.js";

export type ShipEntity =
  | { readonly kind: "ship" }
  | { readonly kind: "section"; readonly id: SectionId }
  | { readonly kind: "fitting"; readonly instanceId: string }
  | { readonly kind: "machinery-room"; readonly index: number };

export interface SelectionState {
  readonly selected: ShipEntity | null;
  readonly linked: readonly ShipEntity[];
  readonly preview: SectionId | null;
  readonly finding: string | null;
  readonly markerPreview: boolean;
}

export const EMPTY_SELECTION: SelectionState = {
  selected: null,
  linked: [],
  preview: null,
  finding: null,
  markerPreview: false,
};

export function sameEntity(a: ShipEntity | null, b: ShipEntity | null): boolean {
  if (a === null || b === null) return a === b;
  switch (a.kind) {
    case "ship":
      return b.kind === "ship";
    case "section":
      return b.kind === "section" && a.id === b.id;
    case "fitting":
      return b.kind === "fitting" && a.instanceId === b.instanceId;
    case "machinery-room":
      return b.kind === "machinery-room" && a.index === b.index;
  }
}

export interface SelectionStore {
  readonly get: () => SelectionState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly select: (entity: ShipEntity, finding?: string | null) => void;
  readonly clear: () => void;
  readonly clearFinding: () => void;
  readonly setMarkerPreview: (open: boolean) => void;
  readonly pruneFinding: (exists: (key: string) => boolean) => void;
  readonly setLinked: (entities: readonly ShipEntity[]) => void;
  readonly setPreview: (id: SectionId | null) => void;
  readonly prune: (exists: (entity: ShipEntity) => boolean) => void;
}

export function createSelectionStore(initial: SelectionState = EMPTY_SELECTION): SelectionStore {
  let state = initial;
  const listeners = new Set<() => void>();
  const set = (next: SelectionState) => {
    if (next === state) return;
    state = next;
    for (const l of listeners) l();
  };
  return {
    get: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select: (entity, finding) => {
      const same = sameEntity(state.selected, entity);
      const nextFinding = finding !== undefined ? finding : same ? state.finding : null;
      if (!same || nextFinding !== state.finding)
        set({ ...state, selected: entity, finding: nextFinding });
    },
    clear: () => {
      if (state.selected !== null || state.finding !== null)
        set({ ...state, selected: null, finding: null });
    },
    clearFinding: () => {
      if (state.finding !== null) set({ ...state, finding: null });
    },
    setMarkerPreview: (open) => {
      if (open !== state.markerPreview) set({ ...state, markerPreview: open });
    },
    pruneFinding: (exists) => {
      if (state.finding !== null && !exists(state.finding)) set({ ...state, finding: null });
    },
    setLinked: (entities) => {
      const same =
        entities.length === state.linked.length &&
        entities.every((e, i) => sameEntity(e, state.linked[i] ?? null));
      if (!same) set({ ...state, linked: entities });
    },
    setPreview: (id) => {
      if (id !== state.preview) set({ ...state, preview: id });
    },
    prune: (exists) => {
      const selected = state.selected && exists(state.selected) ? state.selected : null;
      const linked = state.linked.filter(exists);
      if (selected !== state.selected || linked.length !== state.linked.length)
        set({ ...state, selected, linked, finding: selected ? state.finding : null });
    },
  };
}
