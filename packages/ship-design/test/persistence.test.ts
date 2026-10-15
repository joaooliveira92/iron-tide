import { describe, it, expect } from "vite-plus/test";
import {
  encodeDesignFile,
  decodeDesignFile,
  decodeCompiled,
  verifyCompiledHash,
  compileDesign,
  componentHash,
  assertNoFloats,
  PersistenceError,
  newLog,
  pushEdit,
  undo,
  redo,
  canUndo,
  canRedo,
  currentDraft,
  compact,
  encodeLog,
  decodeLog,
  DESIGN_SCHEMA_VERSION,
  type DraftEdit,
  type Migration,
} from "../src/index.js";
import { ctx, draft } from "./fixtures/gunboat.js";

const compiled = compileDesign(draft, ctx);

describe("design file", () => {
  const text = encodeDesignFile(draft, ctx.catalogue, compiled);
  it("round-trips the draft exactly, with a stable canonical encoding", () => {
    const d = decodeDesignFile(text, ctx.catalogue);
    expect(d.draft).toEqual(draft);
    expect(d.schemaVersion).toBe(DESIGN_SCHEMA_VERSION);
    expect(d.migratedFrom).toBeNull();
    expect(d.contentDrift).toEqual([]);
    expect(d.compiledHash).toBe(compiled.hash);
    expect(encodeDesignFile(d.draft, ctx.catalogue, compiled)).toBe(text);
    expect(compileDesign(d.draft, ctx).hash).toBe(compiled.hash);
  });
  it("detects content drift (changed or missing component definitions)", () => {
    const changed = ctx.catalogue.map((c) =>
      c.id === "qf_47in" ? { ...c, weightKg: "3000 * barrels + 1500" } : c,
    );
    expect(decodeDesignFile(text, changed).contentDrift).toEqual(["qf_47in"]);
    const missing = ctx.catalogue.filter((c) => c.id !== "tube_14in");
    expect(decodeDesignFile(text, missing).contentDrift).toEqual(["tube_14in"]);
    expect(componentHash(ctx.catalogue[0]!)).toMatch(/^[0-9a-f]{64}$/);
  });
  it("migrates older schemas forward, refuses newer ones, and errors on a missing migration", () => {
    const v0 = JSON.stringify({
      format: "bwdesign",
      schemaVersion: 0,
      draft: {
        ...draft,
        placements: draft.placements.map(({ zoneId, ...p }) => ({ ...p, zone: zoneId })),
      },
      componentHashes: {},
      compiledHash: null,
    });
    const mig: Migration = (raw) => {
      const d = raw.draft as { placements: Record<string, unknown>[] };
      return {
        ...raw,
        schemaVersion: 1,
        draft: { ...d, placements: d.placements.map(({ zone, ...p }) => ({ ...p, zoneId: zone })) },
      };
    };
    const d = decodeDesignFile(v0, ctx.catalogue, { 0: mig });
    expect(d.migratedFrom).toBe(0);
    expect(d.draft.placements).toEqual(draft.placements);
    expect(() => decodeDesignFile(v0, ctx.catalogue)).toThrowError(/no migration/);
    const future = JSON.stringify({ format: "bwdesign", schemaVersion: 99, draft });
    try {
      decodeDesignFile(future, ctx.catalogue);
      throw new Error("no throw");
    } catch (e) {
      expect((e as PersistenceError).code).toBe("UNSUPPORTED_FUTURE_VERSION");
    }
  });
  it("rejects garbage, floats and malformed drafts", () => {
    const code = (s: string) => {
      try {
        decodeDesignFile(s, ctx.catalogue);
        return "none";
      } catch (e) {
        return (e as PersistenceError).code;
      }
    };
    expect(code("{")).toBe("BAD_JSON");
    expect(code("[]")).toBe("BAD_FORMAT");
    expect(code(JSON.stringify({ format: "other", schemaVersion: 1 }))).toBe("BAD_FORMAT");
    expect(code(text.replace('"installedKw":3300', '"installedKw":3300.5'))).toBe("FLOAT_IN_STATE");
    expect(
      code(JSON.stringify({ format: "bwdesign", schemaVersion: 1, draft: { nationId: "x" } })),
    ).toBe("INVALID_DRAFT");
    const dup = { ...draft, placements: [draft.placements[0]!, draft.placements[0]!] };
    expect(
      code(
        JSON.stringify({ format: "bwdesign", schemaVersion: 1, draft: dup, componentHashes: {} }),
      ),
    ).toBe("INVALID_DRAFT");
  });
  it("refuses to encode state containing floats", () => {
    expect(() =>
      encodeDesignFile(
        { ...draft, machinery: { ...draft.machinery, installedKw: 1.5 } },
        ctx.catalogue,
        null,
      ),
    ).toThrowError(PersistenceError);
    expect(() => assertNoFloats({ a: [1, { b: 2.5 }] })).toThrow();
    expect(() => assertNoFloats({ a: [1, { b: 2 }] })).not.toThrow();
  });
});

