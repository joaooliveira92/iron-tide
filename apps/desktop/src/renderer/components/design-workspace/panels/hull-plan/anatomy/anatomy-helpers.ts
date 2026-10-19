import { pathOf, type Flat, type SolidPaths, type Tone } from "./iso.js";
import type { AnatomySolid, Fill } from "./anatomy-types.js";

export const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

export const finite = (value: number, fallback: number) =>
  Number.isFinite(value) && value > 0 ? value : fallback;

export const round1 = (value: number) => Math.round(value * 10) / 10;

export const wholeInches = (caliberUm: number) => Math.round(caliberUm / 25_400);

export const solid = (
  paths: SolidPaths,
  tone: Tone = "hi",
  options: { readonly crease?: Tone | "none"; readonly fill?: Fill; readonly flat?: boolean } = {},
): AnatomySolid => ({
  paths,
  tone,
  crease: options.crease ?? "faint",
  fill: options.fill ?? "paper",
  flat: options.flat ?? false,
});

export const ribbon = (top: readonly Flat[], bottom: readonly Flat[]): SolidPaths => {
  const fill = pathOf([...top, ...[...bottom].reverse()], true);
  return { fill, outline: fill, crease: "", top: "", shades: [] };
};
