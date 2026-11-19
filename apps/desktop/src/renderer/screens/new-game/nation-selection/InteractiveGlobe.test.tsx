import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PLAYABLE_SLOT_COUNTRY_IDS } from "@/content/nationAssetManifest.js";
import { InteractiveGlobe } from "./InteractiveGlobe.js";

interface ResizeRecord {
  readonly callback: ResizeObserverCallback;
  disconnected: boolean;
  observed: Element[];
}

interface IntersectionRecord {
  readonly callback: IntersectionObserverCallback;
  disconnected: boolean;
  observed: Element[];
}

const resizeObservers: ResizeRecord[] = [];
const intersectionObservers: IntersectionRecord[] = [];

class RecordingResizeObserver implements ResizeObserver {
  private readonly record: ResizeRecord;
  constructor(callback: ResizeObserverCallback) {
    this.record = { callback, disconnected: false, observed: [] };
    resizeObservers.push(this.record);
  }
  observe(target: Element): void {
    this.record.observed.push(target);
  }
  unobserve(): void {}
  disconnect(): void {
    this.record.disconnected = true;
  }
}

class RecordingIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly scrollMargin = "";
  readonly thresholds: readonly number[] = [];
  private readonly record: IntersectionRecord;
  constructor(callback: IntersectionObserverCallback) {
    this.record = { callback, disconnected: false, observed: [] };
    intersectionObservers.push(this.record);
  }
  observe(target: Element): void {
    this.record.observed.push(target);
  }
  unobserve(): void {}
  disconnect(): void {
    this.record.disconnected = true;
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

let clock = 1000;
let nextHandle = 1;
const pending = new Map<number, FrameRequestCallback>();

function stepFrame(ms: number): void {
  clock += ms;
  const due = [...pending.entries()];
  pending.clear();
  for (const [, callback] of due) callback(clock);
}

function advance(totalMs: number, stepMs = 50): void {
  act(() => {
    for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) stepFrame(stepMs);
  });
}

function pinDot(container: HTMLElement, countryId: string): { cx: number; cy: number } {
  const dot = container.querySelector(`g[data-country-id="${countryId}"] .pin-dot`);
  if (!dot) throw new Error(`no pin for ${countryId}`);
  return { cx: Number(dot.getAttribute("cx")), cy: Number(dot.getAttribute("cy")) };
}

function pinGroup(container: HTMLElement, countryId: string): Element {
  const group = container.querySelector(`g[data-country-id="${countryId}"]`);
  if (!group) throw new Error(`no pin for ${countryId}`);
  return group;
}

