"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "../../lib/utils.js";
import { createShaderProgram } from "./shader-program.js";

type SurfacePreset = "silk" | "ocean" | "pond" | "lines" | "terminal" | "mesh";
type PatternKind = "dot" | "square" | "plus" | "line" | "glyph";
type WaveKind = "silk" | "swell" | "ripple";
type FadeKind = "edges" | "center" | "bottom" | "top" | "none";
type Rgba = [number, number, number, number];

interface PresetValues {
  pattern: PatternKind;
  wave: WaveKind;
  spacing: number;
  markSize: number;
  depth: number;
  light: number;
  shine: number;
  contrast: number;
  speed: number;
  scale: number;
  direction: number;
}

export interface ResolvedSettings extends PresetValues {
  color: Rgba;
  background: Rgba;
  opacity: number;
  fade: FadeKind;
  fadeSize: number;
  characters: string;
  interactive: boolean;
  cursorSize: number;
  cursorStrength: number;
  intro: boolean;
  paused: boolean;
}

type PresetOverrides = Partial<PresetValues> & {
  preset?: SurfacePreset;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  fade?: FadeKind;
  fadeSize?: number;
  characters?: string;
  interactive?: boolean;
  cursorSize?: number;
  cursorStrength?: number;
  intro?: boolean;
  paused?: boolean;
};

export interface PatternWavesProps
  extends PresetOverrides, Omit<React.HTMLAttributes<HTMLDivElement>, "color"> {
  height?: string;
}

interface RenderTarget {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface RippleField {
  width: number;
  height: number;
  read: RenderTarget;
  write: RenderTarget;
}

const SURFACE_PRESETS: Record<SurfacePreset, PresetValues> = {
  silk: {
    pattern: "dot",
    wave: "silk",
    spacing: 9,
    markSize: 0.95,
    depth: 0.95,
    light: 0,
    shine: 0.8,
    contrast: 1.2,
    speed: 0.35,
    scale: 1,
    direction: 20,
  },
  ocean: {
    pattern: "dot",
    wave: "swell",
    spacing: 10,
    markSize: 0.9,
    depth: 0.42,
    light: 0,
    shine: 1,
    contrast: 1.2,
    speed: 0.5,
    scale: 1,
    direction: 100,
  },
  pond: {
    pattern: "dot",
    wave: "ripple",
    spacing: 10,
    markSize: 0.9,
    depth: 0.55,
    light: 0,
    shine: 1.2,
    contrast: 1.2,
    speed: 0.5,
    scale: 1,
    direction: 35,
  },
  lines: {
    pattern: "line",
    wave: "silk",
    spacing: 12,
    markSize: 0.42,
    depth: 0.9,
    light: 0,
    shine: 0.6,
    contrast: 1.2,
    speed: 0.3,
    scale: 1,
    direction: 20,
  },
  terminal: {
    pattern: "glyph",
    wave: "ripple",
    spacing: 13,
    markSize: 0.95,
    depth: 0.75,
    light: 0,
    shine: 0.9,
    contrast: 1.4,
    speed: 0.3,
    scale: 1.1,
    direction: 200,
  },
  mesh: {
    pattern: "plus",
    wave: "silk",
    spacing: 14,
    markSize: 0.8,
    depth: 0.95,
    light: 0,
    shine: 1,
    contrast: 1.45,
    speed: 0.4,
    scale: 1.1,
    direction: 325,
  },
};

const PATTERNS: Record<PatternKind, number> = { dot: 0, square: 1, plus: 2, line: 3, glyph: 4 };
const WAVES: Record<WaveKind, number> = { silk: 0, swell: 1, ripple: 2 };
const FADES: Record<FadeKind, number> = { none: 0, edges: 1, center: 2, bottom: 3, top: 4 };
const DEFAULT_CHARACTERS = ".:-=+*#%@";
const GLYPH_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
const ATLAS_TILE = 128;
const WAVE_UNIT = 520;
const RIPPLE_CELL = 8;
const RIPPLE_RATE = 60;
const PIXEL_BUDGET = 4.5e6;
const INTRO_SECONDS = 2;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const luminance = (rgba: Rgba) => 0.2126 * rgba[0] + 0.7152 * rgba[1] + 0.0722 * rgba[2];

const HEX_COLOR = /^#?([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function parseColor(value: string, fallback: Rgba): Rgba {
  const trimmed = value.trim();

  const hexMatch = HEX_COLOR.exec(trimmed);
  if (hexMatch) {
    const digits = hexMatch[1] ?? "";
    const expand = digits.length <= 4;
    const step = expand ? 1 : 2;
    const channels: number[] = [];
    for (let index = 0; index + step <= digits.length; index += step) {
      const chunk = digits.slice(index, index + step);
      const parsed = Number.parseInt(expand ? chunk + chunk : chunk, 16);
      channels.push(parsed / 255);
    }
    if (channels.length >= 3) {
      return [channels[0] ?? 0, channels[1] ?? 0, channels[2] ?? 0, channels[3] ?? 1];
    }
  }

