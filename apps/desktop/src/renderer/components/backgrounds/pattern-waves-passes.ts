import {
  bindTarget,
  type MARK_UNIFORMS,
  type FIELD_UNIFORMS,
  type RenderTarget,
  type UniformLocations,
} from "./pattern-waves-gl.js";
import type { ResolvedSettings } from "./pattern-waves-presets.js";
import { clamp, FADES, luminance, PATTERNS, WAVES } from "./pattern-waves-settings.js";

const WAVE_UNIT = 520;
const PIXEL_BUDGET = 4.5e6;
const MAX_GRID = 4096;

export interface GridLayout {
  readonly dpr: number;
  readonly pitchX: number;
  readonly pitchY: number;
  readonly cols: number;
  readonly rows: number;
  readonly originX: number;
  readonly originY: number;
  readonly patternIndex: number;
}

export interface PassProgram<K extends string> {
  readonly program: WebGLProgram;
  readonly uniforms: UniformLocations<K>;
  readonly positionLocation: number;
}

export interface PassContext {
  readonly gl: WebGL2RenderingContext;
  readonly bindPosition: (location: number) => void;
}

export interface Animation {
  readonly time: number;
  readonly amp: number;
  readonly appear: number;
}

export function fitDevicePixelRatio(width: number, height: number): number {
  return Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (width * height)));
}

export function isInkOnLight(settings: ResolvedSettings): boolean {
  const background = settings.background;
  return background[3] > 0.02
    ? luminance(settings.color) < luminance(background)
    : luminance(settings.color) < 0.5;
}

export function computeGridLayout(
  gl: WebGL2RenderingContext,
  settings: ResolvedSettings,
  width: number,
): GridLayout {
  const patternIndex = PATTERNS[settings.pattern];
  const canvasWidth = gl.drawingBufferWidth;
  const canvasHeight = gl.drawingBufferHeight;
  const dpr = canvasWidth / width;
  const pitchY = Math.max(4, Math.round(clamp(settings.spacing, 4, 120) * dpr));
  const pitchX = patternIndex === 3 ? Math.max(2, Math.round(pitchY / 4)) : pitchY;
  const cols = Math.min(MAX_GRID, Math.ceil(canvasWidth / pitchX) + 1);
  const rows = Math.min(MAX_GRID, Math.ceil(canvasHeight / pitchY) + 2);
  const originX = Math.floor((canvasWidth - cols * pitchX) / 2);
  const originY = Math.floor((canvasHeight - rows * pitchY) / 2);
  return { dpr, pitchX, pitchY, cols, rows, originX, originY, patternIndex };
}

export interface FieldPassInput {
  readonly settings: ResolvedSettings;
  readonly layout: GridLayout;
  readonly animation: Animation;
  readonly ink: boolean;
  readonly width: number;
  readonly height: number;
  readonly rippleTexture: WebGLTexture | null;
  readonly blank: WebGLTexture | null;
  readonly target: RenderTarget;
}

export function drawFieldPass(
  context: PassContext,
  pass: PassProgram<(typeof FIELD_UNIFORMS)[number]>,
  input: FieldPassInput,
) {
  const { gl, bindPosition } = context;
  const { uniforms } = pass;
  const { settings, layout, animation, width, height } = input;
  const heading = (settings.direction * Math.PI) / 180;
  const lightAngle = ((settings.direction + 180 + clamp(settings.light, -90, 90)) * Math.PI) / 180;

  gl.useProgram(pass.program);
  bindPosition(pass.positionLocation);
  gl.uniform2f(uniforms.uSize, width, height);
  gl.uniform1f(uniforms.uDpr, layout.dpr);
  gl.uniform2f(uniforms.uOrigin, layout.originX, layout.originY);
  gl.uniform2f(uniforms.uPitch, layout.pitchX, layout.pitchY);
  gl.uniform1i(uniforms.uWave, WAVES[settings.wave]);
  gl.uniform1f(uniforms.uTime, animation.time);
  gl.uniform1f(uniforms.uUnit, WAVE_UNIT * clamp(settings.scale, 0.2, 5));
  gl.uniform2f(uniforms.uHeading, Math.cos(heading), Math.sin(heading));
  gl.uniform1f(uniforms.uAmp, animation.amp);
  gl.uniform1f(uniforms.uDepth, clamp(settings.depth, 0, 1.5));
  gl.uniform3f(uniforms.uLight, Math.cos(lightAngle) * 0.78, Math.sin(lightAngle) * 0.78, 0.62);
  gl.uniform1f(uniforms.uShine, clamp(settings.shine, 0, 2));
  gl.uniform1f(uniforms.uContrast, clamp(settings.contrast, 0.3, 3));
  gl.uniform1f(uniforms.uInk, input.ink ? 1 : 0);
  gl.uniform1f(uniforms.uOpacity, clamp(settings.opacity, 0, 1));
  gl.uniform1i(uniforms.uFade, FADES[settings.fade]);
  gl.uniform1f(uniforms.uFadeSize, clamp(settings.fadeSize, 0.05, 1));
  gl.uniform1f(uniforms.uAppear, animation.appear);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, input.rippleTexture ?? input.blank);
  gl.uniform1f(uniforms.uRipple, input.rippleTexture ? 0.32 : 0);
  bindTarget(gl, input.target);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

export interface MarkPassInput {
  readonly settings: ResolvedSettings;
  readonly layout: GridLayout;
  readonly ink: boolean;
  readonly fieldTexture: WebGLTexture;
  readonly atlasTexture: WebGLTexture | null;
  readonly atlas: { readonly columns: number; readonly lines: number; readonly count: number };
}

export function drawMarkPass(
  context: PassContext,
  pass: PassProgram<(typeof MARK_UNIFORMS)[number]>,
  input: MarkPassInput,
) {
  const { gl, bindPosition } = context;
  const { uniforms } = pass;
  const { settings, layout, atlas } = input;
  const background = settings.background;
  const tint = input.ink ? 0 : 1;
  const blend = input.ink ? 0.35 : 0.55;
  const accent = settings.color.map((channel) => channel + (tint - channel) * blend);

  gl.useProgram(pass.program);
  bindPosition(pass.positionLocation);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, input.fieldTexture);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, input.atlasTexture);
  gl.uniform2f(uniforms.uOrigin, layout.originX, layout.originY);
  gl.uniform2f(uniforms.uPitch, layout.pitchX, layout.pitchY);
  gl.uniform2f(uniforms.uGrid, layout.cols, layout.rows);
  gl.uniform1i(uniforms.uPattern, layout.patternIndex);
  gl.uniform1f(uniforms.uMarkSize, clamp(settings.markSize, 0.05, 1));
  gl.uniform1f(
    uniforms.uStroke,
    layout.patternIndex === 3 ? 0.9 * layout.dpr : Math.max(1.1 * layout.dpr, layout.pitchY * 0.08),
  );
  gl.uniform3f(uniforms.uColor, settings.color[0], settings.color[1], settings.color[2]);
  gl.uniform3f(uniforms.uAccent, accent[0] ?? 0, accent[1] ?? 0, accent[2] ?? 0);
  gl.uniform4f(uniforms.uBackground, background[0], background[1], background[2], background[3]);
  gl.uniform3f(uniforms.uAtlas, atlas.columns, atlas.lines, atlas.count);
  bindTarget(gl, null);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
