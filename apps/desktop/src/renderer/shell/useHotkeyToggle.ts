import { useState, useSyncExternalStore } from "react";

export interface HotkeyToggleStore {
  readonly subscribe: (notify: () => void) => () => void;
  readonly read: () => boolean;
  readonly set: (open: boolean) => void;
}

export function createHotkeyToggleStore(
  isHotkey: (event: KeyboardEvent) => boolean,
): HotkeyToggleStore {
  let open = false;
  const listeners = new Set<() => void>();

  const set = (next: boolean) => {
    if (next === open) return;
    open = next;
    for (const listener of listeners) listener();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (!isHotkey(event)) return;
    event.preventDefault();
    set(!open);
  };

  return {
    subscribe: (notify) => {
      if (listeners.size === 0) window.addEventListener("keydown", onKeyDown);
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
        if (listeners.size === 0) window.removeEventListener("keydown", onKeyDown);
      };
    },
    read: () => open,
    set,
  };
}

export function useHotkeyToggle(
  isHotkey: (event: KeyboardEvent) => boolean,
): readonly [boolean, (open: boolean) => void] {
  const [store] = useState(() => createHotkeyToggleStore(isHotkey));
  const open = useSyncExternalStore(store.subscribe, store.read);
  return [open, store.set];
}
