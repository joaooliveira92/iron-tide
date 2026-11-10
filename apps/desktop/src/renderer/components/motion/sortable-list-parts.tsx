"use client";

import { BluewaveError } from "@bluewave/contracts";
import { GripVertical, Undo2 } from "lucide-react";
import { type HTMLMotionProps, Reorder, useDragControls, useReducedMotion } from "motion/react";
import { type ComponentPropsWithRef, type ReactNode, useState } from "react";
import { SPRING_LAYOUT } from "../../lib/ease.js";
import { cn } from "../../lib/utils.js";
import { ItemContext, useItemContext, useListContext } from "./sortable-list-context.js";

export interface SortableListGroupProps extends Omit<HTMLMotionProps<"ul">, "children"> {
  children?: ReactNode;
}

export function SortableListGroup({ className, ...props }: SortableListGroupProps) {
  const context = useListContext("SortableList.Group");
  return (
    <Reorder.Group
      {...props}
      axis="y"
      values={context.ids}
      onReorder={context.reorder}
      aria-label={props["aria-label"] ?? context.label}
      className={cn("space-y-2", className)}
    />
  );
}

export interface SortableListItemProps extends Omit<
  HTMLMotionProps<"li">,
  "id" | "value" | "children"
> {
  id: string;
  children?: ReactNode;
}

export function SortableListItem({
  id,
  children,
  className,
  onDragStart,
  onDragEnd,
  ...props
}: SortableListItemProps) {
  const context = useListContext("SortableList.Item");
  const controls = useDragControls();
  const reduce = useReducedMotion() ?? false;
  const [dragging, setDragging] = useState(false);
  const label = context.labels.get(id);
  if (label === undefined) throw new BluewaveError("SORTABLE_LIST_ITEM_UNKNOWN", { id });
  return (
    <ItemContext.Provider value={{ id, label, controls, dragging }}>
      <Reorder.Item
        {...props}
        value={id}
        dragListener={false}
        dragControls={controls}
        layout="position"
        transition={reduce ? { duration: 0 } : SPRING_LAYOUT}
        onDragStart={(event, info) => {
          setDragging(true);
          context.beginDrag();
          onDragStart?.(event, info);
        }}
        onDragEnd={(event, info) => {
          setDragging(false);
          context.finishDrag(id);
          onDragEnd?.(event, info);
        }}
        whileDrag={reduce ? undefined : { scale: 1.025 }}
        aria-posinset={(context.positions.get(id) ?? -1) + 1}
        aria-setsize={context.ids.length}
        className={cn(
          "relative flex items-center gap-3 rounded-2xl border border-border bg-background p-3",
          dragging && "shadow-lg",
          context.itemClassName,
          className,
        )}
      >
        {children}
      </Reorder.Item>
    </ItemContext.Provider>
  );
}

export type SortableListHandleProps = ComponentPropsWithRef<"button">;

export function SortableListHandle({
  children,
  className,
  disabled,
  onPointerDown,
  onKeyDown,
  style,
  ...props
}: SortableListHandleProps) {
  const context = useListContext("SortableList.Handle");
  const item = useItemContext("SortableList.Handle");
  const unavailable = disabled || context.disabled;
  return (
    <button
      {...props}
      type="button"
      disabled={unavailable}
      data-sortable-id={item.id}
      aria-label={props["aria-label"] ?? `Reorder ${item.label}`}
      aria-describedby={[context.instructions, props["aria-describedby"]].filter(Boolean).join(" ")}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        if (!event.defaultPrevented && !unavailable && event.button === 0) {
          event.currentTarget.focus({ preventScroll: true });
          item.controls.start(event);
        }
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented || unavailable || event.altKey || event.ctrlKey || event.metaKey)
          return;
        const direction =
          event.key === "ArrowUp"
            ? -1
            : event.key === "ArrowDown"
              ? 1
              : event.key === "Home"
                ? "first"
                : event.key === "End"
                  ? "last"
                  : null;
        if (direction !== null) {
          event.preventDefault();
          context.move(item.id, direction);
        }
      }}
      className={cn(
        "flex size-9 shrink-0 touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
      style={{
        cursor: unavailable ? undefined : item.dragging ? "grabbing" : "grab",
        ...style,
      }}
    >
      {children ?? <GripVertical size={18} aria-hidden="true" />}
    </button>
  );
}

export type SortableListItemContentProps = ComponentPropsWithRef<"div">;
export function SortableListItemContent({ className, ...props }: SortableListItemContentProps) {
  return <div {...props} className={cn("min-w-0 flex-1", className)} />;
}

export type SortableListUndoProps = ComponentPropsWithRef<"button">;
export function SortableListUndo({
  children,
  className,
  disabled,
  onClick,
  ...props
}: SortableListUndoProps) {
  const context = useListContext("SortableList.Undo");
  return (
    <button
      {...props}
      type="button"
      disabled={disabled || context.disabled || !context.canUndo}
      className={cn(
        "mt-4 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) context.undo();
      }}
    >
      {children ?? (
        <>
          <Undo2 size={13} aria-hidden="true" /> Undo reorder
        </>
      )}
    </button>
  );
}
