import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import type { ComponentDef } from "./component.js";
import type { CompiledDesign, DesignDraft } from "./compile.js";
import { applyEdit, type DraftEdit } from "./edits.js";
import { withoutSubjects } from "./findings.js";
import { isShipTypeId } from "./shipTypes.js";

export const DESIGN_FILE_FORMAT = "bwdesign";
export const DESIGN_SCHEMA_VERSION = 1;

export class PersistenceError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
  readonly _tag = "PersistenceError";
  /** `_tag`-based narrowing without `instanceof`. */
  static is(value: unknown): value is PersistenceError {
    return (
      typeof value === "object" &&
      value !== null &&
      (value as { readonly _tag?: unknown })._tag === "PersistenceError"
    );
  }
  constructor(
    readonly code:
      | "BAD_FORMAT"
      | "BAD_JSON"
      | "UNSUPPORTED_FUTURE_VERSION"
      | "NO_MIGRATION"
      | "INVALID_DRAFT"
      | "FLOAT_IN_STATE"
      | "HASH_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "PersistenceError";
  }
}

/** Every persisted number is an integer (money, mass, bp...). A float anywhere is corruption. */
export function assertNoFloats(value: unknown, path = "$"): void {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value))
      throw new PersistenceError("FLOAT_IN_STATE", `non-integer number at ${path}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoFloats(v, `${path}[${i}]`));
  } else if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertNoFloats(v, `${path}.${k}`);
  }
}

export const componentHash = (def: ComponentDef): string => sha256Hex(canonicalSerialize(def));

export interface DesignFile {
  readonly format: typeof DESIGN_FILE_FORMAT;
  readonly schemaVersion: number;
  readonly draft: DesignDraft;
  /** Hash of each component definition the draft uses, to detect content drift on import. */
  readonly componentHashes: Readonly<Record<string, string>>;
  readonly compiledHash: string | null;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** Structural validation of the parts of a draft the compiler indexes into. Returns problems; empty = ok. */
export function validateDraftShape(raw: unknown): string[] {
  const p: string[] = [];
  if (!isObj(raw)) return ["draft is not an object"];
  for (const k of ["nationId"] as const)
    if (typeof raw[k] !== "string") p.push(`${k} must be a string`);
  for (const k of ["requirement", "hull", "machinery", "armour"] as const)
    if (!isObj(raw[k])) p.push(`${k} must be an object`);
  if (!Array.isArray(raw.placements)) p.push("placements must be an array");
  else {
    const seen = new Set<string>();
    raw.placements.forEach((pl, i) => {
      if (
        !isObj(pl) ||
        typeof pl.instanceId !== "string" ||
        typeof pl.componentId !== "string" ||
        typeof pl.zoneId !== "string"
      )
        p.push(`placements[${i}] is malformed`);
      else if (seen.has(pl.instanceId))
        p.push(`placements[${i}] duplicates instanceId ${pl.instanceId}`);
      else seen.add(pl.instanceId);
      if (isObj(pl) && !Number.isSafeInteger(pl.stationPermille))
        p.push(`placements[${i}].stationPermille must be an integer`);
    });
  }
  if (isObj(raw.requirement) && !isShipTypeId(raw.requirement.category))
    p.push(`requirement.category is not a registered ship type (SHIP_TYPE_UNREGISTERED)`);
  if (isObj(raw.hull) && typeof raw.hull.hullFormId !== "string")
    p.push("hull.hullFormId must be a string");
  if (isObj(raw.machinery) && typeof raw.machinery.plantId !== "string")
    p.push("machinery.plantId must be a string");
  return p;
}

export function encodeDesignFile(
  draft: DesignDraft,
  catalogue: readonly ComponentDef[],
  compiled: CompiledDesign | null,
): string {
  assertNoFloats(draft);
  const byId = new Map(catalogue.map((c) => [c.id, c]));
  const hashes: Record<string, string> = {};
  for (const p of draft.placements) {
    const def = byId.get(p.componentId);
    if (def) hashes[def.id] = componentHash(def);
  }
  const file: DesignFile = {
    format: DESIGN_FILE_FORMAT,
    schemaVersion: DESIGN_SCHEMA_VERSION,
    draft,
    componentHashes: hashes,
    compiledHash: compiled?.hash ?? null,
  };
  return canonicalSerialize(file);
}

export type Migration = (raw: Record<string, unknown>) => Record<string, unknown>;

export interface DecodedDesign {
  readonly draft: DesignDraft;
  readonly schemaVersion: number;
  readonly migratedFrom: number | null;
  /** Component ids whose definition changed or vanished since the file was written. A recompile is required. */
  readonly contentDrift: readonly string[];
  readonly compiledHash: string | null;
}

/** Forward-only migrations; unknown future versions are an error, never a silent downgrade. */
export function decodeDesignFile(
  text: string,
  catalogue: readonly ComponentDef[],
  migrations: Readonly<Record<number, Migration>> = {},
): DecodedDesign {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PersistenceError("BAD_JSON", "not valid JSON");
  }
  if (!isObj(raw) || raw.format !== DESIGN_FILE_FORMAT || !Number.isSafeInteger(raw.schemaVersion))
    throw new PersistenceError("BAD_FORMAT", "not a bwdesign file");
  let version = raw.schemaVersion as number;
  const original = version;
  if (version > DESIGN_SCHEMA_VERSION)
    throw new PersistenceError(
      "UNSUPPORTED_FUTURE_VERSION",
      `file is schema ${version}, this build reads up to ${DESIGN_SCHEMA_VERSION}`,
    );
  let cur: Record<string, unknown> = raw;
  while (version < DESIGN_SCHEMA_VERSION) {
    const m = migrations[version];
    if (!m) throw new PersistenceError("NO_MIGRATION", `no migration from schema ${version}`);
    cur = m(cur);
    version++;
  }
  assertNoFloats(cur);
  const problems = validateDraftShape(cur.draft);
  if (problems.length > 0) throw new PersistenceError("INVALID_DRAFT", problems.join("; "));
  const draft = cur.draft as unknown as DesignDraft;
  const stored = isObj(cur.componentHashes) ? (cur.componentHashes as Record<string, string>) : {};
  const byId = new Map(catalogue.map((c) => [c.id, c]));
  const drift: string[] = [];
  for (const id of Object.keys(stored).sort()) {
    const def = byId.get(id);
    if (!def || componentHash(def) !== stored[id]) drift.push(id);
  }
  return {
    draft,
    schemaVersion: DESIGN_SCHEMA_VERSION,
    migratedFrom: original === DESIGN_SCHEMA_VERSION ? null : original,
    contentDrift: drift,
    compiledHash: typeof cur.compiledHash === "string" ? cur.compiledHash : null,
  };
}

/** Recomputes the hash of a compiled design and compares it with the stored one. */
export function verifyCompiledHash(c: CompiledDesign): boolean {
  const { hash, ...body } = c;
  return sha256Hex(canonicalSerialize(withoutSubjects(body))) === hash;
}

export function decodeCompiled(text: string): CompiledDesign {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PersistenceError("BAD_JSON", "not valid JSON");
  }
  assertNoFloats(raw);
  const c = raw as CompiledDesign;
  if (!isObj(raw) || typeof c.hash !== "string" || !verifyCompiledHash(c))
    throw new PersistenceError("HASH_MISMATCH", "compiled design hash does not match its content");
  return c;
}

// ---- Undo / redo edit log --------------------------------------------------------------------

export interface EditLog {
  /** The draft the log starts from (after compaction, the oldest retained state). */
  readonly base: DesignDraft;
  readonly edits: readonly DraftEdit[];
  /** Number of edits currently applied (0..edits.length). */
  readonly cursor: number;
}

export const newLog = (base: DesignDraft): EditLog => ({ base, edits: [], cursor: 0 });

export function currentDraft(log: EditLog): DesignDraft {
  let d = log.base;
  for (let i = 0; i < log.cursor; i++) d = applyEdit(d, log.edits[i]!);
  return d;
}

/** A new edit discards any redo tail. The edit is validated by applying it now (throws EditError if it references nothing). */
export function pushEdit(log: EditLog, e: DraftEdit, cap = 500): EditLog {
  applyEdit(currentDraft(log), e);
  const next: EditLog = {
    base: log.base,
    edits: [...log.edits.slice(0, log.cursor), e],
    cursor: log.cursor + 1,
  };
  return next.edits.length > cap ? compact(next, cap) : next;
}
export const undo = (log: EditLog): EditLog =>
  log.cursor === 0 ? log : { ...log, cursor: log.cursor - 1 };
export const redo = (log: EditLog): EditLog =>
  log.cursor >= log.edits.length ? log : { ...log, cursor: log.cursor + 1 };
export const canUndo = (log: EditLog) => log.cursor > 0;
export const canRedo = (log: EditLog) => log.cursor < log.edits.length;

/** Folds the oldest edits into the base so at most `cap` remain; the current draft is unchanged. */
export function compact(log: EditLog, cap: number): EditLog {
  const drop = Math.max(0, Math.min(log.cursor, log.edits.length - cap));
  let base = log.base;
  for (let i = 0; i < drop; i++) base = applyEdit(base, log.edits[i]!);
  return { base, edits: log.edits.slice(drop), cursor: log.cursor - drop };
}

export const encodeLog = (log: EditLog): string => {
  assertNoFloats(log);
  return canonicalSerialize({ format: "bwdesign-log", schemaVersion: DESIGN_SCHEMA_VERSION, log });
};
export function decodeLog(text: string): EditLog {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PersistenceError("BAD_JSON", "not valid JSON");
  }
  if (!isObj(raw) || raw.format !== "bwdesign-log" || !isObj(raw.log))
    throw new PersistenceError("BAD_FORMAT", "not a bwdesign-log file");
  if ((raw.schemaVersion as number) > DESIGN_SCHEMA_VERSION)
    throw new PersistenceError("UNSUPPORTED_FUTURE_VERSION", "newer log schema");
  const log = raw.log as unknown as EditLog;
  const problems = validateDraftShape(log.base);
  if (
    problems.length > 0 ||
    !Array.isArray(log.edits) ||
    !Number.isSafeInteger(log.cursor) ||
    log.cursor < 0 ||
    log.cursor > log.edits.length
  ) {
    throw new PersistenceError("INVALID_DRAFT", [...problems, "bad edits/cursor"].join("; "));
  }
  assertNoFloats(log);
  return log;
}
