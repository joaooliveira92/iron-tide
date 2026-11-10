"use client";

import { useReducedMotion } from "motion/react";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";

import { SelectContext } from "./context.js";
import type { Placement, SelectContextValue, SelectValue } from "./types.js";
import { useOptionRegistry } from "./use-option-registry.js";
import { useSelectKeyboard } from "./use-select-keyboard.js";
import { useTypeahead } from "./use-typeahead.js";

export interface SelectProps {
  value?: SelectValue;
  defaultValue?: SelectValue;
  onValueChange?: (value: string) => void;

  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;

  onActiveValueChange?: (value: SelectValue) => void;

  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;

  className?: string;
  children: ReactNode;
}

export function SelectRoot({
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

  const { getOptions, getOptionByValue, registerOption, unregisterOption } = useOptionRegistry();

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

  const { handleTypeahead, resetTypeahead } = useTypeahead({
    getOptions,
    activeValue,
    currentValue,
    setActiveValue,
  });

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
        resetTypeahead();
      }
    },
    [disabled, onOpenChange, openControlled, resetTypeahead],
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

  const handleTriggerKeyDown = useSelectKeyboard({
    disabled,
    open: currentOpen,
    activeValue,
    currentValue,
    getOptions,
    setActiveValue,
    updateOpen,
    selectValue,
    handleTypeahead,
  });

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
    onActiveValueChange?.(activeValue);
  }, [activeValue, onActiveValueChange]);

  const contextValue = useMemo<SelectContextValue>(
    () => ({
      state: {
        value: currentValue,
        activeValue,
        open: currentOpen,
        disabled,
        required,
        placement,
      },
      actions: {
        registerOption,
        unregisterOption,
        setActiveValue,
        setOpen: updateOpen,
        selectValue,
        setPlacement,
        handleTriggerKeyDown,
      },
      meta: {
        reduceMotion,
        triggerId,
        listboxId,
        triggerRef,
        floatingRef,
        getOptions,
        getOptionByValue,
      },
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
