"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "../../lib/utils.js";
import { createPatternWavesRenderer } from "./pattern-waves-renderer.js";
import type { PresetOverrides, ResolvedSettings } from "./pattern-waves-presets.js";
import { DEFAULT_CHARACTERS, resolveSettings } from "./pattern-waves-settings.js";

export { parseColor, resolveSettings } from "./pattern-waves-settings.js";
export type { ResolvedSettings } from "./pattern-waves-presets.js";

export interface PatternWavesProps
  extends PresetOverrides, Omit<React.HTMLAttributes<HTMLDivElement>, "color"> {
  height?: string;
}

const PatternWaves = ({
  preset = "silk",
  pattern,
  wave,
  spacing,
  markSize,
  depth,
  light,
  shine,
  contrast,
  speed,
  scale,
  direction,
  color = "#ffffff",
  backgroundColor = "#000000",
  opacity = 1,
  fade = "edges",
  fadeSize = 0.5,
  characters = DEFAULT_CHARACTERS,
  interactive = true,
  cursorSize = 50,
  cursorStrength = 0.6,
  intro = true,
  paused = false,
  height = "100vh",
  className,
  style,
  ...props
}: PatternWavesProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<ResolvedSettings | null>(null);
  const wakeRef = useRef<(() => void) | null>(null);

  const settings = useMemo(
    () =>
      resolveSettings({
        preset,
        pattern,
        wave,
        spacing,
        markSize,
        depth,
        light,
        shine,
        contrast,
        speed,
        scale,
        direction,
        color,
        backgroundColor,
        opacity,
        fade,
        fadeSize,
        characters,
        interactive,
        cursorSize,
        cursorStrength,
        intro,
        paused,
      }),
    [
      preset,
      pattern,
      wave,
      spacing,
      markSize,
      depth,
      light,
      shine,
      contrast,
      speed,
      scale,
      direction,
      color,
      backgroundColor,
      opacity,
      fade,
      fadeSize,
      characters,
      interactive,
      cursorSize,
      cursorStrength,
      intro,
      paused,
    ],
  );

  useEffect(() => {
    settingsRef.current = settings;
    wakeRef.current?.();
  }, [settings]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const renderer = createPatternWavesRenderer(container, () => settingsRef.current);
    if (!renderer) return undefined;
    wakeRef.current = renderer.wake;
    return () => {
      wakeRef.current = null;
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden", className)}
      style={{ height, backgroundColor, ...style }}
      {...props}
    />
  );
};

export default PatternWaves;
