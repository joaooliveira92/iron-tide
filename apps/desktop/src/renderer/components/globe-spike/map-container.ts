export const MAP_CONTAINER_STYLE = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
} as const;

export function hasRenderableSize(width: number, height: number): boolean {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
}
