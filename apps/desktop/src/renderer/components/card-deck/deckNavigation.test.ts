import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createWheelStepper,
  normalizeIndex,
  WHEEL_COOLDOWN_MS,
  WHEEL_THRESHOLD_PX,
} from "./deckNavigation.js";

describe("normalizeIndex", () => {
  it("wraps overflow back to the start", () => {
    expect(normalizeIndex(4, 4)).toBe(0);
    expect(normalizeIndex(9, 4)).toBe(1);
  });

  it("wraps a negative index to the end", () => {
    expect(normalizeIndex(-1, 4)).toBe(3);
    expect(normalizeIndex(-5, 4)).toBe(3);
  });

  it("leaves an in-range index alone", () => {
    expect(normalizeIndex(2, 4)).toBe(2);
  });

  it("returns 0 for an empty deck instead of NaN", () => {
    expect(normalizeIndex(3, 0)).toBe(0);
    expect(normalizeIndex(-3, 0)).toBe(0);
  });
});

describe("createWheelStepper", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a 32px threshold and a 360ms cooldown", () => {
    expect(WHEEL_THRESHOLD_PX).toBe(32);
    expect(WHEEL_COOLDOWN_MS).toBe(360);
  });

  it("accumulates sub-threshold scroll without stepping", () => {
    const onStep = vi.fn();
    const stepper = createWheelStepper(onStep);
    stepper.push(10, 0);
    stepper.push(10, 0);
    expect(onStep).not.toHaveBeenCalled();
  });

  it("steps once when the accumulated scroll crosses the threshold", () => {
    const onStep = vi.fn();
    const stepper = createWheelStepper(onStep);
    stepper.push(20, 0);
    stepper.push(20, 0);
    expect(onStep).toHaveBeenCalledTimes(1);
    expect(onStep).toHaveBeenCalledWith(1);
  });

  it("steps backwards for upward scroll", () => {
    const onStep = vi.fn();
    const stepper = createWheelStepper(onStep);
    stepper.push(-40, 0);
    expect(onStep).toHaveBeenCalledWith(-1);
  });

  it("ignores a second wheel inside the cooldown", () => {
    const onStep = vi.fn();
    const stepper = createWheelStepper(onStep);
    stepper.push(40, 0);
    vi.advanceTimersByTime(WHEEL_COOLDOWN_MS - 1);
    stepper.push(40, 0);
    expect(onStep).toHaveBeenCalledTimes(1);
  });

  it("steps again once the cooldown has elapsed", () => {
    const onStep = vi.fn();
    const stepper = createWheelStepper(onStep);
    stepper.push(40, 0);
    vi.advanceTimersByTime(WHEEL_COOLDOWN_MS);
    stepper.push(40, 0);
    expect(onStep).toHaveBeenCalledTimes(2);
  });

  it("scales line-mode deltas by 16 and page-mode deltas by 100", () => {
    const lineStep = vi.fn();
    createWheelStepper(lineStep).push(2, 1);
    expect(lineStep).toHaveBeenCalledTimes(1);

    const pageStep = vi.fn();
    createWheelStepper(pageStep).push(1, 2);
    expect(pageStep).toHaveBeenCalledTimes(1);

    const pixelStep = vi.fn();
    createWheelStepper(pixelStep).push(2, 0);
    expect(pixelStep).not.toHaveBeenCalled();
  });

  it("does not step after being disposed", () => {
    const onStep = vi.fn();
    const stepper = createWheelStepper(onStep);
    stepper.push(40, 0);
    stepper.dispose();
    vi.advanceTimersByTime(WHEEL_COOLDOWN_MS);
    expect(vi.getTimerCount()).toBe(0);
  });
});
