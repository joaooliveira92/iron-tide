/* @vitest-environment jsdom */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";

import { AppFrame } from "./AppFrame.js";
import type { Screen } from "./campaign-screen-registry.js";

vi.mock("./BottomNav.js", () => ({ BottomNav: () => <nav /> }));
vi.mock("./StatusStrip.js", () => ({ StatusStrip: () => <section /> }));

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  readonly observed = new Set<Element>();
  disconnected = false;

  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }

  observe(target: Element): void {
    this.observed.add(target);
  }

  unobserve(target: Element): void {
    this.observed.delete(target);
  }

  disconnect(): void {
    this.disconnected = true;
    this.observed.clear();
  }

  fire(): void {
    this.callback();
  }
}

const heights = new Map<string, number>();

function frameOf(container: HTMLElement): HTMLElement {
  const frame = container.firstElementChild;
  if (!(frame instanceof HTMLElement)) throw new Error("frame missing");
  return frame;
}

function renderFrame(sessionId: string | null, screen: Screen) {
  const element = (id: string | null, name: Screen) => (
    <AppFrame
      campaignSessionId={id}
      campaignReads={null}
      screen={name}
      saveMessage={null}
      header={<header />}
      onSelectScreen={() => {}}
    >
      <p>content</p>
    </AppFrame>
  );
  const view = render(element(sessionId, screen));
  return {
    ...view,
    update: (id: string | null, name: Screen) => view.rerender(element(id, name)),
  };
}

describe("AppFrame chrome measurement", () => {
  beforeEach(() => {
    FakeResizeObserver.instances = [];
    heights.clear();
    heights.set("true", 0);
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    window.matchMedia = (query) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as MediaQueryList;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.className.includes("z-20") ? 48 : this.className.includes("z-[45]") ? 64 : 0;
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("publishes the top and bottom chrome heights and observes both bars", () => {
    const view = renderFrame("s1", "overview");
    const frame = frameOf(view.container);
    expect(frame.style.getPropertyValue("--chrome-top")).toBe("48px");
    expect(frame.style.getPropertyValue("--chrome-bottom")).toBe("64px");
    const [observer] = FakeResizeObserver.instances;
    expect(observer?.observed.size).toBe(2);
  });

  it("re-measures when the observed bars resize", () => {
    const view = renderFrame("s1", "overview");
    const frame = frameOf(view.container);
    const [observer] = FakeResizeObserver.instances;
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (
      this: HTMLElement,
    ) {
      return this.className.includes("z-20") ? 80 : 10;
    });
    act(() => observer?.fire());
    expect(frame.style.getPropertyValue("--chrome-top")).toBe("80px");
    expect(frame.style.getPropertyValue("--chrome-bottom")).toBe("10px");
  });

  it("restarts observation when the underlay or the campaign session changes", () => {
    const view = renderFrame("s1", "overview");
    const first = FakeResizeObserver.instances[0];
    view.update("s1", "overview");
    expect(FakeResizeObserver.instances).toHaveLength(1);
    view.update("s2", "overview");
    expect(first?.disconnected).toBe(true);
    expect(FakeResizeObserver.instances).toHaveLength(2);
    const second = FakeResizeObserver.instances[1];
    view.update("s2", "treasury");
    expect(second?.disconnected).toBe(true);
    expect(FakeResizeObserver.instances).toHaveLength(3);
  });

  it("disconnects on unmount", () => {
    const view = renderFrame("s1", "overview");
    const [observer] = FakeResizeObserver.instances;
    view.unmount();
    expect(observer?.disconnected).toBe(true);
  });
});
