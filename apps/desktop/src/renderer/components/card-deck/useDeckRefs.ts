import { useRef } from "react";
import type { DeckRefs, Settings } from "./deckTypes.js";

export function useDeckRefs(
  settings: Settings,
  order: number[],
  onChange: ((index: number) => void) | undefined,
  onCardActivate: ((index: number) => void) | undefined,
): DeckRefs {
  const refs = useRef<DeckRefs | null>(null);
  if (refs.current === null) {
    refs.current = {
      root: { current: null },
      order: { current: order },
      values: { current: new Map() },
      elements: { current: new Map() },
      flying: { current: new Map() },
      drag: { current: null },
      alive: { current: true },
      settings: { current: settings },
      onChange: { current: onChange },
      onCardActivate: { current: onCardActivate },
    };
  }
  refs.current.settings.current = settings;
  refs.current.onChange.current = onChange;
  refs.current.onCardActivate.current = onCardActivate;
  return refs.current;
}
