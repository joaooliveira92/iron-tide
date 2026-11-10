"use client";

import { useReducedMotion, type Transition } from "motion/react";
import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils.js";
import { BouncyAccordionRow } from "./bouncy-accordion-row.js";
import type {
  BouncyAccordionClassNames,
  BouncyAccordionCollapse,
  BouncyAccordionItem,
} from "./bouncy-accordion-types.js";

export type {
  BouncyAccordionClassNames,
  BouncyAccordionCollapse,
  BouncyAccordionItem,
} from "./bouncy-accordion-types.js";

export interface BouncyAccordionProps {
  items: readonly BouncyAccordionItem[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  collapse?: BouncyAccordionCollapse;
  radius?: number;
  className?: string;
  classNames?: BouncyAccordionClassNames;
  "aria-label"?: string;
}

const EXPAND_TRANSITION: Transition = {
  type: "spring",
  duration: 0.58,
  bounce: 0.32,
};

const COLLAPSE_TRANSITION: Transition = {
  type: "spring",
  duration: 0.46,
  bounce: 0,
};

function useControllableAccordionValue({
  value,
  defaultValue,
  onValueChange,
}: {
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? null);
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;

  const setValue = useCallback(
    (next: string | null) => {
      if (!isControlled) setInternalValue(next);
      onValueChange?.(next);
    },
    [isControlled, onValueChange],
  );

  return [currentValue, setValue] as const;
}

export function BouncyAccordion({
  items,
  value,
  defaultValue = null,
  onValueChange,
  collapse = "allowed",
  radius = 28,
  className,
  classNames,
  "aria-label": ariaLabel,
}: BouncyAccordionProps) {
  const reduce = useReducedMotion();
  const baseId = useId();
  const [activeValue, setActiveValue] = useControllableAccordionValue({
    value,
    defaultValue,
    onValueChange,
  });
  const activeIndex = items.findIndex((item) => item.id === activeValue);
  const previousValue = useRef(activeValue);
  const layoutTransition =
    activeValue === null || previousValue.current !== null
      ? COLLAPSE_TRANSITION
      : EXPAND_TRANSITION;
  useLayoutEffect(() => {
    previousValue.current = activeValue;
  }, [activeValue]);

  const toggleItem = useCallback(
    (id: string) => {
      if (activeValue === id) {
        if (collapse === "allowed") setActiveValue(null);
        return;
      }
      setActiveValue(id);
    },
    [activeValue, collapse, setActiveValue],
  );

  return (
    <div role="group" aria-label={ariaLabel} className={cn("w-full", className, classNames?.root)}>
      {items.map((item, index) => {
        const open = activeValue === item.id;
        const previousIsOpen = activeIndex === index - 1;
        const nextIsOpen = activeIndex === index + 1;
        return (
          <BouncyAccordionRow
            key={item.id}
            item={item}
            open={open}
            startsGroup={open || index === 0 || previousIsOpen}
            endsGroup={open || index === items.length - 1 || nextIsOpen}
            separatedFromPrevious={index > 0 && (open || previousIsOpen)}
            radius={radius}
            contentId={`${baseId}-${index}-content`}
            triggerId={`${baseId}-${index}-trigger`}
            reduce={reduce}
            layoutTransition={layoutTransition}
            layoutDependency={activeValue}
            classNames={classNames}
            onToggle={() => toggleItem(item.id)}
          />
        );
      })}
    </div>
  );
}
