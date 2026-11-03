"use client";

import { motion, useReducedMotion, type Transition } from "motion/react";
import { ChevronDown } from "lucide-react";
import { useCallback, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { EASE_OUT } from "../../lib/ease.js";
import { cn } from "../../lib/utils.js";

export type BouncyAccordionItem = {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  attrs?: Readonly<Record<string, string>>;
};

export type BouncyAccordionClassNames = {
  root?: string;
  item?: string;
  trigger?: string;
  icon?: string;
  title?: string;
  chevron?: string;
  content?: string;
  body?: string;
  description?: string;
};

export interface BouncyAccordionProps {
  items: readonly BouncyAccordionItem[];
  value?: string | null;
  defaultValue?: string | null;
  onValueChange?: (value: string | null) => void;
  collapsible?: boolean;
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

const DESCRIPTION_TRANSITION: Transition = {
  duration: 0.18,
  ease: EASE_OUT,
};

const CHEVRON_TRANSITION: Transition = {
  type: "spring",
  duration: 0.42,
  bounce: 0.28,
};

const GROUP_GAP_PX = 12;

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

function BouncyAccordionRow({
  item,
  open,
  startsGroup,
  endsGroup,
  separatedFromPrevious,
  radius,
  contentId,
  triggerId,
  reduce,
  layoutTransition,
  layoutDependency,
  classNames,
  onToggle,
}: {
  item: BouncyAccordionItem;
  open: boolean;
  startsGroup: boolean;
  endsGroup: boolean;
  separatedFromPrevious: boolean;
  radius: number;
  contentId: string;
  triggerId: string;
  reduce: boolean | null;
  layoutTransition: Transition;
  layoutDependency: string | null;
  classNames?: BouncyAccordionClassNames;
  onToggle: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const updateHeight = () => setContentHeight(node.offsetHeight);
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      {...item.attrs}
      layout={reduce ? false : "position"}
      layoutDependency={layoutDependency}
      initial={false}
      style={{ marginTop: separatedFromPrevious ? GROUP_GAP_PX : 0 }}
      transition={{ layout: layoutTransition }}
    >
      <motion.div
        data-state={open ? "open" : "closed"}
        layout={!reduce}
        layoutDependency={layoutDependency}
        initial={false}
        animate={{
          borderTopLeftRadius: startsGroup ? radius : 0,
          borderTopRightRadius: startsGroup ? radius : 0,
          borderBottomLeftRadius: endsGroup ? radius : 0,
          borderBottomRightRadius: endsGroup ? radius : 0,
        }}
        transition={reduce ? { duration: 0 } : layoutTransition}
        style={{ originY: 0 }}
        className={cn(
          "overflow-hidden bg-card text-card-foreground",
          item.disabled && "opacity-50",
          classNames?.item,
        )}
      >
        <motion.button
          id={triggerId}
          type="button"
          disabled={item.disabled}
          aria-expanded={open}
          aria-controls={contentId}
          onClick={onToggle}
          layout={reduce ? false : "position"}
          layoutDependency={layoutDependency}
          transition={{ layout: layoutTransition }}
          style={{ originY: 0 }}
          className={cn(
            "flex min-h-[54px] w-full items-center gap-4 px-5 text-left outline-none transition-colors",
            "focus-visible:bg-muted/25",
            "disabled:pointer-events-none",
            classNames?.trigger,
          )}
        >
          {item.icon ? (
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center text-muted-foreground",
                classNames?.icon,
              )}
            >
              {item.icon}
            </span>
          ) : null}
          <span
            className={cn(
              "min-w-0 flex-1 text-[15px] font-medium text-foreground",
              classNames?.title,
            )}
          >
            {item.title}
          </span>
          <motion.span
            aria-hidden
            animate={{ rotate: open ? 180 : 0 }}
            transition={reduce ? { duration: 0 } : CHEVRON_TRANSITION}
            className={cn(
              "grid h-6 w-6 shrink-0 place-items-center text-muted-foreground",
              classNames?.chevron,
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </motion.span>
        </motion.button>

        <section
          id={contentId}
          aria-labelledby={triggerId}
          aria-hidden={!open}
          inert={!open}
          style={{ height: open && item.description ? contentHeight || "auto" : 0 }}
          className={cn(classNames?.content)}
        >
          <motion.div
            ref={contentRef}
            layout={reduce ? false : "position"}
            layoutDependency={layoutDependency}
            initial={false}
            animate={{ opacity: open ? 1 : 0 }}
            transition={{
              opacity: reduce ? { duration: 0 } : DESCRIPTION_TRANSITION,
              layout: layoutTransition,
            }}
            style={{ originY: 0 }}
            className={cn("px-5 pb-5", classNames?.body)}
          >
            <div
              className={cn("text-[15px] leading-6 text-muted-foreground", classNames?.description)}
            >
              {item.description}
            </div>
          </motion.div>
        </section>
      </motion.div>
    </motion.div>
  );
}

export function BouncyAccordion({
  items,
  value,
  defaultValue = null,
  onValueChange,
  collapsible = true,
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
        if (collapsible) setActiveValue(null);
        return;
      }
      setActiveValue(id);
    },
    [activeValue, collapsible, setActiveValue],
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
