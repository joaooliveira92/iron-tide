import { BluewaveError } from "@bluewave/contracts";
import { createContext, type PointerEvent as ReactPointerEvent, use } from "react";
import type { Elevation, Layout, MotionValues, Vector } from "./deckTypes.js";

export interface DeckContextValue {
  state: {
    order: number[];
    count: number;
    visible: number;
    shape: Layout;
    origin: Vector;
    dragging: boolean;
    hovered: boolean;
    radius: number;
    frame: number;
    frameColor: string;
    elevation: Elevation;
  };
  actions: {
    sendToBack: (direction: Vector | null) => void;
    setHovered: (hovered: boolean) => void;
    grab: (event: ReactPointerEvent<HTMLDivElement>, index: number) => void;
    attach: (index: number, element: HTMLElement | null) => void;
  };
  meta: {
    rootRef: React.RefObject<HTMLDivElement | null>;
    valuesFor: (index: number) => MotionValues;
  };
}

export const DeckContext = createContext<DeckContextValue | null>(null);

export function useDeck(part: string): DeckContextValue {
  const context = use(DeckContext);
  if (!context) throw new BluewaveError("CARD_DECK_ROOT_MISSING", { part });
  return context;
}
