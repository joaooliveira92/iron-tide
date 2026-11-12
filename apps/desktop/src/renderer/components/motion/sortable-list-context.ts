import { BluewaveError } from "@bluewave/contracts";
import type { useDragControls } from "motion/react";
import { createContext, useContext } from "react";

export type MoveDirection = -1 | 1 | "first" | "last";

export type ListContextValue = {
  ids: string[];
  positions: Map<string, number>;
  labels: Map<string, string>;
  label: string;
  disabled: boolean;
  instructions: string;
  itemClassName?: string;
  canUndo: boolean;
  reorder: (ids: string[]) => void;
  move: (id: string, direction: MoveDirection) => void;
  undo: () => void;
  beginDrag: () => void;
  finishDrag: (id: string) => void;
};

export type ItemContextValue = {
  id: string;
  label: string;
  controls: ReturnType<typeof useDragControls>;
  dragging: boolean;
};

export const ListContext = createContext<ListContextValue | null>(null);
export const ItemContext = createContext<ItemContextValue | null>(null);

export function useListContext(part: string): ListContextValue {
  const context = useContext(ListContext);
  if (!context) throw new BluewaveError("SORTABLE_LIST_ROOT_MISSING", { part });
  return context;
}

export function useItemContext(part: string): ItemContextValue {
  const context = useContext(ItemContext);
  if (!context) throw new BluewaveError("SORTABLE_LIST_ITEM_MISSING", { part });
  return context;
}

export function useSortableList() {
  const context = useListContext("useSortableList");
  return {
    ids: context.ids,
    disabled: context.disabled,
    canUndo: context.canUndo,
    moveItem: context.move,
    undo: context.undo,
  };
}
