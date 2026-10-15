import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  useCommandScreenWorkflow,
  type CommandScreenAdapter,
  type RequestLifecycle,
} from "./command-screen-workflow.js";

interface State extends RequestLifecycle {
  readonly items: readonly string[];
}
interface Projection {
  readonly revision: number;
  readonly items: readonly string[];
}

function makeAdapter(
  load: () => Promise<{ outcome: "success"; value: Projection; diagnostics: [] }>,
) {
  const adapter: CommandScreenAdapter<State, Projection, never> = {
    initialState: () => ({
      revision: 0,
      items: [],
      pendingRequest: null,
      requiresRefresh: false,
      notice: null,
    }),
    load,
    project: (projection) => ({ items: projection.items }),
    accept: () => ({ patch: {}, notice: "" }),
  };
  return adapter;
}

describe("useCommandScreenWorkflow refreshKey", () => {
  it("loads once on mount, then reloads when the key changes (month advanced elsewhere)", async () => {
    let revision = 0;
    const load = vi.fn(async () => ({
      outcome: "success" as const,
      value: { revision, items: [`rev ${revision}`] },
      diagnostics: [] as [],
    }));
    const { result, rerender } = renderHook(
      ({ key }: { key: number | null }) =>
        useCommandScreenWorkflow(makeAdapter(load), { refreshKey: key }),
      { initialProps: { key: 0 as number | null } },
    );
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
    expect(result.current.state.items).toEqual(["rev 0"]);

    // Re-rendering with the same key must not reload.
    rerender({ key: 0 });
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);

    // The campaign advanced: the screen reloads and shows the new data.
    revision = 1;
    rerender({ key: 1 });
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.state.items).toEqual(["rev 1"]);
    expect(result.current.state.revision).toBe(1);
  });

  it("does not reload for screens that pass no key", async () => {
    const load = vi.fn(async () => ({
      outcome: "success" as const,
      value: { revision: 0, items: [] },
      diagnostics: [] as [],
    }));
    const { rerender } = renderHook(() => useCommandScreenWorkflow(makeAdapter(load)));
    await act(async () => {});
    rerender();
    rerender();
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);
  });
});
