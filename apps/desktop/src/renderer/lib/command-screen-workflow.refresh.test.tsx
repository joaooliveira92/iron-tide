import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vite-plus/test";
import {
  requestLifecycleAdapter,
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
  return requestLifecycleAdapter<State, Projection, never>({
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
  });
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

    rerender({ key: 0 });
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(1);

    revision = 1;
    rerender({ key: 1 });
    await act(async () => {});
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.state.items).toEqual(["rev 1"]);
    expect(result.current.state.revision).toBe(1);
  });

  it("folds a stale rejection and reloads once for a discriminated-union state", async () => {
    let revision = 0;
    const load = vi.fn(async () => ({
      outcome: "success" as const,
      value: { revision, value: `rev ${revision}` },
      diagnostics: [] as [],
    }));
    const send = vi.fn(async () => ({
      outcome: "rejected" as const,
      reason: "REVISION_MISMATCH",
      diagnostics: ["expected revision 0"],
      currentRevision: 1,
    }));

    interface UnionState {
      readonly kind: "idle" | "loaded" | "rejected";
      readonly revision: number;
      readonly value: string | null;
      readonly notice: string | null;
    }
    type UnionProjection = { readonly revision: number; readonly value: string };

    const adapter: CommandScreenAdapter<UnionState, UnionProjection, string> = {
      initialState: () => ({ kind: "idle", revision: 0, value: null, notice: null }),
      load,
      project: (_state, projection) => ({
        kind: "loaded",
        revision: projection.revision,
        value: projection.value,
        notice: null,
      }),
      begin: (state) => ({ ...state, notice: null }),
      reject: (state, rejection) => ({
        kind: "rejected",
        revision: rejection.currentRevision ?? state.revision,
        value: state.value,
        notice: rejection.reason,
      }),
      transportFailure: (state, message) => ({ ...state, notice: message }),
      accept: (state) => state,
      requiresRefresh: (state) => state.kind === "rejected",
    };

    const { result } = renderHook(() => useCommandScreenWorkflow(adapter));
    await act(async () => {});
    expect(result.current.state.value).toBe("rev 0");

    revision = 1;
    await act(async () => {
      await result.current.execute("submit", () => send());
    });
    await act(async () => {});

    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.state.kind).toBe("loaded");
    expect(result.current.state.value).toBe("rev 1");
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
