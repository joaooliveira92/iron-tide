import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import type {
  ConstructionBatchPreviewOutcome,
  ForeignConstructionPreviewOutcome,
} from "../../../../shared/construction-contract.js";
import { useOrderDialog } from "./useOrderDialog.js";

type Session = Parameters<typeof useOrderDialog>[0];

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const HOME_REFUSED = {
  ok: false,
  reason: "x",
} as Partial<ConstructionBatchPreviewOutcome> as ConstructionBatchPreviewOutcome;
const FOREIGN_NONE = {
  ok: true,
  preview: { builders: [] },
} as Partial<ForeignConstructionPreviewOutcome> as ForeignConstructionPreviewOutcome;

function sessionWith(patch: Partial<Session>): Session {
  const state = {
    studies: [],
    designs: [],
    economy: null,
    workspace: null,
  } as Partial<Session["state"]> as Session["state"];
  return {
    state,
    selectedDesignId: "d1",
    previewBatch: () => Promise.resolve(HOME_REFUSED),
    previewForeign: () => Promise.resolve(FOREIGN_NONE),
    orderBatch: () => undefined,
    placeForeignOrder: () => undefined,
    ...patch,
  };
}

describe("order dialog preview loading", () => {
  afterEach(cleanup);

  it("fetches both previews on open, reports fetching, and settles", async () => {
    const batch = deferred<ConstructionBatchPreviewOutcome>();
    const previewBatch = vi.fn(() => batch.promise);
    const previewForeign = vi.fn(() => Promise.resolve(FOREIGN_NONE));
    const { result } = renderHook(() =>
      useOrderDialog(sessionWith({ previewBatch, previewForeign })),
    );
    expect(result.current.state.fetching).toBe(false);
    expect(previewBatch).not.toHaveBeenCalled();

    act(() => result.current.actions.open());
    expect(previewBatch).toHaveBeenCalledWith("d1", 1);
    expect(previewForeign).toHaveBeenCalledWith("d1", 1);
    expect(result.current.state.fetching).toBe(true);

    await act(async () => batch.resolve(HOME_REFUSED));
    expect(result.current.state.fetching).toBe(false);
  });

  it("refetches when the quantity changes and ignores the superseded response", async () => {
    const first = deferred<ConstructionBatchPreviewOutcome>();
    const second = deferred<ConstructionBatchPreviewOutcome>();
    const pending = [first, second];
    const previewBatch = vi.fn(() => (pending.shift() ?? first).promise);
    const session = sessionWith({ previewBatch });
    const { result } = renderHook(() => useOrderDialog(session));
    act(() => result.current.actions.open());
    act(() => result.current.actions.setQuantity(3));
    expect(previewBatch).toHaveBeenLastCalledWith("d1", 3);

    await act(async () => first.resolve(HOME_REFUSED));
    expect(result.current.state.fetching).toBe(true);
    await act(async () => second.resolve(HOME_REFUSED));
    expect(result.current.state.fetching).toBe(false);
  });

  it("drops an in-flight response when the dialog closes", async () => {
    const batch = deferred<ConstructionBatchPreviewOutcome>();
    const session = sessionWith({ previewBatch: () => batch.promise });
    const { result } = renderHook(() => useOrderDialog(session));
    act(() => result.current.actions.open());
    act(() => result.current.actions.close());
    expect(result.current.state.fetching).toBe(false);
    await act(async () => batch.resolve(HOME_REFUSED));
    expect(result.current.state.fetching).toBe(false);
    expect(result.current.state.open).toBe(false);
  });

  it("clamps the quantity and opens only with a target", async () => {
    const session = sessionWith({ selectedDesignId: null });
    const { result } = renderHook(() => useOrderDialog(session));
    act(() => result.current.actions.open());
    expect(result.current.state.open).toBe(false);
    act(() => result.current.actions.open("d2"));
    act(() => result.current.actions.setQuantity(99));
    expect(result.current.state.quantity).toBe(12);
    act(() => result.current.actions.setQuantity(0));
    expect(result.current.state.quantity).toBe(1);
    await act(async () => {});
  });
});
