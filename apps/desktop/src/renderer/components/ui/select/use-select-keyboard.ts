import { type KeyboardEvent as ReactKeyboardEvent, useCallback } from "react";

import { getEnabledOptions, isPrintableKey } from "./options.js";
import type { InitialActiveDirection, SelectOptionRecord, SelectValue } from "./types.js";

interface SelectKeyboardInput {
  disabled: boolean;
  open: boolean;
  activeValue: SelectValue;
  currentValue: SelectValue;
  getOptions: () => SelectOptionRecord[];
  setActiveValue: (value: SelectValue) => void;
  updateOpen: (open: boolean) => void;
  selectValue: (value: string) => void;
  handleTypeahead: (character: string) => void;
}

export function useSelectKeyboard({
  disabled,
  open,
  activeValue,
  currentValue,
  getOptions,
  setActiveValue,
  updateOpen,
  selectValue,
  handleTypeahead,
}: SelectKeyboardInput): (event: ReactKeyboardEvent<HTMLButtonElement>) => void {
  const setInitialActiveOption = useCallback(
    (direction: InitialActiveDirection): void => {
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
    [currentValue, getOptions, setActiveValue],
  );

  const openSelect = useCallback(
    (direction: InitialActiveDirection): void => {
      if (disabled) {
        return;
      }

      setInitialActiveOption(direction);
      updateOpen(true);
    },
    [disabled, setInitialActiveOption, updateOpen],
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
    [activeValue, getOptions, setActiveValue],
  );

  return useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
      if (disabled) {
        return;
      }

      switch (event.key) {
        case "ArrowDown": {
          event.preventDefault();

          if (!open) {
            openSelect("selected");
          } else {
            moveActiveOption(1);
          }

          return;
        }

        case "ArrowUp": {
          event.preventDefault();

          if (!open) {
            openSelect("selected");
          } else {
            moveActiveOption(-1);
          }

          return;
        }

        case "Home": {
          if (!open) {
            return;
          }

          event.preventDefault();
          setInitialActiveOption("first");
          return;
        }

        case "End": {
          if (!open) {
            return;
          }

          event.preventDefault();
          setInitialActiveOption("last");
          return;
        }

        case "Enter":
        case " ": {
          event.preventDefault();

          if (!open) {
            openSelect("selected");
            return;
          }

          if (activeValue !== null) {
            selectValue(activeValue);
          }

          return;
        }

        case "Escape": {
          if (!open) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
          updateOpen(false);
          return;
        }

        case "Tab": {
          if (open) {
            updateOpen(false);
          }

          return;
        }

        default: {
          if (!isPrintableKey(event)) {
            return;
          }

          event.preventDefault();

          if (!open) {
            openSelect("selected");
          }

          handleTypeahead(event.key);
        }
      }
    },
    [
      activeValue,
      disabled,
      handleTypeahead,
      moveActiveOption,
      open,
      openSelect,
      selectValue,
      setInitialActiveOption,
      updateOpen,
    ],
  );
}
