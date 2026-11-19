import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  mountSession,
  useBattleSessionSnapshot,
  type BattleSessionSnapshot,
} from "../../session/battle-session-harness.js";
import { TacticalMapRoot } from "./TacticalMapRoot.js";

interface ObserverRecord {
  readonly callback: ResizeObserverCallback;
  disconnected: boolean;
  observed: Element[];
}

const observers: ObserverRecord[] = [];

class RecordingResizeObserver implements ResizeObserver {
  private readonly record: ObserverRecord;
  constructor(callback: ResizeObserverCallback) {
    this.record = { callback, disconnected: false, observed: [] };
    observers.push(this.record);
  }
  observe(target: Element): void {
    this.record.observed.push(target);
  }
  unobserve(): void {}
  disconnect(): void {
    this.record.disconnected = true;
  }
}

let session: BattleSessionSnapshot | null = null;

function Probe() {
  session = useBattleSessionSnapshot();
  return null;
}

const current = (): BattleSessionSnapshot => {
  if (session === null) throw new Error("probe not rendered");
  return session;
};

describe("tactical map root viewport measurement", () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("ResizeObserver", RecordingResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 900.4,
      height: 500.6,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 900.4,
      bottom: 500.6,
      toJSON: () => ({}),
    });
  });
  afterEach(() => {
    cleanup();
    session = null;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("measures the frame once mounted, reports the rounded size and re-measures on resize", async () => {
    mountSession(
      <>
        <Probe />
        <TacticalMapRoot>
          <span />
        </TacticalMapRoot>
      </>,
    );
    await waitFor(() => expect(observers.length).toBe(1));
    expect(observers[0]?.observed.length).toBe(1);
    await waitFor(() => expect(current().state.viewport).toEqual({ width: 900, height: 501 }));

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 640,
      height: 360,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 640,
      bottom: 360,
      toJSON: () => ({}),
    });
    act(() => observers[0]?.callback([], new RecordingResizeObserver(() => undefined)));
    await waitFor(() => expect(current().state.viewport).toEqual({ width: 640, height: 360 }));

    cleanup();
    expect(observers[0]?.disconnected).toBe(true);
  });
});
