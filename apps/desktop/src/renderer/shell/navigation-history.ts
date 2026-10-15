/**
 * Browser-style back/forward history over screen names. Visiting a new screen
 * after going back discards the abandoned forward entries, so the toolbar's
 * arrows never offer a branch the player cannot reach.
 *
 * Every operation returns the same object when it would be a no-op, which lets
 * callers use it directly as React state without redundant re-renders.
 */
export interface NavigationHistory<T> {
  readonly entries: readonly T[];
  readonly index: number;
}

export function initialHistory<T>(entry: T): NavigationHistory<T> {
  return { entries: [entry], index: 0 };
}

export function currentEntry<T>(history: NavigationHistory<T>): T {
  const entry = history.entries[history.index];
  if (entry === undefined) throw new Error("Navigation history index is out of range.");
  return entry;
}

export function canGoBack<T>(history: NavigationHistory<T>): boolean {
  return history.index > 0;
}

export function canGoForward<T>(history: NavigationHistory<T>): boolean {
  return history.index < history.entries.length - 1;
}

export function visit<T>(history: NavigationHistory<T>, entry: T): NavigationHistory<T> {
  if (currentEntry(history) === entry) return history;

  const kept = history.entries.slice(0, history.index + 1);
  return { entries: [...kept, entry], index: kept.length };
}

export function goBack<T>(history: NavigationHistory<T>): NavigationHistory<T> {
  if (!canGoBack(history)) return history;
  return { entries: history.entries, index: history.index - 1 };
}

export function goForward<T>(history: NavigationHistory<T>): NavigationHistory<T> {
  if (!canGoForward(history)) return history;
  return { entries: history.entries, index: history.index + 1 };
}
