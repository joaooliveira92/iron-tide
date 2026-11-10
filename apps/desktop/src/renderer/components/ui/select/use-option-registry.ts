import { useCallback, useEffect, useState } from "react";

import { sortByDocumentPosition } from "./options.js";
import type { SelectOptionRecord, SelectValue } from "./types.js";

export interface OptionRegistry {
  getOptions: () => SelectOptionRecord[];
  getOptionByValue: (value: SelectValue) => SelectOptionRecord | undefined;
  registerOption: (option: SelectOptionRecord) => void;
  unregisterOption: (id: string) => void;
}

export function useOptionRegistry(): OptionRegistry {
  const [options, setOptions] = useState<SelectOptionRecord[]>([]);

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

  const getOptions = useCallback(
    (): SelectOptionRecord[] => sortByDocumentPosition(options),
    [options],
  );

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

  return { getOptions, getOptionByValue, registerOption, unregisterOption };
}
