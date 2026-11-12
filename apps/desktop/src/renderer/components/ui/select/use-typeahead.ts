import { useCallback, useEffect, useRef } from "react";

import { findTypeaheadMatch } from "./options.js";
import type { SelectOptionRecord, SelectValue } from "./types.js";

const TYPEAHEAD_TIMEOUT_MS = 700;

interface TypeaheadInput {
  getOptions: () => SelectOptionRecord[];
  activeValue: SelectValue;
  currentValue: SelectValue;
  setActiveValue: (value: SelectValue) => void;
}

export interface Typeahead {
  handleTypeahead: (character: string) => void;
  resetTypeahead: () => void;
}

export function useTypeahead({
  getOptions,
  activeValue,
  currentValue,
  setActiveValue,
}: TypeaheadInput): Typeahead {
  const typeaheadRef = useRef("");
  const typeaheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const resetTypeahead = useCallback((): void => {
    typeaheadRef.current = "";

    if (typeaheadTimeoutRef.current) {
      clearTimeout(typeaheadTimeoutRef.current);
      typeaheadTimeoutRef.current = undefined;
    }
  }, []);

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
    [activeValue, currentValue, getOptions, setActiveValue],
  );

  useEffect(() => {
    return () => {
      if (typeaheadTimeoutRef.current) {
        clearTimeout(typeaheadTimeoutRef.current);
      }
    };
  }, []);

  return { handleTypeahead, resetTypeahead };
}