describe("compiled design", () => {
  it("round-trips and verifies its own hash; tampering is detected", () => {
    const text = JSON.stringify(compiled);
    expect(verifyCompiledHash(compiled)).toBe(true);
    expect(decodeCompiled(text).hash).toBe(compiled.hash);
    expect(decodeCompiled(text)).toEqual(JSON.parse(text));
    const tampered = text.replace(
      `"totalKg":${compiled.totalKg}`,
      `"totalKg":${compiled.totalKg - 1}`,
    );
    expect(() => decodeCompiled(tampered)).toThrowError(/hash/);
  });
});

describe("edit log (undo/redo)", () => {
  const e1: DraftEdit = { kind: "set_machinery", patch: { installedKw: 3_000 } };
  const e2: DraftEdit = { kind: "remove_placement", instanceId: "rf" };
  const e3: DraftEdit = { kind: "set_hull", patch: { designMarginBp: 500 as never } };
  it("undo and redo walk the history; a new edit discards the redo tail", () => {
    let log = newLog(draft);
    expect(canUndo(log)).toBe(false);
    log = pushEdit(pushEdit(log, e1), e2);
    expect(currentDraft(log).machinery.installedKw).toBe(3_000);
    expect(currentDraft(log).placements.some((p) => p.instanceId === "rf")).toBe(false);
    log = undo(log);
    expect(currentDraft(log).placements.some((p) => p.instanceId === "rf")).toBe(true);
    expect(canRedo(log)).toBe(true);
    expect(currentDraft(redo(log)).placements.some((p) => p.instanceId === "rf")).toBe(false);
    log = pushEdit(log, e3);
    expect(canRedo(log)).toBe(false);
    expect(log.edits).toHaveLength(2);
    expect(currentDraft(undo(undo(undo(log))))).toEqual(draft);
    expect(undo(newLog(draft))).toEqual(newLog(draft));
  });
  it("rejects an edit that cannot apply without changing the log", () => {
    const log = newLog(draft);
    expect(() => pushEdit(log, { kind: "remove_placement", instanceId: "ghost" })).toThrow();
    expect(log.edits).toHaveLength(0);
  });
  it("compaction keeps the current draft and bounds the log", () => {
    let log = newLog(draft);
    for (let i = 0; i < 12; i++)
      log = pushEdit(log, { kind: "set_machinery", patch: { installedKw: 3_000 + i } }, 5);
    expect(log.edits.length).toBeLessThanOrEqual(5);
    expect(currentDraft(log).machinery.installedKw).toBe(3_011);
    const small = compact(pushEdit(pushEdit(newLog(draft), e1), e3), 1);
    expect(currentDraft(small)).toEqual(currentDraft(pushEdit(pushEdit(newLog(draft), e1), e3)));
  });
  it("serialises and restores including the cursor", () => {
    let log = pushEdit(pushEdit(newLog(draft), e1), e2);
    log = undo(log);
    const back = decodeLog(encodeLog(log));
    expect(back).toEqual(log);
    expect(currentDraft(back)).toEqual(currentDraft(log));
    expect(() =>
      decodeLog(
        JSON.stringify({
          format: "bwdesign-log",
          schemaVersion: 1,
          log: { base: draft, edits: [], cursor: 3 },
        }),
      ),
    ).toThrow();
    expect(() => decodeLog("nope")).toThrow();
  });
});
