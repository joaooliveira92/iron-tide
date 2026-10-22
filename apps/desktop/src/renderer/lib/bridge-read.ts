import type { BridgeResult } from "../../shared/bridge-contract.js";

export const BRIDGE_UNAVAILABLE_MESSAGE = "Bluewave bridge not available";
export const TRANSPORT_FAILURE_MESSAGE = "The request failed.";

export type BridgeRead<Value> =
  | { readonly status: "ready"; readonly value: Value }
  | { readonly status: "unavailable"; readonly reason: string };

export function describeTransportFailure(error: unknown): string {
  return error instanceof Error ? error.message : TRANSPORT_FAILURE_MESSAGE;
}

export function foldBridgeResult<Value>(result: BridgeResult<Value>): BridgeRead<Value> {
  return result.outcome === "success"
    ? { status: "ready", value: result.value }
    : { status: "unavailable", reason: result.reason };
}

export async function readBridge<Bridge, Value>(
  bridge: Bridge | undefined,
  run: (bridge: Bridge) => Promise<BridgeResult<Value>>,
): Promise<BridgeRead<Value>> {
  if (bridge === undefined) return { status: "unavailable", reason: BRIDGE_UNAVAILABLE_MESSAGE };
  try {
    return foldBridgeResult(await run(bridge));
  } catch (error) {
    return { status: "unavailable", reason: describeTransportFailure(error) };
  }
}

export async function loadThroughBridge<Bridge, Value>(
  bridge: Bridge | undefined,
  run: (bridge: Bridge) => Promise<BridgeResult<Value>>,
): Promise<BridgeResult<Value>> {
  if (bridge === undefined) throw new Error(BRIDGE_UNAVAILABLE_MESSAGE);
  try {
    return await run(bridge);
  } catch (error) {
    throw error instanceof Error ? error : new Error(TRANSPORT_FAILURE_MESSAGE);
  }
}