describe("interactive globe composition", () => {
  beforeEach(() => {
    clock = 1000;
    nextHandle = 1;
    pending.clear();
    resizeObservers.length = 0;
    intersectionObservers.length = 0;
    vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
    vi.stubGlobal("IntersectionObserver", RecordingIntersectionObserver);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback): number => {
      const handle = nextHandle++;
      pending.set(handle, callback);
      return handle;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number): void => {
      pending.delete(handle);
    });
    vi.spyOn(performance, "now").mockImplementation(() => clock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
  });

  it("draws the ocean, the land and one pin per playable nation on the first frames", () => {
    const { container } = render(<InteractiveGlobe />);
    advance(100);

    const ocean = container.querySelector("circle[fill^='url']");
    expect(Number(ocean?.getAttribute("r"))).toBeCloseTo(600 * 0.42, 5);
    expect(Number(ocean?.getAttribute("cx"))).toBe(400);
    expect(
      container.querySelectorAll("g[fill='var(--globe-land-fill)'] path").length,
    ).toBeGreaterThan(50);
    expect(container.querySelectorAll("g.svg-globe-pin").length).toBe(
      PLAYABLE_SLOT_COUNTRY_IDS.length,
    );
    expect(container.querySelector("rect.svg-globe-ring")).toBeNull();
    expect(resizeObservers.length).toBe(1);
    expect(intersectionObservers.length).toBe(1);
  });

  it("reports the clicked pin through the latest handler", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { container, rerender } = render(<InteractiveGlobe onNationClick={first} />);
    advance(100);
    rerender(<InteractiveGlobe onNationClick={second} />);

    fireEvent.click(pinGroup(container, "gb").querySelector(".pin-dot") as Element);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("gb");
  });

  it("spins the focused nation to the centre on mount and again when focus changes", () => {
    const { container, rerender } = render(<InteractiveGlobe focusedCountryId="gb" />);
    advance(100);
    const before = pinDot(container, "gb");
    expect(Math.abs(before.cx - 400)).toBeGreaterThan(20);
    expect(container.querySelector("rect.svg-globe-ring")).not.toBeNull();

    advance(1100);
    const landed = pinDot(container, "gb");
    expect(Math.abs(landed.cx - 400)).toBeLessThan(3);
    expect(Math.abs(landed.cy - 300)).toBeLessThan(3);

    rerender(<InteractiveGlobe focusedCountryId="es" />);
    advance(1100);
    const next = pinDot(container, "es");
    expect(Math.abs(next.cx - 400)).toBeLessThan(3);
    expect(Math.abs(next.cy - 300)).toBeLessThan(3);
    expect(container.querySelectorAll("rect.svg-globe-ring").length).toBe(1);
  });

  it("keeps the globe still when no nation is focused until it auto-rotates", () => {
    const { container } = render(<InteractiveGlobe focusedCountryId={null} />);
    advance(100);
    const first = pinDot(container, "gb");
    advance(2000);
    const later = pinDot(container, "gb");
    expect(later.cx).not.toBe(first.cx);
  });

  it("re-fits the globe to the container when it is resized", () => {
    const { container } = render(<InteractiveGlobe />);
    advance(100);

    const resizeTo = (width: number, height: number): void => {
      act(() => {
        resizeObservers[0]?.callback(
          [
            {
              contentRect: { width, height },
            } as Partial<ResizeObserverEntry> as ResizeObserverEntry,
          ],
          resizeObservers[0] as Partial<ResizeObserver> as ResizeObserver,
        );
      });
      advance(100);
    };
    const ocean = container.querySelector("circle[fill^='url']");

    resizeTo(1000, 500);
    expect(Number(ocean?.getAttribute("cx"))).toBe(500);
    expect(Number(ocean?.getAttribute("cy"))).toBe(250);
    expect(Number(ocean?.getAttribute("r"))).toBeCloseTo(600 * 0.42, 5);

    resizeTo(1600, 1200);
    expect(Number(ocean?.getAttribute("cx"))).toBe(800);
    expect(Number(ocean?.getAttribute("r"))).toBeCloseTo(1200 * 0.42, 5);
  });

  it("stops drawing while the page is hidden or the globe is off screen, and resumes after", () => {
    const { container } = render(<InteractiveGlobe />);
    advance(100);
    const drawn = pinDot(container, "gb");

    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(pending.size).toBe(0);
    advance(500);
    expect(pinDot(container, "gb")).toEqual(drawn);

    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(pending.size).toBe(1);
    advance(500);
    expect(pinDot(container, "gb")).not.toEqual(drawn);

    act(() => {
      intersectionObservers[0]?.callback(
        [
          {
            isIntersecting: false,
          } as Partial<IntersectionObserverEntry> as IntersectionObserverEntry,
        ],
        intersectionObservers[0] as Partial<IntersectionObserver> as IntersectionObserver,
      );
    });
    expect(pending.size).toBe(0);
  });

  it("releases the frame loop, the observers and the visibility listener on unmount", () => {
    const removeListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<InteractiveGlobe focusedCountryId="gb" />);
    advance(100);
    expect(pending.size).toBe(1);

    unmount();

    expect(pending.size).toBe(0);
    expect(resizeObservers[0]?.disconnected).toBe(true);
    expect(intersectionObservers[0]?.disconnected).toBe(true);
    expect(removeListener.mock.calls.some(([type]) => type === "visibilitychange")).toBe(true);
  });
});
