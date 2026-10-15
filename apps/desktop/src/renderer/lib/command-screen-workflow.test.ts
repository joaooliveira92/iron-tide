import { describe, expect, it, vi } from "vite-plus/test";
import {
  acceptCommand,
  applyProjection,
  applyRejection,
  applyTransportFailure,
  beginRequest,
  describeRejection,
  prepareCommand,
} from "./command-screen-workflow.js";

const state = {
  revision: 3,
  pendingRequest: null,
  requiresRefresh: false,
  notice: null,
};

describe("command screen workflow lifecycle", () => {
  it("captures revision and transport identity once for idempotent retry", async () => {
    const send = vi.fn(async () => ({
      outcome: "success" as const,
      value: "ok",
      diagnostics: [],
    }));
    const command = prepareCommand("replace", 3, send, "tx-1");

    await command.send(command.context);
    await command.send(command.context);

    expect(command.context).toEqual({
      expectedRevision: 3,
      transportRequestId: "tx-1",
    });
    expect(send).toHaveBeenNthCalledWith(1, command.context);
    expect(send).toHaveBeenNthCalledWith(2, command.context);
  });

  it("keeps the captured transport identity while an outcome is unknown", () => {
    const command = prepareCommand(
      "replace",
      3,
      async () => ({ outcome: "success", value: null, diagnostics: [] }),
      "tx-1",
    );
    const pending = beginRequest(state, command);
    expect(applyTransportFailure(pending, "closed")).toEqual({
      ...pending,
      notice: "TRANSPORT_FAILURE: closed",
    });
  });

  it("marks stale projections for refresh and adopts the engine revision", () => {
    const command = prepareCommand(
      "submit",
      3,
      async () => ({ outcome: "success", value: null, diagnostics: [] }),
      "tx-2",
    );
    expect(
      applyRejection(beginRequest(state, command), {
        outcome: "rejected",
        reason: "STALE_REVISION",
        diagnostics: ["expected 3"],
        currentRevision: 4,
      }),
    ).toEqual({
      revision: 4,
      pendingRequest: null,
      requiresRefresh: true,
      notice: "STALE_REVISION: expected 3\ncurrent revision 4",
    });
  });

  it("formats multiple diagnostics as independent failures", () => {
    expect(describeRejection("INVALID", ["first", "second"])).toBe("INVALID:\n• first\n• second");
  });

  it("adopts the projection revision and clears all request markers", () => {
    const inFlight = beginRequest(
      { ...state, extra: "kept" },
      {
        kind: "submit",
        context: { expectedRevision: 3, transportRequestId: "tx-9" },
        send: async () => ({ outcome: "success", value: null, diagnostics: [] }),
      },
    );

    const projected = applyProjection(
      { ...inFlight, requiresRefresh: true },
      { revision: 7, value: "ignored" },
      { extra: "kept" },
    );

    expect(projected).toEqual({
      revision: 7,
      pendingRequest: null,
      requiresRefresh: false,
      notice: null,
      extra: "kept",
    });
  });

  it("clears the pending request and surfaces the command notice on acceptance", () => {
    const accepted = acceptCommand(
      beginRequest(
        { ...state, extra: "kept" },
        {
          kind: "submit",
          context: { expectedRevision: 3, transportRequestId: "tx-10" },
          send: async () => ({ outcome: "success", value: null, diagnostics: [] }),
        },
      ),
      { extra: "kept" },
      "Command cmd_1 is submitted",
    );

    expect(accepted).toEqual({
      revision: 3,
      pendingRequest: null,
      requiresRefresh: false,
      notice: "Command cmd_1 is submitted",
      extra: "kept",
    });
  });
});
