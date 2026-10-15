"use client";

import { Check, ChevronDown } from "lucide-react";
import { motion, type Transition, useReducedMotion, type Variants } from "motion/react";
import {
  createContext,
  forwardRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import { EASE_OUT } from "@/lib/ease";
import { cn } from "@/lib/utils";

import { FLOATING_LAYER } from "./menu-styles.js";

const INSTANT_TRANSITION: Transition = { duration: 0 };

const CHEVRON_TRANSITION: Transition = {
  type: "spring",
  duration: 0.4,
  bounce: 0.3,
};

const LIST_VARIANTS: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0.025,
    },
  },
};

const ITEM_VARIANTS: Variants = {
  hidden: {
    opacity: 0,
    y: -4,
  },
  show: {
    opacity: 1,
    y: 0,
  },
};

const DEFAULT_SIDE_OFFSET = 8;
const DEFAULT_VIEWPORT_PADDING = 8;
const DEFAULT_MAX_HEIGHT = 320;
const TYPEAHEAD_TIMEOUT_MS = 700;

type Placement = "bottom" | "top";
type SelectValue = string | null;

interface SelectOptionRecord {
  id: string;
  value: string;
  label: string;
  /**
   * Optional leading visual for the option and its trigger (a lucide icon or a flag image). Captured when the option
   * registers; pass a stable element per value.
   */
  icon?: ReactNode;
  disabled: boolean;
  ref: RefObject<HTMLElement | null>;
}

interface FloatingPosition {
  left: number;
  width: number;
  anchorTop: number;
  anchorBottom: number;
  availableHeight: number;
}

interface SelectContextValue {
  value: SelectValue;
  activeValue: SelectValue;
  open: boolean;
  disabled: boolean;
  required: boolean;
  reduceMotion: boolean;
  placement: Placement;

  triggerId: string;
  listboxId: string;

  triggerRef: RefObject<HTMLButtonElement | null>;
  floatingRef: RefObject<HTMLDivElement | null>;

  getOptions: () => SelectOptionRecord[];
  getOptionByValue: (value: SelectValue) => SelectOptionRecord | undefined;

  registerOption: (option: SelectOptionRecord) => void;
  unregisterOption: (id: string) => void;

  setActiveValue: (value: SelectValue) => void;
  setOpen: (open: boolean) => void;
  selectValue: (value: string) => void;
  setPlacement: (placement: Placement) => void;

  handleTriggerKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void;
}

const SelectContext = createContext<SelectContextValue | null>(null);

function useSelectContext(componentName: string): SelectContextValue {
  const context = useContext(SelectContext);

  if (!context) {
    throw new Error(`${componentName} must be used within <Select>.`);
  }

  return context;
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) {
    return;
  }

  if (typeof ref === "function") {
    ref(value);
    return;
  }

  ref.current = value;
}

function getEnabledOptions(options: SelectOptionRecord[]): SelectOptionRecord[] {
  return options.filter((option) => !option.disabled);
}

function normalizeTypeaheadValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function findTypeaheadMatch(
  options: SelectOptionRecord[],
  query: string,
  activeValue: SelectValue,
): SelectOptionRecord | undefined {
  const enabledOptions = getEnabledOptions(options);
  const normalizedQuery = normalizeTypeaheadValue(query);

  if (!normalizedQuery || enabledOptions.length === 0) {
    return undefined;
  }

  const currentIndex = enabledOptions.findIndex((option) => option.value === activeValue);

  const startIndex = currentIndex >= 0 ? (currentIndex + 1) % enabledOptions.length : 0;

  for (let offset = 0; offset < enabledOptions.length; offset += 1) {
    const index = (startIndex + offset) % enabledOptions.length;

    const option = enabledOptions[index];

    if (!option) {
      continue;
    }

    if (normalizeTypeaheadValue(option.label).startsWith(normalizedQuery)) {
      return option;
    }
  }

  return undefined;
}

