import { cleanup, render } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import Auralis from "./auralis.js";
import Cloudscape from "./cloudscape.js";
import LumaDrift from "./lumadrift.js";
import Nebulore from "./nebulore.js";
import PatternWaves from "./pattern-waves.js";
import { StarsBackground } from "./starts.js";

interface FakeResizeObserver {
  readonly target: Element | null;
  readonly disconnected: boolean;
}

interface Environment {
  readonly observers: FakeResizeObserver[];
  readonly liveObservers: () => FakeResizeObserver[];
  readonly pendingFrames: () => number;
  readonly runFrames: () => void;
  readonly contextRequests: string[];
  readonly windowListeners: (type: string) => number;
  readonly documentListeners: (type: string) => number;
}

function constantFor(name: string): number {
  let hash = 7;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) % 60000;
  return hash + 1;
}

function createFakeGl() {
  const cache = new Map<string, unknown>();
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (typeof property !== "string") return undefined;
        if (property === "getShaderParameter" || property === "getProgramParameter") {
          return () => true;
        }
        if (property === "checkFramebufferStatus") {
          return () => constantFor("FRAMEBUFFER_COMPLETE");
        }
        if (property === "getAttribLocation") return () => 0;
        if (property === "getExtension") return () => ({ loseContext: () => {} });
        if (property === "drawingBufferWidth" || property === "drawingBufferHeight") return 600;
        if (/^[A-Z0-9_]+$/.test(property)) return constantFor(property);
        let fn = cache.get(property);
        if (fn === undefined) {
          fn = () => ({ handle: property });
          cache.set(property, fn);
        }
        return fn;
      },
      set() {
        return true;
      },
    },
  );
}

function installEnvironment(): Environment {
  const observers: Array<FakeResizeObserver & { disconnected: boolean }> = [];
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const contextRequests: string[] = [];
  const windowCounts = new Map<string, number>();
  const documentCounts = new Map<string, number>();

  const countListeners = (target: EventTarget, counts: Map<string, number>) => {
    const add = target.addEventListener.bind(target);
    const remove = target.removeEventListener.bind(target);
    vi.spyOn(target, "addEventListener").mockImplementation((type, listener, options) => {
      counts.set(type, (counts.get(type) ?? 0) + 1);
      add(type, listener, options);
    });
    vi.spyOn(target, "removeEventListener").mockImplementation((type, listener, options) => {
      counts.set(type, (counts.get(type) ?? 0) - 1);
      remove(type, listener, options);
    });
  };
  countListeners(window, windowCounts);
  countListeners(document, documentCounts);

  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frameId += 1;
    frames.set(frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      target: Element | null = null;
      disconnected = false;
      constructor() {
        observers.push(this);
      }
      observe(target: Element): void {
        this.target = target;
      }
      unobserve(): void {}
      disconnect(): void {
        this.disconnected = true;
      }
    },
  );
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
  Object.defineProperty(HTMLElement.prototype, "clientWidth", { configurable: true, value: 600 });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, value: 300 });
  HTMLElement.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 600, height: 300, right: 600, bottom: 300 }) as DOMRect;
  const gl = createFakeGl();
  HTMLCanvasElement.prototype.getContext = function getContext(kind: string) {
    contextRequests.push(kind);
    return gl;
  } as typeof HTMLCanvasElement.prototype.getContext;

  return {
    observers,
    liveObservers: () => observers.filter((observer) => !observer.disconnected),
    pendingFrames: () => frames.size,
    runFrames: () => {
      const pending = [...frames.values()];
      frames.clear();
      for (const callback of pending) callback(performance.now());
    },
    contextRequests,
    windowListeners: (type) => windowCounts.get(type) ?? 0,
    documentListeners: (type) => documentCounts.get(type) ?? 0,
  };
}

interface CanvasCase {
  readonly name: string;
  readonly element: (speed: number) => ReactElement;
}

const canvasCases: readonly CanvasCase[] = [
  { name: "Auralis", element: (speed) => <Auralis speed={speed} /> },
  { name: "Cloudscape", element: (speed) => <Cloudscape speed={speed} /> },
  { name: "LumaDrift", element: (speed) => <LumaDrift speed={speed} /> },
  { name: "Nebulore", element: (speed) => <Nebulore speed={speed} /> },
];

