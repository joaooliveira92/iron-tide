import { buildAtlas } from "./pattern-waves-atlas.js";
import { fieldFragmentGLSL } from "./pattern-waves-field-shader.js";
import {
  bindTarget,
  createAtlasTexture,
  createBlankTexture,
  createPositionBinder,
  createTarget,
  disposeTarget,
  FIELD_UNIFORMS,
  lookupUniforms,
  MARK_UNIFORMS,
  RIPPLE_UNIFORMS,
} from "./pattern-waves-gl.js";
import { bindPointerInput, createPointerState } from "./pattern-waves-input.js";
import {
  markFragmentGLSL,
  rippleFragmentGLSL,
  vertexShaderGLSL,
} from "./pattern-waves-mark-shaders.js";
import {
  computeGridLayout,
  drawFieldPass,
  drawMarkPass,
  fitDevicePixelRatio,
  isInkOnLight,
  type PassContext,
} from "./pattern-waves-passes.js";
import type { ResolvedSettings } from "./pattern-waves-presets.js";
import { createRippleSimulation } from "./pattern-waves-ripple.js";
import { clamp } from "./pattern-waves-settings.js";
import { createShaderProgram } from "./shader-program.js";

const INTRO_SECONDS = 2;

export interface PatternWavesRenderer {
  wake(): void;
  dispose(): void;
}

export function createPatternWavesRenderer(
  container: HTMLElement,
  readSettings: () => ResolvedSettings | null,
): PatternWavesRenderer | null {
  const canvas = document.createElement("canvas");
  const gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
  });
  if (!gl) return null;

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
    return null;
  }

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const fieldPositionLocation = gl.getAttribLocation(fieldProgram.program, "position");
  const ripplePositionLocation = gl.getAttribLocation(rippleProgram.program, "position");
  const markPositionLocation = gl.getAttribLocation(markProgram.program, "position");

  const blank = createBlankTexture(gl);
  const atlasTexture = createAtlasTexture(gl);

  const fieldUniforms = lookupUniforms(gl, fieldProgram.program, FIELD_UNIFORMS);
  const rippleUniforms = lookupUniforms(gl, rippleProgram.program, RIPPLE_UNIFORMS);
  const markUniforms = lookupUniforms(gl, markProgram.program, MARK_UNIFORMS);

  gl.useProgram(fieldProgram.program);
  gl.uniform1i(fieldUniforms.tRipple, 0);
  gl.useProgram(rippleProgram.program);
  gl.uniform1i(rippleUniforms.tState, 0);
  gl.useProgram(markProgram.program);
  gl.uniform1i(markUniforms.tField, 0);
  gl.uniform1i(markUniforms.tAtlas, 1);

  const bindPosition = createPositionBinder(gl, vertexBuffer);
  const passContext: PassContext = { gl, bindPosition };

  const floatTargets = !!gl.getExtension("EXT_color_buffer_float");
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const ripple = createRippleSimulation({
    gl,
    program: rippleProgram.program,
    uniforms: rippleUniforms,
    positionLocation: ripplePositionLocation,
    bindPosition,
    floatTargets,
  });
  let fieldTarget = createTarget(gl, 1, 1, false);
  const atlas = { key: "", columns: 1, lines: 1, count: 0 };

  let width = 1;
  let height = 1;
  let raf = 0;
  let last = performance.now();
  let time = 0;
  let introClock = 0;
  let visible = true;
  let alive = true;
  const pointer = createPointerState();

  const refreshAtlas = (settings: ResolvedSettings) => {
    if (settings.characters === atlas.key) return;
    atlas.key = settings.characters;
    const built = buildAtlas(settings.characters);
    if (!built) return;
    gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, built.canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    atlas.columns = built.columns;
    atlas.lines = built.lines;
    atlas.count = built.count;
  };

  const start = () => {
    if (raf || !visible || !alive) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    const dpr = fitDevicePixelRatio(width, height);
    const pixelWidth = Math.max(1, Math.floor(width * dpr));
    const pixelHeight = Math.max(1, Math.floor(height * dpr));
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
    ripple.resize(width, height);
    start();
  };

  const frame = (now: number) => {
    raf = 0;
    if (!alive) return;
    const settings = readSettings();
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

    const rippleActive = ripple.update({
      settings,
      pointer,
      now,
      dt,
      width,
      height,
      reducedMotion,
    });

    if (settings.pattern === "glyph") refreshAtlas(settings);

    const layout = computeGridLayout(gl, settings, width);
    if (fieldTarget.width !== layout.cols || fieldTarget.height !== layout.rows) {
      disposeTarget(gl, fieldTarget);
      fieldTarget = createTarget(gl, layout.cols, layout.rows, false);
    }

    const ink = isInkOnLight(settings);
    drawFieldPass(
      passContext,
      {
        program: fieldProgram.program,
        uniforms: fieldUniforms,
        positionLocation: fieldPositionLocation,
      },
      {
        settings,
        layout,
        animation: { time, amp, appear },
        ink,
        width,
        height,
        rippleTexture: ripple.texture(),
        blank,
        target: fieldTarget,
      },
    );
    drawMarkPass(
      passContext,
      {
        program: markProgram.program,
        uniforms: markUniforms,
        positionLocation: markPositionLocation,
      },
      { settings, layout, ink, fieldTexture: fieldTarget.texture, atlasTexture, atlas },
    );

    if (visible && (moving || introClock < 1 || rippleActive)) {
      raf = requestAnimationFrame(frame);
    }
  };

  const unbindPointer = bindPointerInput(container, pointer, start);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry?.isIntersecting ?? true;
    start();
  });
  intersectionObserver.observe(container);

  resize();

  return {
    wake: start,
    dispose() {
      alive = false;
      visible = false;
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      unbindPointer();
      ripple.dispose();
      disposeTarget(gl, fieldTarget);
      gl.deleteTexture(atlasTexture);
      gl.deleteTexture(blank);
      gl.deleteBuffer(vertexBuffer);
      fieldProgram.dispose();
      rippleProgram.dispose();
      markProgram.dispose();
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
}
