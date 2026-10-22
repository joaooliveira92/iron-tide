import { useEffect, useRef, useState } from "react";

import type { BluewaveDesktopBridge } from "../../preload/index.js";
import type { BridgeResult } from "../../shared/bridge-contract.js";
import { useBridge } from "./bridge-context.js";
import { readBridge } from "./bridge-read.js";

export type BridgeQueryState<Value> =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly value: Value }
  | { readonly status: "error"; readonly message: string };

export interface UseBridgeQueryOptions {
  readonly enabled?: boolean;
}

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

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void readBridge(bridge, (current) => runRef.current(current, sessionId)).then((read) => {
      if (!active) return;
      setState(
        read.status === "ready"
          ? { status: "ready", value: read.value }
          : { status: "error", message: read.reason },
      );
    });
    return () => {
      active = false;
    };
  }, [bridge, sessionId, revision, enabled]);

  return state;
}
