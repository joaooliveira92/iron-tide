"use client";

import { Check } from "lucide-react";
import { motion } from "motion/react";
import { type ReactNode, useId, useLayoutEffect, useRef } from "react";

import { cn } from "@/lib/utils";

import { useSelectContext } from "./context.js";
import { ITEM_VARIANTS } from "./motion.js";
import type { SelectOptionRecord } from "./types.js";

export interface SelectItemProps {
  value: string;
  textValue?: string;
  icon?: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

export function SelectItem({
  value,
  textValue,
  icon,
  description,
  disabled = false,
  className,
  children,
}: SelectItemProps) {
  const { state, actions, meta } = useSelectContext("SelectItem");

  const generatedId = useId();
  const optionId = `${generatedId}-option`;
  const descriptionId = `${generatedId}-option-description`;

  const optionRef = useRef<HTMLDivElement>(null);

  const resolvedTextValue = textValue ?? (typeof children === "string" ? children : undefined);

  const label = resolvedTextValue ?? value;
  const selected = state.value === value;
  const active = state.activeValue === value;
  const effectivelyDisabled = state.disabled || disabled;

  useLayoutEffect(() => {
    if (process.env.NODE_ENV !== "production" && !resolvedTextValue) {
      console.warn(
        `SelectItem with value "${value}" has non-text children. ` +
          'Provide a textValue prop, for example textValue="São Paulo".',
      );
    }

    const option: SelectOptionRecord = {
      id: optionId,
      value,
      label,
      icon,
      disabled: effectivelyDisabled,
      ref: optionRef,
    };

    actions.registerOption(option);

    return () => {
      actions.unregisterOption(optionId);
    };
  }, [
    actions.registerOption,
    actions.unregisterOption,
    effectivelyDisabled,
    icon,
    label,
    optionId,
    resolvedTextValue,
    value,
  ]);

  return (
    <motion.div
      ref={optionRef}
      id={optionId}
      role="option"
      aria-label={label}
      aria-selected={selected}
      aria-disabled={effectivelyDisabled || undefined}
      aria-describedby={description !== undefined ? descriptionId : undefined}
      data-value={value}
      data-selected={selected ? "" : undefined}
      data-active={active ? "" : undefined}
      data-disabled={effectivelyDisabled ? "" : undefined}
      {...(meta.reduceMotion ? {} : { variants: ITEM_VARIANTS })}
      onPointerDown={(event) => {
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (effectivelyDisabled || event.pointerType === "touch") {
          return;
        }

        actions.setActiveValue(value);
      }}
      onClick={() => {
        if (effectivelyDisabled) {
          return;
        }

        actions.selectValue(value);
      }}
      className={cn(
        "flex w-full cursor-default select-none items-center",
        description !== undefined && "items-start",
        "justify-between gap-2 rounded-lg px-2.5 py-1.5",
        "text-left text-sm outline-none transition-colors",

        selected ? "bg-muted text-foreground" : "text-muted-foreground",

        active && !selected && "bg-muted text-foreground",

        !effectivelyDisabled && "hover:bg-muted hover:text-foreground",

        effectivelyDisabled && "pointer-events-none opacity-50",

        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {icon !== undefined ? (
          <span aria-hidden="true" className="inline-flex shrink-0 items-center">
            {icon}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="max-w-full min-w-0 truncate">{children}</span>
          {description !== undefined ? (
            <span id={descriptionId} className="text-xs text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
      </span>

      {selected ? (
        <Check
          aria-hidden="true"
          className={cn("h-3.5 w-3.5 shrink-0", description !== undefined && "mt-0.5")}
        />
      ) : null}
    </motion.div>
  );
}
