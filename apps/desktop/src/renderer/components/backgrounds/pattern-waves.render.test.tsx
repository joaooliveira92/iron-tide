import { createHash } from "node:crypto";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import PatternWaves, { type PatternWavesProps } from "./pattern-waves.js";

type Recorder = ReturnType<typeof createRecorder>;

function stable(value: unknown, ids: Map<object, number>): string {
  if (typeof value === "number") return String(Number(value.toFixed(6)));
  if (typeof value === "string") return JSON.stringify(value);
  if (value === null || value === undefined || typeof value === "boolean") return String(value);
  if (ArrayBuffer.isView(value)) {
    return `${value.constructor.name}[${Array.from(value as Float32Array | Uint8Array).join(",")}]`;
  }
  if (typeof value === "object") {
    let id = ids.get(value);
    if (id === undefined) {
      id = ids.size;
      ids.set(value, id);
    }
    return `obj#${id}`;
  }
  return typeof value;
}

function hashName(name: string): number {
  return createHash("sha1").update(name).digest().readUInt16BE(0) + 1;
}

function createRecorder(label: string) {
  const log: string[] = [];
  const ids = new Map<object, number>();
  const counters = new Map<string, number>();
  const next = (kind: string) => {
    const value = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, value);
    return value;
  };
  const record = (name: string, args: unknown[]) => {
    log.push(`${label}.${name}(${args.map((arg) => stable(arg, ids)).join(", ")})`);
  };
  const results: Record<string, (args: unknown[]) => unknown> = {
    createTexture: () => ({ texture: next("texture") }),
    createFramebuffer: () => ({ framebuffer: next("framebuffer") }),
    createBuffer: () => ({ buffer: next("buffer") }),
    createShader: () => ({ shader: next("shader") }),
    createProgram: () => ({ program: next("program") }),
    getAttribLocation: () => next("attrib"),
    getUniformLocation: (args) => ({ uniform: String(args[1]) }),
    getExtension: (args) => (args[0] === "EXT_color_buffer_float" ? {} : { loseContext: () => {} }),
    getShaderParameter: () => true,
    getProgramParameter: () => true,
    measureText: () => ({ width: 10 }),
  };
  const state: Record<string, unknown> = { drawingBufferWidth: 600, drawingBufferHeight: 300 };
  const context = new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== "string") return undefined;
        if (property in state) return state[property];
        if (property === "canvas") return undefined;
        if (/^[A-Z0-9_]+$/.test(property)) return hashName(property);
        return (...args: unknown[]) => {
          const shaped =
            property === "shaderSource"
              ? [args[0], `src:${String(args[1]).length}:${checksum(String(args[1]))}`]
              : args;
          record(property, shaped);
          return results[property]?.(args);
        };
      },
      set(_target, property, value) {
        if (typeof property === "string") {
          state[property] = value;
          log.push(`${label}.${property}=${stable(value, ids)}`);
        }
        return true;
      },
    },
  );
  return { context, log };
}

function checksum(text: string): string {
  return createHash("sha1").update(text).digest("hex").slice(0, 12);
}

function digest(recorder: Recorder) {
  const text = recorder.log.join("\n");
  const methods: Record<string, number> = {};
  for (const line of recorder.log) {
    const name = line.slice(0, line.indexOf("(") === -1 ? undefined : line.indexOf("("));
    methods[name] = (methods[name] ?? 0) + 1;
  }
  return { calls: recorder.log.length, sha: checksum(text), methods };
}

interface Harness {
  readonly gl: Recorder;
  readonly atlas: Recorder;
  readonly frames: (count: number, stepMs?: number) => void;
  readonly pointer: (type: string, x: number, y: number) => void;
}

let rafQueue = new Map<number, FrameRequestCallback>();
let rafId = 0;
let clock = 0;

function installEnvironment(): Harness {
  const gl = createRecorder("gl");
  const atlas = createRecorder("2d");
  rafQueue = new Map();
  rafId = 0;
  clock = 1000;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    rafId += 1;
    rafQueue.set(rafId, callback);
    return rafId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    rafQueue.delete(id);
  });
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(private readonly callback: IntersectionObserverCallback) {}
      observe(): void {
        this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
      }
      disconnect(): void {}
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 300 });
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300 }) as DOMRect;
  HTMLCanvasElement.prototype.getContext = function getContext(kind: string) {
    if (kind === "webgl2") return gl.context;
    if (kind === "2d") return atlas.context;
    return null;
  } as typeof HTMLCanvasElement.prototype.getContext;
  return {
    gl,
    atlas,
    frames(count, stepMs = 16) {
      for (let index = 0; index < count; index += 1) {
        clock += stepMs;
        const pending = [...rafQueue.entries()];
        rafQueue.clear();
        for (const [, callback] of pending) callback(clock);
      }
    },
    pointer(type, x, y) {
      const event = new Event(type, { bubbles: true }) as Event & Record<string, unknown>;
      event.clientX = x;
      event.clientY = y;
      event.pointerType = "mouse";
      event.relatedTarget = document.body;
      window.dispatchEvent(event);
    },
  };
}

