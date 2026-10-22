export function pinned(x: number, y: number) {
  return { transform: `translate(${x}px, ${y}px) scale(var(--map-inv, 1))` };
}

export function screenText(px: number, strokePx: number) {
  return { fontSize: px, strokeWidth: strokePx, strokeLinejoin: "round" as const };
}
