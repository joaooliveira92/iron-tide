import {
  bindTarget,
  createTarget,
  disposeTarget,
  type RippleField,
  type UniformLocations,
  type RIPPLE_UNIFORMS,
} from "./pattern-waves-gl.js";
import type { PointerState } from "./pattern-waves-input.js";
import type { ResolvedSettings } from "./pattern-waves-presets.js";
import { clamp } from "./pattern-waves-settings.js";

const RIPPLE_CELL = 8;
const RIPPLE_RATE = 60;
const RIPPLE_IDLE_MS = 5000;

export interface RippleUpdate {
  readonly settings: ResolvedSettings;
  readonly pointer: PointerState;
  readonly now: number;
  readonly dt: number;
  readonly width: number;
  readonly height: number;
  readonly reducedMotion: boolean;
}

export interface RippleSimulation {
  resize(width: number, height: number): void;
  update(input: RippleUpdate): boolean;
  texture(): WebGLTexture | null;
  isLive(): boolean;
  dispose(): void;
}

export interface RippleSimulationOptions {
  readonly gl: WebGL2RenderingContext;
  readonly program: WebGLProgram;
  readonly uniforms: UniformLocations<(typeof RIPPLE_UNIFORMS)[number]>;
  readonly positionLocation: number;
  readonly bindPosition: (location: number) => void;
  readonly floatTargets: boolean;
}

export function createRippleSimulation(options: RippleSimulationOptions): RippleSimulation {
  const { gl, program, uniforms, positionLocation, bindPosition, floatTargets } = options;
  let ripple: RippleField | null = null;
  let live = false;
  let clock = 0;
  let until = 0;

  const resize = (width: number, height: number) => {
    if (!floatTargets) return;
    const rippleWidth = clamp(Math.ceil(width / RIPPLE_CELL), 4, 512);
    const rippleHeight = clamp(Math.ceil(height / RIPPLE_CELL), 4, 512);
    if (ripple && ripple.width === rippleWidth && ripple.height === rippleHeight) return;
    if (ripple) {
      disposeTarget(gl, ripple.read);
      disposeTarget(gl, ripple.write);
    }
    ripple = {
      width: rippleWidth,
      height: rippleHeight,
      read: createTarget(gl, rippleWidth, rippleHeight, true),
      write: createTarget(gl, rippleWidth, rippleHeight, true),
    };
    live = false;
  };

  const clear = () => {
    if (!ripple) return;
    for (const target of [ripple.read, ripple.write]) {
      bindTarget(gl, target);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    bindTarget(gl, null);
  };

  const step = (field: RippleField, input: RippleUpdate) => {
    const { settings, pointer, width, height, dt } = input;
    clock = Math.min(clock + dt * RIPPLE_RATE, 4);
    const strength = clamp(settings.cursorStrength, 0, 1);
    const moved = Math.hypot(pointer.x - pointer.lastX, pointer.y - pointer.lastY);
    let impulse =
      (pointer.inside ? Math.min(moved / 14, 1) * 0.35 * strength : 0) + pointer.burst * strength;
    pointer.burst = 0;

    gl.useProgram(program);
    bindPosition(positionLocation);
    gl.uniform2f(uniforms.uTexel, 1 / field.width, 1 / field.height);
    gl.uniform2f(uniforms.uSize, width, height);
    gl.uniform2f(uniforms.uFrom, pointer.lastX, height - pointer.lastY);
    gl.uniform2f(uniforms.uTo, pointer.x, height - pointer.y);
    gl.uniform1f(uniforms.uRadius, clamp(settings.cursorSize, 8, 400));

    gl.activeTexture(gl.TEXTURE0);
    while (clock >= 1) {
      clock -= 1;
      gl.bindTexture(gl.TEXTURE_2D, field.read.texture);
      gl.uniform1f(uniforms.uImpulse, impulse);
      bindTarget(gl, field.write);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const next = field.read;
      field.read = field.write;
      field.write = next;
      impulse = 0;
    }

    pointer.lastX = pointer.x;
    pointer.lastY = pointer.y;
  };

  const update = (input: RippleUpdate) => {
    const { settings, pointer, now } = input;
    const rippling =
      settings.interactive && !input.reducedMotion && !!ripple && settings.cursorStrength > 0;
    if (rippling && pointer.inside && !pointer.placed) {
      pointer.lastX = pointer.x;
      pointer.lastY = pointer.y;
      pointer.placed = true;
    }
    if (rippling && (pointer.inside || pointer.burst > 0)) until = now + RIPPLE_IDLE_MS;
    const active = rippling && now < until;
    if (active && ripple) {
      step(ripple, input);
      live = true;
    } else if (live) {
      clear();
      live = false;
    }
    return active;
  };

  return {
    resize,
    update,
    texture: () => (ripple && live ? ripple.read.texture : null),
    isLive: () => live,
    dispose() {
      if (!ripple) return;
      disposeTarget(gl, ripple.read);
      disposeTarget(gl, ripple.write);
    },
  };
}