function scenario(props: PatternWavesProps) {
  const harness = installEnvironment();
  const view = render(<PatternWaves {...props} />);
  harness.frames(3);
  harness.pointer("pointermove", 100, 80);
  harness.frames(2);
  harness.pointer("pointermove", 140, 90);
  harness.pointer("pointerdown", 140, 90);
  harness.frames(40);
  harness.pointer("pointerup", 140, 90);
  harness.frames(2);
  view.unmount();
  return { gl: digest(harness.gl), atlas: digest(harness.atlas) };
}

describe("PatternWaves render stream", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("mounts a canvas and releases every GL resource on unmount", () => {
    const harness = installEnvironment();
    const view = render(<PatternWaves />);
    expect(view.container.querySelector("canvas")).not.toBeNull();
    view.unmount();
    expect(document.querySelector("canvas")).toBeNull();
    const created = harness.gl.log.filter((line) =>
      /gl\.create(Texture|Buffer|Framebuffer)/.test(line),
    );
    const deleted = harness.gl.log.filter((line) =>
      /gl\.delete(Texture|Buffer|Framebuffer)/.test(line),
    );
    expect(deleted.length).toBe(created.length);
    expect(harness.gl.log.filter((line) => line.startsWith("gl.deleteProgram")).length).toBe(3);
  });

  it("renders the silk preset with a stable call stream", () => {
    expect(scenario({})).toMatchInlineSnapshot(`
      {
        "atlas": {
          "calls": 0,
          "methods": {},
          "sha": "da39a3ee5e6b",
        },
        "gl": {
          "calls": 3223,
          "methods": {
            "gl.activeTexture": 185,
            "gl.attachShader": 6,
            "gl.bindBuffer": 139,
            "gl.bindFramebuffer": 144,
            "gl.bindTexture": 189,
            "gl.bufferData": 1,
            "gl.clear": 94,
            "gl.clearColor": 1,
            "gl.compileShader": 6,
            "gl.createBuffer": 1,
            "gl.createFramebuffer": 4,
            "gl.createProgram": 3,
            "gl.createShader": 6,
            "gl.createTexture": 6,
            "gl.deleteBuffer": 1,
            "gl.deleteFramebuffer": 4,
            "gl.deleteProgram": 3,
            "gl.deleteShader": 6,
            "gl.deleteTexture": 6,
            "gl.disable": 2,
            "gl.drawArrays": 136,
            "gl.enableVertexAttribArray": 138,
            "gl.framebufferTexture2D": 4,
            "gl.generateMipmap": 1,
            "gl.getAttribLocation": 3,
            "gl.getExtension": 2,
            "gl.getProgramParameter": 3,
            "gl.getShaderParameter": 6,
            "gl.getUniformLocation": 40,
            "gl.linkProgram": 3,
            "gl.shaderSource": 6,
            "gl.texImage2D": 6,
            "gl.texParameteri": 24,
            "gl.uniform1f": 744,
            "gl.uniform1i": 145,
            "gl.uniform2f": 505,
            "gl.uniform3f": 188,
            "gl.uniform4f": 47,
            "gl.useProgram": 141,
            "gl.vertexAttribPointer": 138,
            "gl.viewport": 136,
          },
          "sha": "0772442d459d",
        },
      }
    `);
  });

  it("renders the ocean preset with ripples and no intro", () => {
    expect(scenario({ preset: "ocean", intro: false, cursorStrength: 1 })).toMatchInlineSnapshot(`
      {
        "atlas": {
          "calls": 0,
          "methods": {},
          "sha": "da39a3ee5e6b",
        },
        "gl": {
          "calls": 3223,
          "methods": {
            "gl.activeTexture": 185,
            "gl.attachShader": 6,
            "gl.bindBuffer": 139,
            "gl.bindFramebuffer": 144,
            "gl.bindTexture": 189,
            "gl.bufferData": 1,
            "gl.clear": 94,
            "gl.clearColor": 1,
            "gl.compileShader": 6,
            "gl.createBuffer": 1,
            "gl.createFramebuffer": 4,
            "gl.createProgram": 3,
            "gl.createShader": 6,
            "gl.createTexture": 6,
            "gl.deleteBuffer": 1,
            "gl.deleteFramebuffer": 4,
            "gl.deleteProgram": 3,
            "gl.deleteShader": 6,
            "gl.deleteTexture": 6,
            "gl.disable": 2,
            "gl.drawArrays": 136,
            "gl.enableVertexAttribArray": 138,
            "gl.framebufferTexture2D": 4,
            "gl.generateMipmap": 1,
            "gl.getAttribLocation": 3,
            "gl.getExtension": 2,
            "gl.getProgramParameter": 3,
            "gl.getShaderParameter": 6,
            "gl.getUniformLocation": 40,
            "gl.linkProgram": 3,
            "gl.shaderSource": 6,
            "gl.texImage2D": 6,
            "gl.texParameteri": 24,
            "gl.uniform1f": 744,
            "gl.uniform1i": 145,
            "gl.uniform2f": 505,
            "gl.uniform3f": 188,
            "gl.uniform4f": 47,
            "gl.useProgram": 141,
            "gl.vertexAttribPointer": 138,
            "gl.viewport": 136,
          },
          "sha": "4241815f368c",
        },
      }
    `);
  });

  it("renders a glyph pattern with the character atlas", () => {
    expect(scenario({ pattern: "glyph", characters: "AB#", fade: "bottom" }))
      .toMatchInlineSnapshot(`
      {
        "atlas": {
          "calls": 7,
          "methods": {
            "2d.fillStyle="#ffffff"": 1,
            "2d.fillText": 3,
            "2d.font="500 110px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"": 1,
            "2d.textAlign="center"": 1,
            "2d.textBaseline="middle"": 1,
          },
          "sha": "62b01c6cf0de",
        },
        "gl": {
          "calls": 3227,
          "methods": {
            "gl.activeTexture": 185,
            "gl.attachShader": 6,
            "gl.bindBuffer": 139,
            "gl.bindFramebuffer": 144,
            "gl.bindTexture": 190,
            "gl.bufferData": 1,
            "gl.clear": 94,
            "gl.clearColor": 1,
            "gl.compileShader": 6,
            "gl.createBuffer": 1,
            "gl.createFramebuffer": 4,
            "gl.createProgram": 3,
            "gl.createShader": 6,
            "gl.createTexture": 6,
            "gl.deleteBuffer": 1,
            "gl.deleteFramebuffer": 4,
            "gl.deleteProgram": 3,
            "gl.deleteShader": 6,
            "gl.deleteTexture": 6,
            "gl.disable": 2,
            "gl.drawArrays": 136,
            "gl.enableVertexAttribArray": 138,
            "gl.framebufferTexture2D": 4,
            "gl.generateMipmap": 2,
            "gl.getAttribLocation": 3,
            "gl.getExtension": 2,
            "gl.getProgramParameter": 3,
            "gl.getShaderParameter": 6,
            "gl.getUniformLocation": 40,
            "gl.linkProgram": 3,
            "gl.pixelStorei": 1,
            "gl.shaderSource": 6,
            "gl.texImage2D": 7,
            "gl.texParameteri": 24,
            "gl.uniform1f": 744,
            "gl.uniform1i": 145,
            "gl.uniform2f": 505,
            "gl.uniform3f": 188,
            "gl.uniform4f": 47,
            "gl.useProgram": 141,
            "gl.vertexAttribPointer": 138,
            "gl.viewport": 136,
          },
          "sha": "dd5f5cbbfc8a",
        },
      }
    `);
  });

  it("renders the line pattern on a paused light surface", () => {
    expect(
      scenario({ preset: "lines", paused: true, color: "#101010", backgroundColor: "#f0f0f0" }),
    ).toMatchInlineSnapshot(`
      {
        "atlas": {
          "calls": 0,
          "methods": {},
          "sha": "da39a3ee5e6b",
        },
        "gl": {
          "calls": 3223,
          "methods": {
            "gl.activeTexture": 185,
            "gl.attachShader": 6,
            "gl.bindBuffer": 139,
            "gl.bindFramebuffer": 144,
            "gl.bindTexture": 189,
            "gl.bufferData": 1,
            "gl.clear": 94,
            "gl.clearColor": 1,
            "gl.compileShader": 6,
            "gl.createBuffer": 1,
            "gl.createFramebuffer": 4,
            "gl.createProgram": 3,
            "gl.createShader": 6,
            "gl.createTexture": 6,
            "gl.deleteBuffer": 1,
            "gl.deleteFramebuffer": 4,
            "gl.deleteProgram": 3,
            "gl.deleteShader": 6,
            "gl.deleteTexture": 6,
            "gl.disable": 2,
            "gl.drawArrays": 136,
            "gl.enableVertexAttribArray": 138,
            "gl.framebufferTexture2D": 4,
            "gl.generateMipmap": 1,
            "gl.getAttribLocation": 3,
            "gl.getExtension": 2,
            "gl.getProgramParameter": 3,
            "gl.getShaderParameter": 6,
            "gl.getUniformLocation": 40,
            "gl.linkProgram": 3,
            "gl.shaderSource": 6,
            "gl.texImage2D": 6,
            "gl.texParameteri": 24,
            "gl.uniform1f": 744,
            "gl.uniform1i": 145,
            "gl.uniform2f": 505,
            "gl.uniform3f": 188,
            "gl.uniform4f": 47,
            "gl.useProgram": 141,
            "gl.vertexAttribPointer": 138,
            "gl.viewport": 136,
          },
          "sha": "c292c9407e59",
        },
      }
    `);
  });
});