  const functional = /^rgba?\(([^)]+)\)$/i.exec(trimmed);
  if (functional) {
    const parts = (functional[1] ?? "").split(/[,\s/]+/).filter((part) => part.length > 0);
    if (parts.length >= 3) {
      const r = Number.parseFloat(parts[0] ?? "");
      const g = Number.parseFloat(parts[1] ?? "");
      const b = Number.parseFloat(parts[2] ?? "");
      const a = parts[3] !== undefined ? Number.parseFloat(parts[3]) : 1;
      if ([r, g, b, a].every(Number.isFinite)) {
        return [
          clamp(r, 0, 255) / 255,
          clamp(g, 0, 255) / 255,
          clamp(b, 0, 255) / 255,
          clamp(a, 0, 1),
        ];
      }
    }
  }

  return fallback;
}

export function resolveSettings(overrides: PresetOverrides): ResolvedSettings {
  const base = SURFACE_PRESETS[overrides.preset ?? "silk"] ?? SURFACE_PRESETS.silk;
  const presetValues: Partial<PresetValues> = overrides;
  const pick = <K extends keyof PresetValues>(key: K): PresetValues[K] =>
    presetValues[key] ?? base[key];

  return {
    color: parseColor(overrides.color ?? "#ffffff", [1, 1, 1, 1]),
    background: parseColor(overrides.backgroundColor ?? "#000000", [0, 0, 0, 1]),
    pattern: pick("pattern"),
    wave: pick("wave"),
    spacing: pick("spacing"),
    markSize: pick("markSize"),
    depth: pick("depth"),
    light: pick("light"),
    shine: pick("shine"),
    contrast: pick("contrast"),
    speed: pick("speed"),
    scale: pick("scale"),
    direction: pick("direction"),
    opacity: overrides.opacity ?? 1,
    fade: overrides.fade ?? "edges",
    fadeSize: overrides.fadeSize ?? 0.5,
    characters: overrides.characters ?? DEFAULT_CHARACTERS,
    interactive: overrides.interactive ?? true,
    cursorSize: overrides.cursorSize ?? 50,
    cursorStrength: overrides.cursorStrength ?? 0.6,
    intro: overrides.intro ?? true,
    paused: overrides.paused ?? false,
  };
}

