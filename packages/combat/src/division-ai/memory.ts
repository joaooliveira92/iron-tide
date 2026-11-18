import { BluewaveError } from "@bluewave/contracts";
import { canonicalSerialize, compareCodePoints, hashWithContext } from "@bluewave/deterministic";
import { Schema } from "effect";
import { decodeContract } from "../schema-issues.js";
import { PointSchema, type Point } from "./contracts.js";
import {
  DIVISION_AI_MEMORY_INVALID,
  DIVISION_AI_MODES,
  type DivisionAiMode,
} from "./reasonCodes.js";

export const DIVISION_AI_MEMORY_VERSION = "division_ai_memory_v1" as const;
export const DIVISION_AI_MEMORY_HASH_DOMAIN = "bluewave.division_ai_memory.v1" as const;
export const PATROL_WAYPOINT_COUNT = 4 as const;

export type SupportSide = -1 | 0 | 1;

export interface DivisionAiMemoryEntry {
  readonly divisionId: string;
  readonly mode: DivisionAiMode | null;
  readonly modeSinceMinute: number;
  readonly supportSide: SupportSide;
  readonly attacking: boolean;
  readonly patrolAnchor: Point | null;
  readonly waypointIndex: number;
}

export interface DivisionAiMemory {
  readonly version: typeof DIVISION_AI_MEMORY_VERSION;
  readonly divisions: readonly DivisionAiMemoryEntry[];
}

const nonEmptyString = Schema.String.check(Schema.isMinLength(1));
const integer = Schema.Finite.check(Schema.isInt());
const nonNegativeInteger = integer.check(Schema.isGreaterThanOrEqualTo(0));

const entrySchema = Schema.Struct({
  divisionId: nonEmptyString,
  mode: Schema.NullOr(Schema.Literals(DIVISION_AI_MODES)),
  modeSinceMinute: nonNegativeInteger,
  supportSide: Schema.Literals([-1, 0, 1]),
  attacking: Schema.Boolean,
  patrolAnchor: Schema.NullOr(PointSchema),
  waypointIndex: integer.check(
    Schema.isGreaterThanOrEqualTo(0),
    Schema.isLessThan(PATROL_WAYPOINT_COUNT),
  ),
});

export const DivisionAiMemorySchema = Schema.Struct({
  version: Schema.Literal(DIVISION_AI_MEMORY_VERSION),
  divisions: Schema.Array(entrySchema),
});

export function createDivisionAiMemory(): DivisionAiMemory {
  return { version: DIVISION_AI_MEMORY_VERSION, divisions: [] };
}

export function createMemoryEntry(divisionId: string, minute: number): DivisionAiMemoryEntry {
  return {
    divisionId,
    mode: null,
    modeSinceMinute: minute,
    supportSide: 0,
    attacking: false,
    patrolAnchor: null,
    waypointIndex: 0,
  };
}

export function sortMemoryEntries(
  entries: readonly DivisionAiMemoryEntry[],
): readonly DivisionAiMemoryEntry[] {
  return [...entries].sort((a, b) => compareCodePoints(a.divisionId, b.divisionId));
}

export function decodeDivisionAiMemory(value: unknown): DivisionAiMemory {
  const memory = decodeContract(DivisionAiMemorySchema, DIVISION_AI_MEMORY_INVALID, value);
  const ids = memory.divisions.map((entry) => entry.divisionId);
  const sorted = sortMemoryEntries(memory.divisions).map((entry) => entry.divisionId);
  const ordered = ids.every((id, index) => id === sorted[index]);
  const unique = new Set(ids).size === ids.length;
  if (!ordered || !unique) {
    throw new BluewaveError(DIVISION_AI_MEMORY_INVALID, {
      code: DIVISION_AI_MEMORY_INVALID,
      field: "divisions",
      reason: "entries must be unique and sorted by divisionId",
    });
  }
  return memory;
}

export function serializeDivisionAiMemory(memory: DivisionAiMemory): string {
  return canonicalSerialize(memory);
}

export function parseDivisionAiMemory(serialized: string): DivisionAiMemory {
  return decodeDivisionAiMemory(JSON.parse(serialized));
}

export function hashDivisionAiMemory(memory: DivisionAiMemory): string {
  return hashWithContext(serializeDivisionAiMemory(memory), DIVISION_AI_MEMORY_HASH_DOMAIN);
}
