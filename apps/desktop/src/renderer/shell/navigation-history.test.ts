import { describe, expect, it } from "vite-plus/test";

import {
  canGoBack,
  canGoForward,
  currentEntry,
  goBack,
  goForward,
  initialHistory,
  visit,
} from "./navigation-history.js";

const start = initialHistory("overview");

describe("navigation history", () => {
  it("starts on the initial entry with nowhere to go", () => {
    expect(currentEntry(start)).toBe("overview");
    expect(canGoBack(start)).toBe(false);
    expect(canGoForward(start)).toBe(false);
  });

  it("moves to a visited entry and allows going back", () => {
    const history = visit(start, "fleet");

    expect(currentEntry(history)).toBe("fleet");
    expect(canGoBack(history)).toBe(true);
    expect(canGoForward(history)).toBe(false);
  });

  it("walks backward and forward over the same entries", () => {
    const history = visit(visit(start, "construction"), "fleet");
    const back = goBack(history);

    expect(currentEntry(back)).toBe("construction");
    expect(canGoForward(back)).toBe(true);
    expect(currentEntry(goBack(back))).toBe("overview");
    expect(currentEntry(goForward(back))).toBe("fleet");
  });

  it("ignores a repeat visit to the entry already shown", () => {
    const history = visit(start, "fleet");

    expect(visit(history, "fleet")).toBe(history);
  });

  it("drops the forward entries once a new entry is visited after going back", () => {
    const history = goBack(visit(visit(start, "construction"), "fleet"));
    const diverged = visit(history, "overview");

    expect(currentEntry(diverged)).toBe("overview");
    expect(canGoForward(diverged)).toBe(false);
    expect(currentEntry(goBack(diverged))).toBe("construction");
  });

  it("stays put when there is nothing to go back or forward to", () => {
    expect(goBack(start)).toBe(start);
    expect(goForward(start)).toBe(start);
  });
});
