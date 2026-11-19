import { act, cleanup, render } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { useStableCallback } from "./use-stable-callback.js";

describe("useStableCallback", () => {
  afterEach(cleanup);

  it("keeps one identity and always calls the latest callback", () => {
    const seen: Array<() => number> = [];
    let bump: () => void = () => undefined;
    function Probe() {
      const [count, setCount] = useState(0);
      bump = () => setCount((current) => current + 1);
      seen.push(useStableCallback(() => count));
      return null;
    }
    render(<Probe />);
    act(() => bump());
    act(() => bump());
    const first = seen[0];
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.every((callback) => callback === first)).toBe(true);
    expect(seen.at(-1)?.()).toBe(2);
  });

  it("is readable from a child's own mount, before any later render", () => {
    const reads: string[] = [];
    function Child({ callback }: { readonly callback: () => string }) {
      reads.push(callback());
      return null;
    }
    function Parent() {
      const callback = useStableCallback(() => "latest");
      return <Child callback={callback} />;
    }
    render(<Parent />);
    expect(reads).toEqual(["latest"]);
  });
});
