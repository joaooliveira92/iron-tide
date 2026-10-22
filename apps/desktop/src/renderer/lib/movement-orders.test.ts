import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type {
  MovementCommandOutcome,
  SubmitMovementCommandPayload,
} from "../../shared/fleet-contract.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import type {
  CommandExecutionContext,
  CommandSender,
  RequestKind,
} from "./command-screen-workflow.js";
import {
  movementCancelBody,
  movementReplaceBody,
  movementSubmitBody,
  useMovementOrders,
  type MovementRouteTarget,
} from "./movement-orders.js";

const originalBridge = window.bluewave;

afterEach(() => {
  cleanup();
  if (originalBridge === undefined) {
    delete window.bluewave;
  } else {
    window.bluewave = originalBridge;
  }
});

const context: CommandExecutionContext = { expectedRevision: 7, transportRequestId: "tr-1" };
const target: MovementRouteTarget = {
  divisionId: "div-1",
  fromAreaId: "a-home",
  toAreaId: "a-next",
};

const acceptedOutcome: BridgeResult<MovementCommandOutcome> = {
  outcome: "success",
  value: {
    workspace: { movementCommands: [] },
    command: { commandId: "cmd-1", status: "QUEUED" },
  },
  diagnostics: [],
};

function bridgeWith(execute: (name: string, payload: unknown) => unknown): void {
  window.bluewave = { campaign: { execute } } as BluewaveDesktopBridge;
}

/** A fake workflow execute that drives the sender with a fixed context. */
function fakeExecute() {
  return vi.fn(async (kind: RequestKind, send: CommandSender<MovementCommandOutcome>) => {
    await send(context);
    return "accepted" as const;
  });
}

describe("movement order payload builders", () => {
  it("submit builds the MoveFleet body the Fleet screen sends today", () => {
    const body: SubmitMovementCommandPayload = movementSubmitBody("session-1", target, context);
    expect(body).toEqual({
      sessionId: "session-1",
      divisionId: "div-1",
      fromAreaId: "a-home",
      toAreaId: "a-next",
      expectedRevision: 7,
      transportRequestId: "tr-1",
    });
  });

  it("replace carries the same body plus the pending command id", () => {
    expect(movementReplaceBody("session-1", target, "cmd-9", context)).toEqual({
      sessionId: "session-1",
      divisionId: "div-1",
      fromAreaId: "a-home",
      toAreaId: "a-next",
      commandId: "cmd-9",
      expectedRevision: 7,
      transportRequestId: "tr-1",
    });
  });

  it("cancel carries only the envelope and the pending command id", () => {
    expect(movementCancelBody("session-1", "cmd-9", context)).toEqual({
      sessionId: "session-1",
      commandId: "cmd-9",
      expectedRevision: 7,
      transportRequestId: "tr-1",
    });
  });
});

describe("useMovementOrders", () => {
  it("submit sends the MoveFleet body through the shared bridge path", async () => {
    const bridgeExecute = vi.fn(async () => acceptedOutcome);
    bridgeWith(bridgeExecute);
    const execute = fakeExecute();

    const { result } = renderHook(() => useMovementOrders("session-1", execute));
    let outcome: string | null = null;
    await act(async () => {
      outcome = await result.current.submit(target);
    });

    expect(outcome).toBe("accepted");
    expect(execute).toHaveBeenCalledWith("submit", expect.any(Function));
    expect(bridgeExecute).toHaveBeenCalledWith("submitMovementCommand", {
      sessionId: "session-1",
      divisionId: "div-1",
      fromAreaId: "a-home",
      toAreaId: "a-next",
      expectedRevision: 7,
      transportRequestId: "tr-1",
    });
  });

  it("replace sends the pending command id with the same route body", async () => {
    const bridgeExecute = vi.fn(async () => acceptedOutcome);
    bridgeWith(bridgeExecute);
    const execute = fakeExecute();

    const { result } = renderHook(() => useMovementOrders("session-1", execute));
    await act(async () => {
      await result.current.replace(target, "cmd-9");
    });

    expect(execute).toHaveBeenCalledWith("replace", expect.any(Function));
    expect(bridgeExecute).toHaveBeenCalledWith(
      "replaceMovementCommand",
      expect.objectContaining({ commandId: "cmd-9", divisionId: "div-1", toAreaId: "a-next" }),
    );
  });

  it("cancel sends only the envelope and the command id", async () => {
    const bridgeExecute = vi.fn(async () => acceptedOutcome);
    bridgeWith(bridgeExecute);
    const execute = fakeExecute();

    const { result } = renderHook(() => useMovementOrders("session-1", execute));
    await act(async () => {
      await result.current.cancel("cmd-9");
    });

    expect(execute).toHaveBeenCalledWith("cancel", expect.any(Function));
    expect(bridgeExecute).toHaveBeenCalledWith("cancelMovementCommand", {
      sessionId: "session-1",
      commandId: "cmd-9",
      expectedRevision: 7,
      transportRequestId: "tr-1",
    });
  });

  it("without a bridge the order is not attempted and resolves as transport failure", async () => {
    delete window.bluewave;
    const execute = fakeExecute();

    const { result } = renderHook(() => useMovementOrders("session-1", execute));
    let outcome: string | null = null;
    await act(async () => {
      outcome = await result.current.submit(target);
    });

    expect(outcome).toBe("transport-failure");
    expect(execute).not.toHaveBeenCalled();
  });
});