let environment: Environment;

beforeEach(() => {
  environment = installEnvironment();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe.each(canvasCases)("$name background lifecycle", ({ element }) => {
  it("attaches a context, observer and animation frame on mount", () => {
    const view = render(element(1));

    const canvas = view.container.querySelector("canvas");
    expect(canvas).not.toBeNull();
    expect(environment.contextRequests).toHaveLength(1);
    expect(environment.liveObservers()).toHaveLength(1);
    expect(environment.liveObservers()[0]?.target).toBe(canvas?.parentElement);
    expect(environment.pendingFrames()).toBe(1);
  });

  it("releases the observer and the animation frame on unmount", () => {
    const view = render(element(1));
    view.unmount();

    expect(environment.liveObservers()).toHaveLength(0);
    expect(environment.pendingFrames()).toBe(0);
  });

  it("re-attaches exactly once when a prop changes", () => {
    const view = render(element(1));
    const firstCanvas = view.container.querySelector("canvas");
    view.rerender(element(2));

    expect(view.container.querySelector("canvas")).toBe(firstCanvas);
    expect(environment.contextRequests).toHaveLength(2);
    expect(environment.observers).toHaveLength(2);
    expect(environment.observers[0]?.disconnected).toBe(true);
    expect(environment.liveObservers()).toHaveLength(1);
    expect(environment.pendingFrames()).toBe(1);
  });

  it("keeps the attachment when props are unchanged", () => {
    const view = render(element(1));
    view.rerender(element(1));

    expect(environment.contextRequests).toHaveLength(1);
    expect(environment.observers).toHaveLength(1);
    expect(environment.liveObservers()).toHaveLength(1);
  });
});

describe("Auralis document and canvas listeners", () => {
  it("removes the visibility listener on unmount and re-adds it on prop change", () => {
    const view = render(<Auralis speed={1} />);
    expect(environment.documentListeners("visibilitychange")).toBe(1);

    view.rerender(<Auralis speed={2} />);
    expect(environment.documentListeners("visibilitychange")).toBe(1);

    view.unmount();
    expect(environment.documentListeners("visibilitychange")).toBe(0);
  });
});

describe("PatternWaves lifecycle", () => {
  it("mounts a canvas into the host and removes it on unmount", () => {
    const view = render(<PatternWaves />);
    const host = view.container.firstElementChild;

    expect(host?.querySelector("canvas")).not.toBeNull();
    expect(environment.liveObservers()).toHaveLength(1);

    view.unmount();
    expect(environment.liveObservers()).toHaveLength(0);
    expect(environment.pendingFrames()).toBe(0);
  });

  it("keeps one renderer across prop changes and wakes it with the new settings", () => {
    const view = render(<PatternWaves paused intro={false} />);
    const canvas = view.container.querySelector("canvas");
    environment.runFrames();
    environment.runFrames();
    expect(environment.pendingFrames()).toBe(0);

    view.rerender(<PatternWaves paused={false} intro={false} />);

    expect(view.container.querySelector("canvas")).toBe(canvas);
    expect(environment.observers).toHaveLength(1);
    expect(environment.pendingFrames()).toBe(1);
  });
});

describe("StarsBackground lifecycle", () => {
  it("tracks the pointer on window only while mounted and re-binds on factor change", () => {
    const view = render(<StarsBackground factor={0.05} />);
    expect(environment.windowListeners("mousemove")).toBe(1);

    view.rerender(<StarsBackground factor={0.1} />);
    expect(environment.windowListeners("mousemove")).toBe(1);

    view.unmount();
    expect(environment.windowListeners("mousemove")).toBe(0);
  });

  it("fills every star layer on first paint", () => {
    const view = render(<StarsBackground />);
    const shadows = [
      ...view.container.querySelectorAll<HTMLElement>('[data-slot="star-layer"] > div'),
    ]
      .map((node) => node.style.boxShadow)
      .filter((shadow) => shadow !== "");

    expect(shadows).toHaveLength(6);
  });
});
