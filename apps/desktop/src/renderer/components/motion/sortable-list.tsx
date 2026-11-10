"use client";

import { type ReactNode, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils.js";
import { ListContext, type ListContextValue, type MoveDirection } from "./sortable-list-context.js";
import {
  SortableListGroup,
  SortableListHandle,
  SortableListItem,
  SortableListItemContent,
  SortableListUndo,
} from "./sortable-list-parts.js";

export { useSortableList } from "./sortable-list-context.js";

export interface SortableListProps<T extends { id: string }> {
  items: T[];
  onItemsChange: (items: T[]) => void;
  getItemLabel: (item: T) => string;
  children?: ReactNode;
  label?: string;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
}

function SortableListRoot<T extends { id: string }>({
  items,
  onItemsChange,
  getItemLabel,
  children,
  label = "Sortable items",
  disabled = false,
  className,
  itemClassName,
}: SortableListProps<T>) {
  const ids = useMemo(() => items.map((item) => item.id), [items]);
  if (new Set(ids).size !== ids.length) throw new Error("SortableList requires unique item ids.");
  const [previous, setPrevious] = useState<string[] | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dragStart = useRef<string[] | null>(null);
  const instructions = useId();
  const root = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const live = useRef(items);
  useLayoutEffect(() => {
    live.current = items;
    if (pendingFocus.current !== null) {
      const target = Array.from(
        root.current?.querySelectorAll<HTMLButtonElement>("button[data-sortable-id]") ?? [],
      ).find((button) => button.dataset.sortableId === pendingFocus.current);
      pendingFocus.current = null;
      target?.focus({ preventScroll: true });
    }
  });

  const labels = useMemo(
    () => new Map(items.map((item): [string, string] => [item.id, getItemLabel(item)])),
    [items, getItemLabel],
  );
  const positions = useMemo(
    () => new Map(ids.map((id, index): [string, number] => [id, index])),
    [ids],
  );
  if (
    previous !== null &&
    (previous.length !== ids.length || previous.some((id) => !positions.has(id)))
  )
    setPrevious(null);
  const canUndo =
    previous !== null &&
    previous.length === ids.length &&
    previous.every((id) => positions.has(id)) &&
    previous.some((id, index) => id !== ids[index]);
  const context = useMemo<ListContextValue>(() => {
    const change = (next: T[]) => {
      live.current = next;
      onItemsChange(next);
    };
    const reorder = (nextIds: string[]) => {
      if (disabled) return;
      const byId = new Map(live.current.map((item) => [item.id, item]));
      const next = nextIds.flatMap((id) => {
        const item = byId.get(id);
        return item ? [item] : [];
      });
      if (next.length === live.current.length && new Set(nextIds).size === next.length)
        change(next);
    };
    const move = (id: string, direction: MoveDirection) => {
      const current = live.current;
      const from = current.findIndex((item) => item.id === id);
      const to =
        direction === "first" ? 0 : direction === "last" ? current.length - 1 : from + direction;
      if (disabled || from < 0 || to < 0 || to >= current.length || from === to) return;
      const next = [...current];
      const [item] = next.splice(from, 1);
      if (item === undefined) return;
      next.splice(to, 0, item);
      setPrevious(current.map((entry) => entry.id));
      change(next);
      setAnnouncement(`${getItemLabel(item)} moved to position ${to + 1} of ${current.length}.`);
    };
    const undo = () => {
      if (disabled || !previous || !canUndo) return;
      pendingFocus.current = previous.find((id, index) => id !== ids[index]) ?? previous[0] ?? null;
      reorder(previous);
      setPrevious(null);
      setAnnouncement("Previous order restored.");
    };
    return {
      ids,
      positions,
      labels,
      label,
      disabled,
      instructions,
      itemClassName,
      canUndo,
      reorder,
      move,
      undo,
      beginDrag: () => {
        dragStart.current = live.current.map((item) => item.id);
      },
      finishDrag: (id) => {
        const before = dragStart.current;
        dragStart.current = null;
        const current = live.current;
        const index = current.findIndex((item) => item.id === id);
        const item = current[index];
        if (item && before?.some((oldId, at) => oldId !== current[at]?.id)) {
          setPrevious(before);
          setAnnouncement(
            `${getItemLabel(item)} moved to position ${index + 1} of ${current.length}.`,
          );
        }
      },
    };
  }, [
    onItemsChange,
    disabled,
    getItemLabel,
    ids,
    positions,
    labels,
    label,
    instructions,
    itemClassName,
    previous,
    canUndo,
  ]);

  return (
    <ListContext.Provider value={context}>
      <div ref={root} className={cn("w-full max-w-md", className)}>
        <p id={instructions} className="sr-only">
          Drag a handle to reorder. With a handle focused, use Up and Down to move, Home and End to
          move to the edges.
        </p>
        {children}
        <span role="status" aria-live="polite" className="sr-only">
          {announcement}
        </span>
      </div>
    </ListContext.Provider>
  );
}

export const SortableList = Object.assign(SortableListRoot, {
  Group: SortableListGroup,
  Item: SortableListItem,
  Handle: SortableListHandle,
  Content: SortableListItemContent,
  Undo: SortableListUndo,
});
