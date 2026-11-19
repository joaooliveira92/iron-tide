"use client";

import { useCallback, useMemo, useRef } from "react";
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

interface SettingsBridge {
  settings: ResolvedSettings;
  wake: (() => void) | null;
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

  const bridge = useRef<SettingsBridge>({ settings, wake: null });

  const attachContainer = useCallback((container: HTMLDivElement) => {
    const renderer = createPatternWavesRenderer(container, () => bridge.current.settings);
    if (!renderer) return undefined;
    bridge.current.wake = () => {
      renderer.wake();
    };
    return () => {
      bridge.current.wake = null;
      renderer.dispose();
    };
  }, []);

  const pushSettings = useCallback(
    (marker: HTMLSpanElement | null) => {
      if (marker === null) return;
      bridge.current.settings = settings;
      bridge.current.wake?.();
    },
    [settings],
  );

  return (
    <div
      ref={attachContainer}
      className={cn("relative w-full overflow-hidden", className)}
      style={{ height, backgroundColor, ...style }}
      {...props}
    >
      <span hidden ref={pushSettings} />
    </div>
  );
};

export default PatternWaves;
