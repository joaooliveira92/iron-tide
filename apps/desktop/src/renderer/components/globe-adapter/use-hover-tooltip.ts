import { useCallback, useRef, useState } from "react";
import type { HoverTooltip } from "./use-map-instance.js";

export function useHoverTooltip() {
  const [hoverText, setHoverText] = useState<string | null>(null);
  const hoverTextRef = useRef<string | null>(null);
  const hoverPointRef = useRef<{ readonly x: number; readonly y: number } | null>(null);
  const hoverTooltipElRef = useRef<HTMLDivElement | null>(null);
  const placeHoverTooltip = useCallback((element: HTMLDivElement | null) => {
    hoverTooltipElRef.current = element;
    const point = hoverPointRef.current;
    if (element === null || point === null) return;
    element.style.left = `${point.x + 12}px`;
    element.style.top = `${point.y + 12}px`;
  }, []);
  const setHoverTooltip = useCallback(
    (tooltip: HoverTooltip | null) => {
      hoverPointRef.current = tooltip === null ? null : { x: tooltip.x, y: tooltip.y };
      placeHoverTooltip(hoverTooltipElRef.current);
      const text = tooltip?.text ?? null;
      if (text === hoverTextRef.current) return;
      hoverTextRef.current = text;
      setHoverText(text);
    },
    [placeHoverTooltip],
  );
  return { hoverText, placeHoverTooltip, setHoverTooltip };
}
