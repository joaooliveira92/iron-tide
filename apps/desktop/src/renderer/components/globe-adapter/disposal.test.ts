import { describe, expect, it } from "vite-plus/test";

import { DisposalRegistry } from "./disposal.js";

describe("disposal registry", () => {
  it("disposes in reverse registration order exactly once", () => {
    const calls: string[] = [];
    const registry = new DisposalRegistry();
    registry.add(() => calls.push("first"));
    registry.add(() => calls.push("second"));
    registry.add(() => calls.push("third"));
    registry.dispose();
    registry.dispose();
    expect(calls).toEqual(["third", "second", "first"]);
    expect(registry.size).toBe(0);
    expect(registry.isDisposed).toBe(true);
  });

  it("immediately disposes work registered after disposal", () => {
    const registry = new DisposalRegistry();
    registry.dispose();
    let called = false;
    registry.add(() => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("does not grow across repeated map open-close cycles", () => {
    const registry = new DisposalRegistry();
    for (let cycle = 0; cycle < 10; cycle++) {
      const remove = registry.add(() => undefined);
      const unsubscribe = registry.add(() => undefined);
      expect(registry.size).toBe(2);
      remove();
      unsubscribe();
      expect(registry.size).toBe(0);
    }
    registry.dispose();
    expect(registry.size).toBe(0);
  });
});
