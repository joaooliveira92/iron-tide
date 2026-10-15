import { useEffect, useRef, useState } from "react";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import { useBridge } from "./bridge-context.js";

export type BridgeQueryState<Value> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: Value }
  | { readonly status: "error"; readonly message: string };

export interface UseBridgeQueryOptions {
  /** Skips the read entirely while false; the state stays `loading`. Defaults to true. */
  readonly enabled?: boolean;
  /** Shown when `window.bluewave` is unavailable; defaults to a generic line. */
  readonly bridgeUnavailableMessage?: string;
  /** Shown when the command throws a non-Error; defaults to a generic line. */
  readonly transportFailureMessage?: string;
}

const DEFAULT_UNAVAILABLE_MESSAGE = "Bluewave bridge not available";
const DEFAULT_TRANSPORT_FAILURE_MESSAGE = "The request failed.";

/**
 * Runs one read-only bridge command for the current `sessionId`/`revision` and
 * folds it into a `loading | ready | error` union. The command thunk is read
 * from a ref, so it always sees the latest closure without re-running on every
 * render; re-runs are governed by `sessionId`/`revision` alone, and a stale
 * in-flight result is discarded once either changes.
 */
export function useBridgeQuery<Value>(
  sessionId: string,
  revision: number | null,
  run: (bridge: BluewaveDesktopBridge, sessionId: string) => Promise<BridgeResult<Value>>,
  options: UseBridgeQueryOptions = {},
): BridgeQueryState<Value> {
  const [state, setState] = useState<BridgeQueryState<Value>>({ status: "loading" });
  const bridge = useBridge();
  const runRef = useRef(run);
  runRef.current = run;
  const enabled = options.enabled ?? true;
  const unavailableMessage = options.bridgeUnavailableMessage ?? DEFAULT_UNAVAILABLE_MESSAGE;
  const transportFailureMessage =
    options.transportFailureMessage ?? DEFAULT_TRANSPORT_FAILURE_MESSAGE;

  useEffect(() => {
    if (!enabled) return;
    if (bridge === undefined) {
      setState({ status: "error", message: unavailableMessage });
      return;
    }
    let active = true;
    runRef
      .current(bridge, sessionId)
      .then((result) => {
        if (!active) return;
        setState(
          result.outcome === "success"
            ? { status: "ready", value: result.value }
            : { status: "error", message: result.reason },
        );
      })
      .catch((error: unknown) => {
        if (!active) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : transportFailureMessage,
        });
      });
    return () => {
      active = false;
    };
  }, [bridge, sessionId, revision, enabled, unavailableMessage, transportFailureMessage]);

  return state;
}
