"use client";

import { useEffect, useRef } from "react";
import { cn } from "../../lib/utils.js";
import { AURALIS_PALETTE } from "../../shell/background-palettes.js";
import { hexToNormalizedRgb } from "./shader-color.js";
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

uniform vec2  u_resolution;
uniform float u_time;
uniform float u_grain;
uniform vec3  u_colorBack;
uniform vec3  u_colors[3];

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = vUv;
  float ratio = u_resolution.x / u_resolution.y;
  vec2 p = uv * vec2(ratio, 1.0);
  float t = u_time * 0.2;

  float n1 = snoise(p * 0.5 + t);
  float n2 = snoise(p * 0.9 - t * 0.5 + n1);

  float light = pow(abs(n2), 2.5) * 0.5;

  vec3 col = u_colorBack;

  col += u_colors[0] * smoothstep(0.1, 1.0, n1) * 0.5;
  col += u_colors[1] * light;

  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453 + u_time);
  col += (grain - 0.5) * u_grain * 0.5;

  float dist = length(uv - 0.5);
  col *= smoothstep(1.2, 0.2, dist);

  gl_FragColor = vec4(col, 1.0);
}
`;

export interface AuralisProps {
  colors?: readonly string[];
  colorBack?: string;
  speed?: number;
  grain?: number;
  height?: string;
  className?: string;
}

const DEFAULT_COLORS = AURALIS_PALETTE.dark.colors;
const DEFAULT_COLOR_BACK = AURALIS_PALETTE.dark.colorBack;

const Auralis = ({
  colors = DEFAULT_COLORS,
  colorBack = DEFAULT_COLOR_BACK,
  speed = 0.3,
  grain = 0.6,
  height = "100vh",
  className,
}: AuralisProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const gl = canvas.getContext("webgl", { antialias: true });
    if (!gl) return;

    const colorsVector = new Float32Array(
      colors
        .slice(0, 3)
        .flatMap((color, index) =>
          hexToNormalizedRgb(color, DEFAULT_COLORS[index] ?? DEFAULT_COLORS[0] ?? color),
        ),
    );
    const colorBackVector = new Float32Array(hexToNormalizedRgb(colorBack, DEFAULT_COLOR_BACK));
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    interface Uniforms {
      resolution: WebGLUniformLocation | null;
      time: WebGLUniformLocation | null;
      grain: WebGLUniformLocation | null;
      colorBack: WebGLUniformLocation | null;
      colors: WebGLUniformLocation | null;
    }

    let program: ShaderProgram | null = null;
    let buffer: WebGLBuffer | null = null;
    let uniforms: Uniforms | null = null;
    let frameId = 0;

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

      program = shaderProgram;
      buffer = nextBuffer;
      uniforms = {
        resolution: gl.getUniformLocation(shaderProgram.program, "u_resolution"),
        time: gl.getUniformLocation(shaderProgram.program, "u_time"),
        grain: gl.getUniformLocation(shaderProgram.program, "u_grain"),
        colorBack: gl.getUniformLocation(shaderProgram.program, "u_colorBack"),
        colors: gl.getUniformLocation(shaderProgram.program, "u_colors"),
      };
      return true;
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5);
      canvas.width = Math.max(1, Math.floor(container.clientWidth * dpr));
      canvas.height = Math.max(1, Math.floor(container.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const draw = (timeSeconds: number) => {
      if (program === null || uniforms === null) return;
      gl.useProgram(program.program);
      gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, timeSeconds);
      gl.uniform1f(uniforms.grain, grain);
      gl.uniform3fv(uniforms.colorBack, colorBackVector);
      gl.uniform3fv(uniforms.colors, colorsVector);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const frame = (now: number) => {
      frameId = 0;
      if (document.hidden || program === null) return;
      draw(now * 0.001 * speed);
      frameId = requestAnimationFrame(frame);
    };

    const start = () => {
      if (frameId !== 0 || document.hidden || program === null) return;
      if (reducedMotion) {
        draw(0);
        return;
      }
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
    resizeObserver.observe(container);
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
      // Deliberately do NOT lose the context here: this cleanup also runs when the palette changes
      // on a theme switch, and a lost context is never restored, so the rebuilt program would fail
      // to compile and the backdrop would vanish. Guarded by e2e/backgrounds.spec.ts.
    };
  }, [colors, colorBack, speed, grain]);

  return (
    <div
      ref={containerRef}
      style={{ height, backgroundColor: colorBack }}
      className={cn("relative w-full overflow-hidden", className)}
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div className="relative z-10 flex h-full w-full flex-col items-center justify-center" />
    </div>
  );
};

export default Auralis;
