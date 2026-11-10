import type { KeyboardEvent as ReactKeyboardEvent, Ref } from "react";

import type { SelectOptionRecord, SelectValue } from "./types.js";

export function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (!ref) {
    return;
  }

  if (typeof ref === "function") {
    ref(value);
    return;
  }

  ref.current = value;
}

export function getEnabledOptions(options: SelectOptionRecord[]): SelectOptionRecord[] {
  return options.filter((option) => !option.disabled);
}

export function sortByDocumentPosition(options: SelectOptionRecord[]): SelectOptionRecord[] {
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
}

function normalizeTypeaheadValue(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function findTypeaheadMatch(
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

export function isPrintableKey(event: ReactKeyboardEvent<HTMLElement>): boolean {
  return event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey;
}