function isPrintableKey(event: ReactKeyboardEvent<HTMLElement>): boolean {
  return event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;
}

export interface SelectProps {
  value?: SelectValue;
  defaultValue?: SelectValue;
  onValueChange?: (value: string) => void;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;

  /** Called whenever the highlighted (hovered or keyboard-active) option changes; null when none is highlighted. */
  onActiveValueChange?: (value: SelectValue) => void;

  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;

  className?: string;
  children: ReactNode;
}

export function Select({
  value,
  defaultValue = null,
  onValueChange,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  onActiveValueChange,
  name,
  form,
  required = false,
  disabled = false,
  className,
  children,
}: SelectProps) {
  const reduceMotion = useReducedMotion() ?? false;
  const baseId = useId();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const floatingRef = useRef<HTMLDivElement>(null);

  const [options, setOptions] = useState<SelectOptionRecord[]>([]);

  const typeaheadRef = useRef("");
  const typeaheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const valueControlled = value !== undefined;
  const openControlled = controlledOpen !== undefined;

  const [internalValue, setInternalValue] = useState<SelectValue>(defaultValue);

  const [internalOpen, setInternalOpen] = useState(defaultOpen);

  const [activeValue, setActiveValue] = useState<SelectValue>(null);

  const [placement, setPlacement] = useState<Placement>("bottom");

  const currentValue = valueControlled ? (value ?? null) : internalValue;

  const currentOpen = openControlled ? controlledOpen : internalOpen;

  const triggerId = `${baseId}-trigger`;
  const listboxId = `${baseId}-listbox`;

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    const seen = new Set<string>();

    for (const option of options) {
      if (seen.has(option.value)) {
        console.warn(
          `Select contains duplicate value "${option.value}". ` +
            "Every SelectItem value must be unique.",
        );
        return;
      }

      seen.add(option.value);
    }
  }, [options]);

  const getOptions = useCallback((): SelectOptionRecord[] => {
    const sorted = [...options];

    sorted.sort((left, right) => {
      const leftNode = left.ref.current;
      const rightNode = right.ref.current;

      if (!leftNode || !rightNode || leftNode === rightNode) {
        return 0;
      }

      const position = leftNode.compareDocumentPosition(rightNode);

      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        return -1;
      }

      if (position & Node.DOCUMENT_POSITION_PRECEDING) {
        return 1;
      }

      return 0;
    });

    return sorted;
  }, [options]);

  const getOptionByValue = useCallback(
    (optionValue: SelectValue): SelectOptionRecord | undefined => {
      if (optionValue === null) {
        return undefined;
      }

      return getOptions().find((option) => option.value === optionValue);
    },
    [getOptions],
  );

  const registerOption = useCallback((option: SelectOptionRecord): void => {
    setOptions((current) => {
      const index = current.findIndex((registered) => registered.id === option.id);

      if (index === -1) {
        return [...current, option];
      }

      const existing = current[index];

      if (
        existing &&
        existing.value === option.value &&
        existing.label === option.label &&
        existing.disabled === option.disabled
      ) {
        return current;
      }

      const next = current.slice();
      next[index] = option;
      return next;
    });
  }, []);

  const unregisterOption = useCallback((id: string): void => {
    setOptions((current) =>
      current.some((option) => option.id === id)
        ? current.filter((option) => option.id !== id)
        : current,
    );
  }, []);

  const updateOpen = useCallback(
    (nextOpen: boolean): void => {
      if (disabled && nextOpen) {
        return;
      }

      if (!openControlled) {
        setInternalOpen(nextOpen);
      }

      onOpenChange?.(nextOpen);

      if (!nextOpen) {
        setActiveValue(null);
        typeaheadRef.current = "";

        if (typeaheadTimeoutRef.current) {
          clearTimeout(typeaheadTimeoutRef.current);
          typeaheadTimeoutRef.current = undefined;
        }
      }
    },
    [disabled, onOpenChange, openControlled],
  );

  const setInitialActiveOption = useCallback(
    (direction: "first" | "last" | "selected"): void => {
      const enabledOptions = getEnabledOptions(getOptions());

      if (enabledOptions.length === 0) {
        setActiveValue(null);
        return;
      }

      const selectedOption = enabledOptions.find((option) => option.value === currentValue);

      if (direction === "selected" && selectedOption) {
        setActiveValue(selectedOption.value);
        return;
      }

      if (direction === "last") {
        setActiveValue(enabledOptions[enabledOptions.length - 1]?.value ?? null);
        return;
      }

      setActiveValue(enabledOptions[0]?.value ?? null);
    },
    [currentValue, getOptions],
  );

  const openSelect = useCallback(
    (direction: "first" | "last" | "selected"): void => {
      if (disabled) {
        return;
      }

      setInitialActiveOption(direction);
      updateOpen(true);
    },
    [disabled, setInitialActiveOption, updateOpen],
  );

  const selectValue = useCallback(
    (nextValue: string): void => {
      if (disabled) {
        return;
      }

      const option = getOptionByValue(nextValue);

      if (!option || option.disabled) {
        return;
      }

      if (!valueControlled) {
        setInternalValue(nextValue);
      }

      onValueChange?.(nextValue);
      updateOpen(false);

      requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    },
    [disabled, getOptionByValue, onValueChange, updateOpen, valueControlled],
  );

  const moveActiveOption = useCallback(
    (direction: 1 | -1): void => {
      const enabledOptions = getEnabledOptions(getOptions());

      if (enabledOptions.length === 0) {
        setActiveValue(null);
        return;
      }

      const currentIndex = enabledOptions.findIndex((option) => option.value === activeValue);

      const fallbackIndex = direction === 1 ? -1 : enabledOptions.length;

      const baseIndex = currentIndex >= 0 ? currentIndex : fallbackIndex;

      const nextIndex = (baseIndex + direction + enabledOptions.length) % enabledOptions.length;

      setActiveValue(enabledOptions[nextIndex]?.value ?? null);
    },
    [activeValue, getOptions],
  );

  const handleTypeahead = useCallback(
    (character: string): void => {
      if (typeaheadTimeoutRef.current) {
        clearTimeout(typeaheadTimeoutRef.current);
      }

      const previousQuery = typeaheadRef.current;
      const repeatedCharacter =
        previousQuery.length > 0 &&
        previousQuery
          .split("")
          .every((value) => value.toLocaleLowerCase() === character.toLocaleLowerCase());

      typeaheadRef.current = repeatedCharacter ? character : `${previousQuery}${character}`;

      const match = findTypeaheadMatch(
        getOptions(),
        typeaheadRef.current,
        activeValue ?? currentValue,
      );

      if (match) {
        setActiveValue(match.value);
      }

      typeaheadTimeoutRef.current = setTimeout(() => {
        typeaheadRef.current = "";
        typeaheadTimeoutRef.current = undefined;
      }, TYPEAHEAD_TIMEOUT_MS);
    },
    [activeValue, currentValue, getOptions],
  );

  const handleTriggerKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
      if (disabled) {
        return;
      }

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();

          if (!currentOpen) {
            openSelect("selected");
          } else {
            moveActiveOption(1);
          }

          return;
        }

        case "ArrowUp": {
          event.preventDefault();

          if (!currentOpen) {
            openSelect("selected");
          } else {
            moveActiveOption(-1);
          }

          return;
        }

        case "Home": {
          if (!currentOpen) {
            return;
          }

          event.preventDefault();
          setInitialActiveOption("first");
          return;
        }

        case "End": {
          if (!currentOpen) {
            return;
          }

          event.preventDefault();
          setInitialActiveOption("last");
          return;
        }

        case "Enter":
        case " ": {
          event.preventDefault();

          if (!currentOpen) {
            openSelect("selected");
            return;
          }

          if (activeValue !== null) {
            selectValue(activeValue);
          }

          return;
        }

        case "Escape": {
          if (!currentOpen) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          updateOpen(false);
          return;
        }

        case "Tab": {
          if (currentOpen) {
            updateOpen(false);
          }

          return;
        }

        default: {
          if (!isPrintableKey(event)) {
            return;
          }

          event.preventDefault();

          if (!currentOpen) {
            openSelect("selected");
          }

          handleTypeahead(event.key);
        }
      }
    },
    [
      activeValue,
      currentOpen,
      disabled,
      handleTypeahead,
      moveActiveOption,
      openSelect,
      selectValue,
      setInitialActiveOption,
      updateOpen,
    ],
  );

  useEffect(() => {
    if (!currentOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const path = event.composedPath();

      if (triggerRef.current && path.includes(triggerRef.current)) {
        return;
      }

      if (floatingRef.current && path.includes(floatingRef.current)) {
        return;
      }

      updateOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [currentOpen, updateOpen]);

  useEffect(() => {
    if (disabled && currentOpen) {
      updateOpen(false);
    }
  }, [currentOpen, disabled, updateOpen]);

  useEffect(() => {
    return () => {
      if (typeaheadTimeoutRef.current) {
        clearTimeout(typeaheadTimeoutRef.current);
      }
    };
  }, []);

  // The highlighted option, so a host can preview a choice before it is committed.
  useEffect(() => {
    onActiveValueChange?.(activeValue);
  }, [activeValue, onActiveValueChange]);

  const contextValue = useMemo<SelectContextValue>(
    () => ({
      value: currentValue,
      activeValue,
      open: currentOpen,
      disabled,
      required,
      reduceMotion,
      placement,

      triggerId,
      listboxId,

      triggerRef,
      floatingRef,

      getOptions,
      getOptionByValue,

      registerOption,
      unregisterOption,

      setActiveValue,
      setOpen: updateOpen,
      selectValue,
      setPlacement,

      handleTriggerKeyDown,
    }),
    [
      activeValue,
      currentOpen,
      currentValue,
      disabled,
      getOptionByValue,
      getOptions,
      handleTriggerKeyDown,
      listboxId,
      placement,
      reduceMotion,
      registerOption,
      required,
      selectValue,
      setPlacement,
      triggerId,
      unregisterOption,
      updateOpen,
    ],
  );

  return (
    <SelectContext.Provider value={contextValue}>
      <div className={cn("relative", className)}>
        {children}

        {name ? (
          <input
            type="hidden"
            name={name}
            form={form}
            value={currentValue ?? ""}
            disabled={disabled}
          />
        ) : null}
      </div>
    </SelectContext.Provider>
  );
}

export interface SelectTriggerProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "children"
  | "value"
  | "defaultValue"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onDragEnter"
  | "onDragLeave"
  | "onDragOver"
  | "onDrop"
  | "onAnimationStart"
  | "onAnimationEnd"
  | "onAnimationIteration"
> {
  children: ReactNode;
}

export const SelectTrigger = forwardRef<HTMLButtonElement, SelectTriggerProps>(
  function SelectTrigger(
    { id, className, children, onClick, onKeyDown, ...buttonProps },
    forwardedRef,
  ) {
    const context = useSelectContext("SelectTrigger");
    const isTop = context.open ? context.placement === "top" : false;

    const nearRadiusKeyframes = context.open ? [0, 0, 12] : [12, 0, 12];

    const radiusTransition: Transition = context.reduceMotion
      ? INSTANT_TRANSITION
      : context.open
        ? {
            duration: 0.6,
            times: [0, 0.4, 1],
            ease: EASE_OUT,
          }
        : {
            duration: 0.42,
            times: [0, 0.5, 1],
            ease: EASE_OUT,
          };

    const activeOption = context.getOptionByValue(context.activeValue);

    const handleRef = useCallback(
      (node: HTMLButtonElement | null): void => {
        context.triggerRef.current = node;
        assignRef(forwardedRef, node);
      },
      [context.triggerRef, forwardedRef],
    );

    return (
      <motion.button
        {...buttonProps}
        ref={handleRef}
        id={id ?? context.triggerId}
        type="button"
        role="combobox"
        disabled={context.disabled || buttonProps.disabled}
        aria-haspopup="listbox"
        aria-expanded={context.open}
        aria-controls={context.listboxId}
        aria-activedescendant={context.open ? activeOption?.id : undefined}
        aria-required={context.required || undefined}
        aria-disabled={context.disabled || undefined}
        onClick={(event) => {
          onClick?.(event);

          if (event.defaultPrevented || context.disabled) {
            return;
          }

          context.setOpen(!context.open);
        }}
        onKeyDown={(event) => {
          onKeyDown?.(event);

          if (event.defaultPrevented) {
            return;
          }

          context.handleTriggerKeyDown(event);
        }}
        initial={false}
        animate={{
          borderTopLeftRadius: isTop ? nearRadiusKeyframes : 12,
          borderTopRightRadius: isTop ? nearRadiusKeyframes : 12,
          borderBottomLeftRadius: isTop ? 12 : nearRadiusKeyframes,
          borderBottomRightRadius: isTop ? 12 : nearRadiusKeyframes,
        }}
        transition={{
          borderTopLeftRadius: isTop ? radiusTransition : INSTANT_TRANSITION,
          borderTopRightRadius: isTop ? radiusTransition : INSTANT_TRANSITION,
          borderBottomLeftRadius: isTop ? INSTANT_TRANSITION : radiusTransition,
          borderBottomRightRadius: isTop ? INSTANT_TRANSITION : radiusTransition,
        }}
        className={cn(
          "relative z-10 flex w-full items-center justify-between gap-2",
          "rounded-xl border border-border bg-background px-3 py-2",
          "text-sm text-foreground outline-none transition-colors",
          "hover:border-(--color-border-strong)",
          "focus-visible:ring-2 focus-visible:ring-foreground/20",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
      >
        {children}

        <motion.span
          aria-hidden="true"
          animate={{
            rotate: context.open ? 180 : 0,
          }}
          transition={context.reduceMotion ? INSTANT_TRANSITION : CHEVRON_TRANSITION}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </motion.span>
      </motion.button>
    );
  },
);

SelectTrigger.displayName = "SelectTrigger";

export interface SelectValueProps {
  placeholder?: ReactNode;
  className?: string;
}

export function SelectValue({ placeholder = "Select", className }: SelectValueProps) {
  const context = useSelectContext("SelectValue");

  const selectedOption = context.getOptionByValue(context.value);

  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-center gap-2 text-left",
        selectedOption ? "text-foreground" : "text-muted-foreground",
        className,
      )}
    >
      {selectedOption?.icon !== undefined ? (
        <span aria-hidden="true" className="inline-flex shrink-0 items-center">
          {selectedOption.icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1 truncate">{selectedOption?.label ?? placeholder}</span>
    </span>
  );
}

export interface SelectContentProps {
  className?: string;
  viewportClassName?: string;
  children: ReactNode;

  sideOffset?: number;
  viewportPadding?: number;
  maxHeight?: number;
}

export function SelectContent({
  className,
  viewportClassName,
  children,
  sideOffset = DEFAULT_SIDE_OFFSET,
  viewportPadding = DEFAULT_VIEWPORT_PADDING,
  maxHeight = DEFAULT_MAX_HEIGHT,
}: SelectContentProps) {
  const context = useSelectContext("SelectContent");

  const viewportRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [mounted, setMounted] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback((): void => {
    const trigger = context.triggerRef.current;
    const viewport = viewportRef.current;

    if (!trigger || !viewport) {
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();

    const measuredHeight = Math.max(viewport.scrollHeight, viewport.offsetHeight);

    const availableBelow = Math.max(
      0,
      window.innerHeight - triggerRect.bottom - sideOffset - viewportPadding,
    );

    const availableAbove = Math.max(0, triggerRect.top - sideOffset - viewportPadding);

    const preferredHeight = Math.min(measuredHeight, maxHeight);

    const placement: Placement =
      availableBelow >= preferredHeight || availableBelow >= availableAbove ? "bottom" : "top";

    context.setPlacement(placement);

    const availableHeight = Math.max(
      0,
      Math.min(maxHeight, placement === "bottom" ? availableBelow : availableAbove),
    );

    setContentHeight(Math.min(measuredHeight, availableHeight));

    setPosition((previous) => {
      const next: FloatingPosition = {
        left: Math.max(
          viewportPadding,
          Math.min(triggerRect.left, window.innerWidth - viewportPadding - triggerRect.width),
        ),
        width: Math.min(triggerRect.width, window.innerWidth - viewportPadding * 2),
        anchorTop: triggerRect.top,
        anchorBottom: triggerRect.bottom,
        availableHeight,
      };

      if (
        previous &&
        previous.left === next.left &&
        previous.width === next.width &&
        previous.anchorTop === next.anchorTop &&
        previous.anchorBottom === next.anchorBottom &&
        previous.availableHeight === next.availableHeight
      ) {
        return previous;
      }

      return next;
    });
  }, [context.setPlacement, context.triggerRef, maxHeight, sideOffset, viewportPadding]);

  const schedulePositionUpdate = useCallback((): void => {
    if (animationFrameRef.current !== null) {
      return;
    }

    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    if (!mounted) {
      return;
    }

    updatePosition();
  }, [children, context.open, mounted, updatePosition]);

  useLayoutEffect(() => {
    if (!mounted) {
      return;
    }

    const trigger = context.triggerRef.current;
    const viewport = viewportRef.current;

    if (!trigger || !viewport) {
      return;
    }

    const resizeObserver = new ResizeObserver(schedulePositionUpdate);

    resizeObserver.observe(trigger);
    resizeObserver.observe(viewport);

    window.addEventListener("resize", schedulePositionUpdate);

    window.addEventListener("scroll", schedulePositionUpdate, true);

    window.visualViewport?.addEventListener("resize", schedulePositionUpdate);

    window.visualViewport?.addEventListener("scroll", schedulePositionUpdate);

    return () => {
      resizeObserver.disconnect();

      window.removeEventListener("resize", schedulePositionUpdate);

      window.removeEventListener("scroll", schedulePositionUpdate, true);

      window.visualViewport?.removeEventListener("resize", schedulePositionUpdate);

      window.visualViewport?.removeEventListener("scroll", schedulePositionUpdate);

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);

        animationFrameRef.current = null;
      }
    };
  }, [context.triggerRef, mounted, schedulePositionUpdate]);

  useLayoutEffect(() => {
    if (!context.open || context.activeValue === null) {
      return;
    }

    const option = context.getOptionByValue(context.activeValue);

    option?.ref.current?.scrollIntoView({
      block: "nearest",
    });
  }, [context.activeValue, context.getOptionByValue, context.open]);

  if (!mounted) {
    return null;
  }

  const placement = context.placement;
  const isTop = placement === "top";

  const nearGap = context.open ? sideOffset : 0;
  const nearRadius = context.open ? 12 : 0;

  const gapTransition: Transition = context.open
    ? {
        type: "spring",
        duration: 0.5,
        bounce: 0.35,
        delay: 0.08,
      }
    : {
        type: "spring",
        duration: 0.24,
        bounce: 0.1,
      };

  const radiusTransition: Transition = context.open
    ? {
        duration: 0.24,
        ease: EASE_OUT,
        delay: 0.08,
      }
    : {
        duration: 0.14,
        ease: EASE_OUT,
      };

  const targetHeight = context.open && position ? contentHeight : 0;

  return createPortal(
    <motion.div
      ref={context.floatingRef}
      id={context.listboxId}
      role="listbox"
      aria-hidden={!context.open}
      data-placement={placement}
      inert={!context.open}
      initial={false}
      animate={
        context.reduceMotion
          ? {
              opacity: context.open ? 1 : 0,
              height: targetHeight,
            }
          : {
              opacity: context.open ? 1 : 0,
              height: targetHeight,

              marginTop: isTop ? 0 : nearGap,
              marginBottom: isTop ? nearGap : 0,

              borderTopLeftRadius: isTop ? 12 : nearRadius,
              borderTopRightRadius: isTop ? 12 : nearRadius,
              borderBottomLeftRadius: isTop ? nearRadius : 12,
              borderBottomRightRadius: isTop ? nearRadius : 12,
            }
      }
      transition={
        context.reduceMotion
          ? INSTANT_TRANSITION
          : {
              opacity: context.open ? { duration: 0.16 } : { duration: 0.12 },

              height: context.open
                ? {
                    type: "spring",
                    duration: 0.36,
                    bounce: 0.12,
                  }
                : {
                    duration: 0.2,
                    ease: EASE_OUT,
                  },

              marginTop: isTop ? INSTANT_TRANSITION : gapTransition,

              marginBottom: isTop ? gapTransition : INSTANT_TRANSITION,

              borderTopLeftRadius: isTop ? INSTANT_TRANSITION : radiusTransition,

              borderTopRightRadius: isTop ? INSTANT_TRANSITION : radiusTransition,

              borderBottomLeftRadius: isTop ? radiusTransition : INSTANT_TRANSITION,

              borderBottomRightRadius: isTop ? radiusTransition : INSTANT_TRANSITION,
            }
      }
      style={{
        position: "fixed",
        left: position?.left ?? 0,
        width: position?.width ?? 0,

        ...(isTop
          ? {
              bottom: position ? window.innerHeight - position.anchorTop : 0,
            }
          : {
              top: position?.anchorBottom ?? 0,
            }),

        transformOrigin: isTop ? "bottom" : "top",
        overflow: "hidden",
        pointerEvents: context.open ? "auto" : "none",
        visibility: position ? "visible" : "hidden",
      }}
      className={cn(
        "rounded-xl border border-border bg-background shadow-lg",
        FLOATING_LAYER,
        className,
      )}
    >
      <motion.div
        ref={viewportRef}
        {...(context.reduceMotion ? {} : { variants: LIST_VARIANTS })}
        initial={false}
        animate={context.open ? "show" : "hidden"}
        style={{
          maxHeight: position?.availableHeight ?? DEFAULT_MAX_HEIGHT,
        }}
        className={cn("overflow-y-auto overscroll-contain p-1", viewportClassName)}
      >
        {children}
      </motion.div>
    </motion.div>,
    document.body,
  );
}

export interface SelectItemProps {
  value: string;
  textValue?: string;
  /** Optional leading visual shown before the item text and on the trigger when selected (a lucide icon or a flag). */
  icon?: ReactNode;
  /** Optional secondary line under the item label (ReUI "select with description text per option"). */
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
  const context = useSelectContext("SelectItem");

  const generatedId = useId();
  const optionId = `${generatedId}-option`;
  const descriptionId = `${generatedId}-option-description`;

  const optionRef = useRef<HTMLDivElement>(null);

  const resolvedTextValue = textValue ?? (typeof children === "string" ? children : undefined);

  const label = resolvedTextValue ?? value;
  const selected = context.value === value;
  const active = context.activeValue === value;
  const effectivelyDisabled = context.disabled || disabled;

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

    context.registerOption(option);

    return () => {
      context.unregisterOption(optionId);
    };
  }, [
    context.registerOption,
    context.unregisterOption,
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
      {...(context.reduceMotion ? {} : { variants: ITEM_VARIANTS })}
      onPointerDown={(event) => {
        /*
         * Keep DOM focus on the combobox trigger. The active option
         * is exposed with aria-activedescendant.
         */
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (effectivelyDisabled || event.pointerType === "touch") {
          return;
        }

        context.setActiveValue(value);
      }}
      onClick={() => {
        if (effectivelyDisabled) {
          return;
        }

        context.selectValue(value);
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
