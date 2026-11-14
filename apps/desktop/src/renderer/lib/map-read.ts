import type { InspectMapResult } from "../../shared/campaign-contract.js";
import type { BridgeRead } from "./bridge-read.js";

export const MAP_SHAPE_REJECTED_MESSAGE = "The map read returned an unexpected shape.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isInspectMapResult(value: unknown): value is InspectMapResult {
  if (!isRecord(value) || !isRecord(value["strategic"])) return false;
  const { world, playerFleets, blockades } = value["strategic"];
  if (!Array.isArray(playerFleets) || !Array.isArray(blockades) || !isRecord(world)) return false;
  return ["nations", "areas", "ports", "fleets", "routes"].every((key) =>
    Array.isArray(world[key]),
  );
}

export function confirmMapRead(read: BridgeRead<unknown>): BridgeRead<InspectMapResult> {
  if (read.status !== "ready") return read;
  return isInspectMapResult(read.value)
    ? { status: "ready", value: read.value }
    : { status: "unavailable", reason: MAP_SHAPE_REJECTED_MESSAGE };
}
