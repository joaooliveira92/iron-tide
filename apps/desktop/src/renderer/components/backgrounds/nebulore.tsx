"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "../../lib/utils.js";
import { NEBULORE_PALETTE } from "../../shell/background-palettes.js";
import { fragmentShaderGLSL, vertexShaderGLSL } from "./nebulore-shaders.js";
import { hexToNormalizedRgb, normalizeHexColor } from "./shader-color.js";
import { createShaderProgram, type ShaderProgram } from "./shader-program.js";

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