function buildAtlas(characters: string) {
  const glyphs = Array.from(characters && characters.length ? characters : DEFAULT_CHARACTERS);
  const columns = Math.ceil(Math.sqrt(glyphs.length));
  const lines = Math.ceil(glyphs.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = columns * ATLAS_TILE;
  canvas.height = lines * ATLAS_TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${Math.round(ATLAS_TILE * 0.86)}px ${GLYPH_FONT}`;
  glyphs.forEach((glyph, index) => {
    const x = (index % columns) * ATLAS_TILE + ATLAS_TILE / 2;
    const y = Math.floor(index / columns) * ATLAS_TILE + ATLAS_TILE / 2;
    ctx.fillText(glyph, x, y);
  });
  return { canvas, columns, lines, count: glyphs.length };
}

const vertexShaderGLSL = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fieldFragmentGLSL = `#version 300 es
precision highp float;
precision highp int;
uniform vec2 uSize;
uniform float uDpr;
uniform vec2 uOrigin;
uniform vec2 uPitch;
uniform int uWave;
uniform float uTime;
uniform float uUnit;
uniform vec2 uHeading;
uniform float uAmp;
uniform float uDepth;
uniform vec3 uLight;
uniform float uShine;
uniform float uContrast;
uniform float uInk;
uniform float uOpacity;
uniform int uFade;
uniform float uFadeSize;
uniform float uAppear;
uniform sampler2D tRipple;
uniform float uRipple;
out vec4 fragColor;

const float FOLDS = 5.5;

uvec3 scramble(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z;
  v.y += v.z * v.x;
  v.z += v.x * v.y;
  return v;
}

vec3 lattice(vec3 corner) {
  uvec3 h = scramble(uvec3(ivec3(corner) + 4096));
  return vec3(h & 65535u) / 32767.5 - 1.0;
}

float gradientNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = p - i;
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n000 = dot(lattice(i), f);
  float n100 = dot(lattice(i + vec3(1.0, 0.0, 0.0)), f - vec3(1.0, 0.0, 0.0));
  float n010 = dot(lattice(i + vec3(0.0, 1.0, 0.0)), f - vec3(0.0, 1.0, 0.0));
  float n110 = dot(lattice(i + vec3(1.0, 1.0, 0.0)), f - vec3(1.0, 1.0, 0.0));
  float n001 = dot(lattice(i + vec3(0.0, 0.0, 1.0)), f - vec3(0.0, 0.0, 1.0));
  float n101 = dot(lattice(i + vec3(1.0, 0.0, 1.0)), f - vec3(1.0, 0.0, 1.0));
  float n011 = dot(lattice(i + vec3(0.0, 1.0, 1.0)), f - vec3(0.0, 1.0, 1.0));
  float n111 = dot(lattice(i + vec3(1.0, 1.0, 1.0)), f - vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

vec2 turn(vec2 v, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * v.x - s * v.y, s * v.x + c * v.y);
}

float surface(vec2 p, float t) {
  if (uWave == 0) {
    vec2 side = vec2(-uHeading.y, uHeading.x);
    float u = dot(p, uHeading);
    float v = dot(p, side);
    float bend = gradientNoise(vec3(v * 0.85, u * 0.3, t * 0.05)) * 1.7 + 0.4 * sin(v * 1.6 + t * 0.2);
    float phase = u * FOLDS + bend - t * 0.45;
    float swell = 0.6 + 0.4 * gradientNoise(vec3(u * 0.55 + 3.0, v * 0.45, t * 0.04));
    float fold = sin(phase) + 0.32 * sin(2.0 * phase + 1.3);
    float ripple = 0.16 * sin(u * FOLDS * 2.5 + bend * 1.9 - t * 0.9 + 2.1);
    return (fold + ripple) * swell;
  }
  if (uWave == 1) {
    float bend = gradientNoise(vec3(p * 0.6, t * 0.05)) * 0.6;
    float phase = dot(p, uHeading) * 15.0 + bend * 2.2 - t * 1.4;
    float swell = sin(phase) + 0.3 * sin(2.0 * phase - 0.8);
    float roll = 0.75 + 0.25 * gradientNoise(vec3(p * 0.9 + 11.0, t * 0.05));
    return 0.8 * swell * roll;
  }
  float r = length(p + uHeading * 1.2);
  float bend = gradientNoise(vec3(p * 1.2, t * 0.05)) * 0.1;
  return sin((r + bend) * 9.0 - t * 1.8) * (0.45 + 0.55 * exp(-(r - 0.6) * 0.8));
}

float heightAt(vec2 css) {
  float h = surface((css - 0.5 * uSize) / uUnit, uTime) * uAmp;
  if (uRipple > 0.0) h += texture(tRipple, css / uSize).r * uRipple;
  return h;
}

void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec2 center = uOrigin + (cell + 0.5) * uPitch;
  vec2 css = center / uDpr;
  vec2 uv = css / uSize;
  float e = max(uPitch.y / uDpr, 4.0);
  float h = heightAt(css);
  float hx = (heightAt(css + vec2(e, 0.0)) - heightAt(css - vec2(e, 0.0))) / (2.0 * e);
  float hy = (heightAt(css + vec2(0.0, e)) - heightAt(css - vec2(0.0, e))) / (2.0 * e);
  vec2 grad = vec2(hx, hy) * uUnit * uDepth * 0.4;
  vec3 n = normalize(vec3(-grad, 1.0));

  float diffuse = clamp(dot(n, uLight), 0.0, 1.0);
  vec3 halfway = normalize(uLight + vec3(0.0, 0.0, 1.0));
  float spec = pow(clamp(dot(n, halfway), 0.0, 1.0), 160.0) * uShine * 1.15;
  float hollow = 0.7 + 0.3 * clamp(h * 0.5 + 0.5, 0.0, 1.0);
  float tone = clamp(diffuse * hollow * 0.78 + spec, 0.0, 1.0);
  tone = clamp((tone - 0.42) * uContrast + 0.42, 0.0, 1.0);

  float level = uInk > 0.5 ? pow(clamp(1.0 - tone / 0.46, 0.0, 1.0), 2.4) * 0.72 : pow(tone, 2.2);
  float emphasis = uInk > 0.5 ? smoothstep(0.55, 0.95, level) : clamp(spec * 1.6, 0.0, 1.0);

  float fade = 1.0;
  vec2 c = uv * 2.0 - 1.0;
  if (uFade == 1) {
    fade = 1.0 - smoothstep(1.0 - uFadeSize, 1.18, length(c));
  } else if (uFade == 2) {
    fade = mix(0.05, 1.0, smoothstep(0.08, 0.08 + uFadeSize, length(c * vec2(1.0, 1.35))));
  } else if (uFade == 3) {
    fade = smoothstep(0.0, uFadeSize, uv.y);
  } else if (uFade == 4) {
    fade = smoothstep(0.0, uFadeSize, 1.0 - uv.y);
  }

  float reach = length(css - 0.5 * uSize) / max(0.5 * length(uSize), 1.0);
  float appear = smoothstep(reach - 0.05, reach + 0.3, uAppear * 1.35);

  float alpha = uOpacity * fade * appear * (0.22 + 0.78 * level);
  float lift = clamp(h * uDepth * 0.42, -0.48, 0.48);
  fragColor = vec4(level, alpha, emphasis, lift + 0.5);
}
`;

const rippleFragmentGLSL = `#version 300 es
precision highp float;
uniform sampler2D tState;
uniform vec2 uTexel;
uniform vec2 uSize;
uniform vec2 uFrom;
uniform vec2 uTo;
uniform float uRadius;
uniform float uImpulse;
uniform float uDamping;
out vec4 fragColor;

void main() {
  vec2 uv = gl_FragCoord.xy * uTexel;
  vec2 state = texture(tState, uv).rg;
  float left = texture(tState, uv - vec2(uTexel.x, 0.0)).r;
  float right = texture(tState, uv + vec2(uTexel.x, 0.0)).r;
  float below = texture(tState, uv - vec2(0.0, uTexel.y)).r;
  float above = texture(tState, uv + vec2(0.0, uTexel.y)).r;
  float next = ((left + right + below + above) * 0.5 - state.g) * uDamping;
  vec2 p = uv * uSize;
  vec2 segment = uTo - uFrom;
  float along = clamp(dot(p - uFrom, segment) / max(dot(segment, segment), 1e-4), 0.0, 1.0);
  float d = length(p - uFrom - segment * along) / uRadius;
  next -= uImpulse * exp(-d * d * 2.0);
  fragColor = vec4(next, state.r, 0.0, 1.0);
}
`;

const markFragmentGLSL = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D tField;
uniform sampler2D tAtlas;
uniform vec2 uOrigin;
uniform vec2 uPitch;
uniform vec2 uGrid;
uniform int uPattern;
uniform float uMarkSize;
uniform float uStroke;
uniform vec3 uColor;
uniform vec3 uAccent;
uniform vec4 uBackground;
uniform vec3 uAtlas;
out vec4 fragColor;

float box(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float coverage(vec2 local, float level) {
  float span = uPitch.y * uMarkSize;
  float area = max(sqrt(level), 0.14);
  if (uPattern == 0) {
    return clamp(0.5 - (length(local) - 0.5 * span * area), 0.0, 1.0);
  }
  if (uPattern == 1) {
    float extent = 0.5 * span * area;
    return clamp(0.5 - box(local, vec2(extent), extent * 0.3), 0.0, 1.0);
  }
  if (uPattern == 2) {
    float arm = 0.5 * span * mix(0.3, 1.0, level);
    float width = 0.5 * uStroke;
    return clamp(0.5 - min(box(local, vec2(arm, width), width), box(local, vec2(width, arm), width)), 0.0, 1.0);
  }
  if (uAtlas.z < 1.0) return 0.0;
  vec2 g = local / span + 0.5;
  if (g.x < 0.0 || g.y < 0.0 || g.x > 1.0 || g.y > 1.0) return 0.0;
  float index = min(floor(level * uAtlas.z), uAtlas.z - 1.0);
  vec2 tile = vec2(mod(index, uAtlas.x), floor(index / uAtlas.x));
  vec2 atlasUv = (tile + vec2(g.x, 1.0 - g.y)) / uAtlas.xy;
  vec2 texel = 1.0 / (span * uAtlas.xy);
  return textureGrad(tAtlas, atlasUv, vec2(texel.x, 0.0), vec2(0.0, texel.y)).a;
}

vec4 lineInk(vec2 rel) {
  float fx = rel.x / uPitch.x - 0.5;
  float c0 = clamp(floor(fx), 0.0, uGrid.x - 1.0);
  float c1 = min(c0 + 1.0, uGrid.x - 1.0);
  float t = clamp(fx - c0, 0.0, 1.0);
  float row = floor(rel.y / uPitch.y);
  vec4 ink = vec4(0.0);
  for (int k = -1; k <= 1; k++) {
    float cy = row + float(k);
    if (cy < 0.0 || cy >= uGrid.y) continue;
    vec4 a = texelFetch(tField, ivec2(int(c0), int(cy)), 0);
    vec4 b = texelFetch(tField, ivec2(int(c1), int(cy)), 0);
    vec4 f = mix(a, b, t);
    if (f.g < 0.002) continue;
    float y = (cy + 0.5 + f.a - 0.5) * uPitch.y;
    float slope = (b.a - a.a) * uPitch.y / uPitch.x;
    float thickness = max(uStroke, uPitch.y * uMarkSize * f.r);
    float d = abs(rel.y - y) / sqrt(1.0 + slope * slope) - 0.5 * thickness;
    float alpha = clamp(0.5 - d, 0.0, 1.0) * f.g;
    if (alpha > ink.a) ink = vec4(mix(uColor, uAccent, f.b) * alpha, alpha);
  }
  return ink;
}

void main() {
  vec2 rel = gl_FragCoord.xy - uOrigin;
  vec4 background = vec4(uBackground.rgb * uBackground.a, uBackground.a);
  vec4 ink = vec4(0.0);
  if (uPattern == 3) {
    ink = lineInk(rel);
  } else {
    float cx = floor(rel.x / uPitch.x);
    float row = floor(rel.y / uPitch.y);
    if (cx >= 0.0 && cx < uGrid.x) {
      for (int k = -1; k <= 1; k++) {
        float cy = row + float(k);
        if (cy < 0.0 || cy >= uGrid.y) continue;
        vec4 f = texelFetch(tField, ivec2(int(cx), int(cy)), 0);
        if (f.g < 0.002) continue;
        vec2 center = (vec2(cx, cy) + 0.5) * uPitch + vec2(0.0, (f.a - 0.5) * uPitch.y);
        float alpha = coverage(rel - center, f.r) * f.g;
        if (alpha > ink.a) ink = vec4(mix(uColor, uAccent, f.b) * alpha, alpha);
      }
    }
  }
  fragColor = ink + background * (1.0 - ink.a);
}
`;

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

    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
    });
    if (!gl) return undefined;

    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.setAttribute("aria-hidden", "true");
    container.appendChild(canvas);

    const fieldProgram = createShaderProgram(gl, vertexShaderGLSL, fieldFragmentGLSL);
    const rippleProgram = createShaderProgram(gl, vertexShaderGLSL, rippleFragmentGLSL);
    const markProgram = createShaderProgram(gl, vertexShaderGLSL, markFragmentGLSL);
    if (!fieldProgram || !rippleProgram || !markProgram) {
      fieldProgram?.dispose();
      rippleProgram?.dispose();
      markProgram?.dispose();
      container.removeChild(canvas);
      return undefined;
    }

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const fieldPositionLocation = gl.getAttribLocation(fieldProgram.program, "position");
    const ripplePositionLocation = gl.getAttribLocation(rippleProgram.program, "position");
    const markPositionLocation = gl.getAttribLocation(markProgram.program, "position");

    const blank = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, blank);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const atlasTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);

    const createTarget = (width: number, height: number, float: boolean): RenderTarget => {
      const texture = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        float ? gl.RGBA16F : gl.RGBA8,
        width,
        height,
        0,
        gl.RGBA,
        float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
        null,
      );
      const filter = float ? gl.LINEAR : gl.NEAREST;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

      const framebuffer = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      return { framebuffer, texture, width, height };
    };

    const disposeTarget = (target: RenderTarget) => {
      gl.deleteFramebuffer(target.framebuffer);
      gl.deleteTexture(target.texture);
    };

    const bindTarget = (target: RenderTarget | null) => {
      if (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.viewport(0, 0, target.width, target.height);
      } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
      }
    };

    const fieldUniforms = {
      uSize: gl.getUniformLocation(fieldProgram.program, "uSize"),
      uDpr: gl.getUniformLocation(fieldProgram.program, "uDpr"),
      uOrigin: gl.getUniformLocation(fieldProgram.program, "uOrigin"),
      uPitch: gl.getUniformLocation(fieldProgram.program, "uPitch"),
      uWave: gl.getUniformLocation(fieldProgram.program, "uWave"),
      uTime: gl.getUniformLocation(fieldProgram.program, "uTime"),
      uUnit: gl.getUniformLocation(fieldProgram.program, "uUnit"),
      uHeading: gl.getUniformLocation(fieldProgram.program, "uHeading"),
      uAmp: gl.getUniformLocation(fieldProgram.program, "uAmp"),
      uDepth: gl.getUniformLocation(fieldProgram.program, "uDepth"),
      uLight: gl.getUniformLocation(fieldProgram.program, "uLight"),
      uShine: gl.getUniformLocation(fieldProgram.program, "uShine"),
      uContrast: gl.getUniformLocation(fieldProgram.program, "uContrast"),
      uInk: gl.getUniformLocation(fieldProgram.program, "uInk"),
      uOpacity: gl.getUniformLocation(fieldProgram.program, "uOpacity"),
      uFade: gl.getUniformLocation(fieldProgram.program, "uFade"),
      uFadeSize: gl.getUniformLocation(fieldProgram.program, "uFadeSize"),
      uAppear: gl.getUniformLocation(fieldProgram.program, "uAppear"),
      tRipple: gl.getUniformLocation(fieldProgram.program, "tRipple"),
      uRipple: gl.getUniformLocation(fieldProgram.program, "uRipple"),
    };
    const rippleUniforms = {
      tState: gl.getUniformLocation(rippleProgram.program, "tState"),
      uTexel: gl.getUniformLocation(rippleProgram.program, "uTexel"),
      uSize: gl.getUniformLocation(rippleProgram.program, "uSize"),
      uFrom: gl.getUniformLocation(rippleProgram.program, "uFrom"),
      uTo: gl.getUniformLocation(rippleProgram.program, "uTo"),
      uRadius: gl.getUniformLocation(rippleProgram.program, "uRadius"),
      uImpulse: gl.getUniformLocation(rippleProgram.program, "uImpulse"),
      uDamping: gl.getUniformLocation(rippleProgram.program, "uDamping"),
    };
    const markUniforms = {
      tField: gl.getUniformLocation(markProgram.program, "tField"),
      tAtlas: gl.getUniformLocation(markProgram.program, "tAtlas"),
      uOrigin: gl.getUniformLocation(markProgram.program, "uOrigin"),
      uPitch: gl.getUniformLocation(markProgram.program, "uPitch"),
      uGrid: gl.getUniformLocation(markProgram.program, "uGrid"),
      uPattern: gl.getUniformLocation(markProgram.program, "uPattern"),
      uMarkSize: gl.getUniformLocation(markProgram.program, "uMarkSize"),
      uStroke: gl.getUniformLocation(markProgram.program, "uStroke"),
      uColor: gl.getUniformLocation(markProgram.program, "uColor"),
      uAccent: gl.getUniformLocation(markProgram.program, "uAccent"),
      uBackground: gl.getUniformLocation(markProgram.program, "uBackground"),
      uAtlas: gl.getUniformLocation(markProgram.program, "uAtlas"),
    };

    gl.useProgram(fieldProgram.program);
    gl.uniform1i(fieldUniforms.tRipple, 0);
    gl.useProgram(rippleProgram.program);
    gl.uniform1i(rippleUniforms.tState, 0);
    gl.useProgram(markProgram.program);
    gl.uniform1i(markUniforms.tField, 0);
    gl.uniform1i(markUniforms.tAtlas, 1);

    const bindPosition = (location: number) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
    };

    const floatTargets = !!gl.getExtension("EXT_color_buffer_float");
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    let fieldTarget = createTarget(1, 1, false);
    let ripple: RippleField | null = null;
    let atlasKey = "";
    let atlasColumns = 1;
    let atlasLines = 1;
    let atlasCount = 0;

    let width = 1;
    let height = 1;
    let raf = 0;
    let last = performance.now();
    let time = 0;
    let introClock = 0;
    let visible = true;
    let alive = true;
    let rippleUntil = 0;
    let rippleLive = false;
    let rippleClock = 0;
    const pointer = { x: 0, y: 0, inside: false, placed: false, lastX: 0, lastY: 0, burst: 0 };

    const buildRipple = () => {
      if (!floatTargets) return;
      const rippleWidth = clamp(Math.ceil(width / RIPPLE_CELL), 4, 512);
      const rippleHeight = clamp(Math.ceil(height / RIPPLE_CELL), 4, 512);
      if (ripple && ripple.width === rippleWidth && ripple.height === rippleHeight) return;
      if (ripple) {
        disposeTarget(ripple.read);
        disposeTarget(ripple.write);
      }
      ripple = {
        width: rippleWidth,
        height: rippleHeight,
        read: createTarget(rippleWidth, rippleHeight, true),
        write: createTarget(rippleWidth, rippleHeight, true),
      };
      rippleLive = false;
    };

    const clearRipple = () => {
      if (!ripple) return;
      for (const target of [ripple.read, ripple.write]) {
        bindTarget(target);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      bindTarget(null);
    };

    const refreshAtlas = (settings: ResolvedSettings) => {
      if (settings.characters === atlasKey) return;
      atlasKey = settings.characters;
      const built = buildAtlas(settings.characters);
      if (!built) return;
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, built.canvas);
      gl.generateMipmap(gl.TEXTURE_2D);
      atlasColumns = built.columns;
      atlasLines = built.lines;
      atlasCount = built.count;
    };

    const start = () => {
      if (raf || !visible || !alive) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      width = Math.max(1, container.clientWidth);
      height = Math.max(1, container.clientHeight);
      const dpr = Math.min(
        window.devicePixelRatio || 1,
        2,
        Math.sqrt(PIXEL_BUDGET / (width * height)),
      );
      const pixelWidth = Math.max(1, Math.floor(width * dpr));
      const pixelHeight = Math.max(1, Math.floor(height * dpr));
      if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
      if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
      buildRipple();
      start();
    };

    const stepRipple = (field: RippleField, settings: ResolvedSettings, dt: number) => {
      rippleClock = Math.min(rippleClock + dt * RIPPLE_RATE, 4);
      const strength = clamp(settings.cursorStrength, 0, 1);
      const moved = Math.hypot(pointer.x - pointer.lastX, pointer.y - pointer.lastY);
      let impulse =
        (pointer.inside ? Math.min(moved / 14, 1) * 0.35 * strength : 0) + pointer.burst * strength;
      pointer.burst = 0;

      gl.useProgram(rippleProgram.program);
      bindPosition(ripplePositionLocation);
      gl.uniform2f(rippleUniforms.uTexel, 1 / field.width, 1 / field.height);
      gl.uniform2f(rippleUniforms.uSize, width, height);
      gl.uniform2f(rippleUniforms.uFrom, pointer.lastX, height - pointer.lastY);
      gl.uniform2f(rippleUniforms.uTo, pointer.x, height - pointer.y);
      gl.uniform1f(rippleUniforms.uRadius, clamp(settings.cursorSize, 8, 400));

      gl.activeTexture(gl.TEXTURE0);
      while (rippleClock >= 1) {
        rippleClock -= 1;
        gl.bindTexture(gl.TEXTURE_2D, field.read.texture);
        gl.uniform1f(rippleUniforms.uImpulse, impulse);
        bindTarget(field.write);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        const next = field.read;
        field.read = field.write;
        field.write = next;
        impulse = 0;
      }

      pointer.lastX = pointer.x;
      pointer.lastY = pointer.y;
    };

    const frame = (now: number) => {
      raf = 0;
      if (!alive) return;
      const settings = settingsRef.current;
      const dt = Math.min(0.05, Math.max(1 / 240, (now - last) / 1000));
      last = now;
      if (!settings) return;

      const moving = !settings.paused && !reducedMotion && settings.speed !== 0;
      if (moving) time += dt * settings.speed;
      introClock =
        settings.intro && !reducedMotion ? Math.min(1, introClock + dt / INTRO_SECONDS) : 1;
      const appear = 1 - Math.pow(1 - clamp(introClock / 0.75, 0, 1), 3);
      const rise = clamp((introClock - 0.1) / 0.9, 0, 1);
      const amp = rise * rise * (3 - 2 * rise);

      const rippling =
        settings.interactive && !reducedMotion && !!ripple && settings.cursorStrength > 0;
      if (rippling && pointer.inside && !pointer.placed) {
        pointer.lastX = pointer.x;
        pointer.lastY = pointer.y;
        pointer.placed = true;
      }
      if (rippling && (pointer.inside || pointer.burst > 0)) rippleUntil = now + 5000;
      const rippleActive = rippling && now < rippleUntil;
      if (rippleActive && ripple) {
        stepRipple(ripple, settings, dt);
        rippleLive = true;
      } else if (rippleLive) {
        clearRipple();
        rippleLive = false;
      }

      const patternIndex = PATTERNS[settings.pattern];
      if (patternIndex === 4) refreshAtlas(settings);

      const canvasWidth = gl.drawingBufferWidth;
      const canvasHeight = gl.drawingBufferHeight;
      const dpr = canvasWidth / width;
      const pitchY = Math.max(4, Math.round(clamp(settings.spacing, 4, 120) * dpr));
      const pitchX = patternIndex === 3 ? Math.max(2, Math.round(pitchY / 4)) : pitchY;
      const cols = Math.min(4096, Math.ceil(canvasWidth / pitchX) + 1);
      const rows = Math.min(4096, Math.ceil(canvasHeight / pitchY) + 2);
      const originX = Math.floor((canvasWidth - cols * pitchX) / 2);
      const originY = Math.floor((canvasHeight - rows * pitchY) / 2);
      if (fieldTarget.width !== cols || fieldTarget.height !== rows) {
        disposeTarget(fieldTarget);
        fieldTarget = createTarget(cols, rows, false);
      }

      const heading = (settings.direction * Math.PI) / 180;
      const lightAngle =
        ((settings.direction + 180 + clamp(settings.light, -90, 90)) * Math.PI) / 180;
      const background = settings.background;
      const ink =
        background[3] > 0.02
          ? luminance(settings.color) < luminance(background)
          : luminance(settings.color) < 0.5;

      gl.useProgram(fieldProgram.program);
      bindPosition(fieldPositionLocation);
      gl.uniform2f(fieldUniforms.uSize, width, height);
      gl.uniform1f(fieldUniforms.uDpr, dpr);
      gl.uniform2f(fieldUniforms.uOrigin, originX, originY);
      gl.uniform2f(fieldUniforms.uPitch, pitchX, pitchY);
      gl.uniform1i(fieldUniforms.uWave, WAVES[settings.wave]);
      gl.uniform1f(fieldUniforms.uTime, time);
      gl.uniform1f(fieldUniforms.uUnit, WAVE_UNIT * clamp(settings.scale, 0.2, 5));
      gl.uniform2f(fieldUniforms.uHeading, Math.cos(heading), Math.sin(heading));
      gl.uniform1f(fieldUniforms.uAmp, amp);
      gl.uniform1f(fieldUniforms.uDepth, clamp(settings.depth, 0, 1.5));
      gl.uniform3f(
        fieldUniforms.uLight,
        Math.cos(lightAngle) * 0.78,
        Math.sin(lightAngle) * 0.78,
        0.62,
      );
      gl.uniform1f(fieldUniforms.uShine, clamp(settings.shine, 0, 2));
      gl.uniform1f(fieldUniforms.uContrast, clamp(settings.contrast, 0.3, 3));
      gl.uniform1f(fieldUniforms.uInk, ink ? 1 : 0);
      gl.uniform1f(fieldUniforms.uOpacity, clamp(settings.opacity, 0, 1));
      gl.uniform1i(fieldUniforms.uFade, FADES[settings.fade]);
      gl.uniform1f(fieldUniforms.uFadeSize, clamp(settings.fadeSize, 0.05, 1));
      gl.uniform1f(fieldUniforms.uAppear, appear);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ripple && rippleLive ? ripple.read.texture : blank);
      gl.uniform1f(fieldUniforms.uRipple, rippleLive ? 0.32 : 0);
      bindTarget(fieldTarget);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const tint = ink ? 0 : 1;
      const blend = ink ? 0.35 : 0.55;
      const accent = settings.color.map((channel) => channel + (tint - channel) * blend);

      gl.useProgram(markProgram.program);
      bindPosition(markPositionLocation);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTarget.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
      gl.uniform2f(markUniforms.uOrigin, originX, originY);
      gl.uniform2f(markUniforms.uPitch, pitchX, pitchY);
      gl.uniform2f(markUniforms.uGrid, cols, rows);
      gl.uniform1i(markUniforms.uPattern, patternIndex);
      gl.uniform1f(markUniforms.uMarkSize, clamp(settings.markSize, 0.05, 1));
      gl.uniform1f(
        markUniforms.uStroke,
        patternIndex === 3 ? 0.9 * dpr : Math.max(1.1 * dpr, pitchY * 0.08),
      );
      gl.uniform3f(markUniforms.uColor, settings.color[0], settings.color[1], settings.color[2]);
      gl.uniform3f(markUniforms.uAccent, accent[0] ?? 0, accent[1] ?? 0, accent[2] ?? 0);
      gl.uniform4f(
        markUniforms.uBackground,
        background[0],
        background[1],
        background[2],
        background[3],
      );
      gl.uniform3f(markUniforms.uAtlas, atlasColumns, atlasLines, atlasCount);
      bindTarget(null);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (visible && (moving || introClock < 1 || rippleActive)) {
        raf = requestAnimationFrame(frame);
      }
    };

    const locate = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      return { x, y, inside: x >= 0 && y >= 0 && x <= rect.width && y <= rect.height };
    };

    const onPointerMove = (event: PointerEvent) => {
      const spot = locate(event);
      pointer.x = spot.x;
      pointer.y = spot.y;
      if (spot.inside !== pointer.inside) pointer.placed = false;
      pointer.inside = spot.inside;
      if (spot.inside) start();
    };

    const onPointerDown = (event: PointerEvent) => {
      const spot = locate(event);
      if (!spot.inside) return;
      pointer.x = spot.x;
      pointer.y = spot.y;
      if (!pointer.inside) {
        pointer.lastX = spot.x;
        pointer.lastY = spot.y;
      }
      pointer.burst = 1.2;
      start();
    };

    const onPointerLeave = () => {
      pointer.inside = false;
      pointer.placed = false;
      start();
    };

    const onPointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) onPointerLeave();
    };

    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerType === "touch") onPointerLeave();
    };

    const onVisibility = () => {
      if (!document.hidden) start();
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });
    window.addEventListener("blur", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      start();
    });
    intersectionObserver.observe(container);

    wakeRef.current = () => {
      start();
    };
    resize();

    return () => {
      alive = false;
      visible = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerout", onPointerOut);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("blur", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      wakeRef.current = null;
      if (ripple) {
        disposeTarget(ripple.read);
        disposeTarget(ripple.write);
      }
      disposeTarget(fieldTarget);
      gl.deleteTexture(atlasTexture);
      gl.deleteTexture(blank);
      gl.deleteBuffer(vertexBuffer);
      fieldProgram.dispose();
      rippleProgram.dispose();
      markProgram.dispose();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
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
