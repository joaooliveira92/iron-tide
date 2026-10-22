"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "../../lib/utils.js";
import { NEBULORE_PALETTE } from "../../shell/background-palettes.js";
import { hexToNormalizedRgb, normalizeHexColor } from "./shader-color.js";
import { createShaderProgram, type ShaderProgram } from "./shader-program.js";

const vertexShaderGLSL = `
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragmentShaderGLSL = `
precision highp float;

varying vec2 vUv;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_grain;
uniform vec3 u_colorBack;
uniform vec3 u_colors[3];

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rot = mat2(0.87, 0.48, -0.48, 0.87);

  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(p);
    p = rot * p * 2.05;
    amplitude *= 0.5;
  }

  return value;
}

void main() {
  vec2 uv = vUv;
  float ratio = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(ratio, 1.0);
  float t = u_time * u_speed;

  vec2 warp = vec2(
    fbm(p * 1.4 + vec2(t * 0.08, t * 0.04)),
    fbm(p * 1.4 + vec2(-t * 0.06, t * 0.05) + 4.2)
  );
  vec2 q = p + warp * 0.35;

  float ribbonA = abs(snoise(vec2(q.x * 1.8 + t * 0.12, q.y * 2.4 - t * 0.08)));
  float ribbonB = abs(snoise(vec2(q.x * 2.6 - t * 0.1, q.y * 1.6 + t * 0.06 + ribbonA)));
  float nebula = pow(1.0 - smoothstep(0.0, 0.55, ribbonA + ribbonB * 0.6), 2.2);

  float drift = fbm(p * 0.9 + vec2(t * 0.05, -t * 0.03));
  nebula *= smoothstep(-0.4, 0.8, drift + 0.2);
  nebula *= smoothstep(0.05, 0.55, uv.y) * smoothstep(1.0, 0.35, uv.y);

  vec3 col = u_colorBack;
  col = mix(col, u_colors[0], smoothstep(-0.2, 0.9, drift) * 0.35);
  col = mix(col, u_colors[1], nebula * 0.85);
  col += u_colors[2] * pow(nebula, 3.5) * 0.75;

  float vignette = smoothstep(1.15, 0.25, length(uv - 0.5));
  col *= vignette;

  float grain = fract(sin(dot(uv * u_resolution, vec2(12.9898, 78.233)) + u_time * 60.0) * 43758.5453);
  col += (grain - 0.5) * u_grain * 0.04;

  gl_FragColor = vec4(col, 1.0);
}
`;

interface NebuloreProps extends React.HTMLAttributes<HTMLDivElement> {
  colors?: readonly string[];
  colorBack?: string;
  speed?: number;
  grain?: number;
  height?: string;
}

const DEFAULT_COLORS = NEBULORE_PALETTE.dark.colors;
const DEFAULT_COLOR_BACK = NEBULORE_PALETTE.dark.colorBack;

const Nebulore = ({
  colors = DEFAULT_COLORS,
  colorBack = DEFAULT_COLOR_BACK,
  speed = 0.6,
  grain = 0.5,
  height = "100vh",
  className,
  style,
  ...props
}: NebuloreProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);

  const settings = useMemo(
    () => ({
      colors: colors
        .slice(0, 3)
        .map((color, index) =>
          normalizeHexColor(color, DEFAULT_COLORS[index] ?? DEFAULT_COLORS[0] ?? color),
        ),
      colorBack,
      speed,
      grain,
    }),
    [colors, colorBack, speed, grain],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) {
      return;
    }

    const gl = canvas.getContext("webgl", { antialias: true, alpha: true });
    if (!gl) {
      return;
    }

    const colorBackVector = new Float32Array(
      hexToNormalizedRgb(settings.colorBack, DEFAULT_COLOR_BACK),
    );
    const colorsVector = new Float32Array(
      settings.colors.flatMap((color) => hexToNormalizedRgb(color, DEFAULT_COLORS[0] ?? color)),
    );
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    interface Uniforms {
      resolution: WebGLUniformLocation;
      time: WebGLUniformLocation;
      speed: WebGLUniformLocation;
      grain: WebGLUniformLocation;
      colorBack: WebGLUniformLocation;
      colors: WebGLUniformLocation;
    }

    let program: ShaderProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let uniforms: Uniforms | null = null;
    let frameId = 0;
    let startedAt = 0;

    const destroyResources = () => {
      if (buffer !== null) {
        gl.deleteBuffer(buffer);
        buffer = null;
      }
      program?.dispose();
      program = null;
      uniforms = null;
    };

    const buildResources = () => {
      const shaderProgram = createShaderProgram(gl, vertexShaderGLSL, fragmentShaderGLSL);
      if (shaderProgram === null) return false;

      const nextBuffer = gl.createBuffer();
      if (nextBuffer === null) {
        shaderProgram.dispose();
        return false;
      }

      gl.useProgram(shaderProgram.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, nextBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
        gl.STATIC_DRAW,
      );
      const position = gl.getAttribLocation(shaderProgram.program, "position");
      if (position < 0) {
        gl.deleteBuffer(nextBuffer);
        shaderProgram.dispose();
        return false;
      }
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      const resolution = gl.getUniformLocation(shaderProgram.program, "u_resolution");
      const time = gl.getUniformLocation(shaderProgram.program, "u_time");
      const speed = gl.getUniformLocation(shaderProgram.program, "u_speed");
      const grain = gl.getUniformLocation(shaderProgram.program, "u_grain");
      const colorBack = gl.getUniformLocation(shaderProgram.program, "u_colorBack");
      const colors = gl.getUniformLocation(shaderProgram.program, "u_colors");
      if (
        resolution === null ||
        time === null ||
        speed === null ||
        grain === null ||
        colorBack === null ||
        colors === null
      ) {
        gl.deleteBuffer(nextBuffer);
        shaderProgram.dispose();
        return false;
      }

      program = shaderProgram;
      buffer = nextBuffer;
      uniforms = { resolution, time, speed, grain, colorBack, colors };
      return true;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { width, height } = host.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
      if (uniforms !== null) gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    };

    const draw = (elapsedSec: number) => {
      if (program === null || uniforms === null) return;
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uniforms.time, elapsedSec);
      gl.uniform1f(uniforms.speed, settings.speed);
      gl.uniform1f(uniforms.grain, settings.grain);
      gl.uniform3fv(uniforms.colorBack, colorBackVector);
      gl.uniform3fv(uniforms.colors, colorsVector);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const frame = (now: number) => {
      frameId = 0;
      if (document.hidden || program === null) return;
      draw((now - startedAt) / 1000);
      frameId = requestAnimationFrame(frame);
    };

    const start = () => {
      if (frameId !== 0 || document.hidden || program === null) return;
      if (reducedMotion) {
        draw(0);
        return;
      }
      startedAt = performance.now();
      frameId = requestAnimationFrame(frame);
    };

    const stop = () => {
      if (frameId === 0) return;
      cancelAnimationFrame(frameId);
      frameId = 0;
    };

    const handleVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      stop();
      destroyResources();
    };

    const handleContextRestored = () => {
      if (!buildResources()) return;
      resize();
      start();
    };

    const resizeObserver = new ResizeObserver(() => {
      resize();
      start();
    });
    resizeObserver.observe(host);
    document.addEventListener("visibilitychange", handleVisibility);
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    if (buildResources()) {
      resize();
      start();
    }

    return () => {
      stop();
      resizeObserver.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      destroyResources();
    };
  }, [settings]);

  return (
    <div
      ref={hostRef}
      className={cn("relative flex w-full items-center overflow-hidden", className)}
      style={{ height, backgroundColor: settings.colorBack, containerType: "size", ...style }}
      {...props}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </div>
  );
};

export default Nebulore;
