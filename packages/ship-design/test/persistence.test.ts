import { describe, it, expect } from "vite-plus/test";
import { readFileSync } from "node:fs";
import {
  encodeDesignFile,
  applyEdit,
  EditError,
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
  type ArmourRegion,
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

describe("schema v2: armour regions fold (ADR-0232, ADR-0233)", () => {
  type Region = {
    region: string;
    thicknessUm: number;
    lengthMm: number;
    heightMm: number;
    materialId: string;
    cosObliquityBp: number;
  };
  const reg = (region: string, o: Partial<Region> = {}): Region => ({
    region,
    thicknessUm: 100_000,
    lengthMm: 4_000,
    heightMm: 2_500,
    materialId: "iron",
    cosObliquityBp: 10_000,
    ...o,
  });
  const v1File = (regions: Region[]) =>
    JSON.stringify({
      format: "bwdesign",
      schemaVersion: 1,
      draft: { ...draft, armour: { ...draft.armour, regions } },
      componentHashes: {},
      compiledHash: null,
    });
  const decodeRegions = (regions: Region[]) => {
    const d = decodeDesignFile(v1File(regions), ctx.catalogue);
    return d.draft.armour.regions as readonly Region[];
  };
  const turret = (regions: Region[]) => decodeRegions(regions).filter((r) => r.region === "TURRET");

  it("is schema 2, and a v1 file migrates", () => {
    expect(DESIGN_SCHEMA_VERSION).toBe(2);
    const d = decodeDesignFile(v1File([reg("DECK_MAIN")]), ctx.catalogue);
    expect(d.migratedFrom).toBe(1);
    expect(d.schemaVersion).toBe(2);
  });
  it("renames a lone TURRET_FACE or lone BARBETTE to TURRET, unchanged", () => {
    expect(turret([reg("TURRET_FACE", { thicknessUm: 203_000, materialId: "compound" })])).toEqual([
      reg("TURRET", { thicknessUm: 203_000, materialId: "compound" }),
    ]);
    expect(turret([reg("BARBETTE", { lengthMm: 6_000, cosObliquityBp: 8_660 })])).toEqual([
      reg("TURRET", { lengthMm: 6_000, cosObliquityBp: 8_660 }),
    ]);
  });
  it("merges both: per-field maximum for size, material and incline from the thicker source", () => {
    const merged = turret([
      reg("TURRET_FACE", {
        thicknessUm: 200_000,
        lengthMm: 9_000,
        heightMm: 2_000,
        materialId: "iron",
        cosObliquityBp: 8_660,
      }),
      reg("BARBETTE", {
        thicknessUm: 250_000,
        lengthMm: 6_000,
        heightMm: 3_000,
        materialId: "compound",
        cosObliquityBp: 10_000,
      }),
    ]);
    expect(merged).toEqual([
      reg("TURRET", {
        thicknessUm: 250_000,
        lengthMm: 9_000,
        heightMm: 3_000,
        materialId: "compound",
        cosObliquityBp: 10_000,
      }),
    ]);
    const other = turret([
      reg("TURRET_FACE", { thicknessUm: 300_000, materialId: "iron", cosObliquityBp: 8_660 }),
      reg("BARBETTE", { thicknessUm: 250_000, materialId: "compound", cosObliquityBp: 10_000 }),
    ]);
    expect([other[0]!.materialId, other[0]!.cosObliquityBp, other[0]!.thicknessUm]).toEqual([
      "iron",
      8_660,
      300_000,
    ]);
  });
  it("breaks an equal-thickness tie by the lexicographically smaller material id, either order", () => {
    const a = reg("TURRET_FACE", { materialId: "nickel_steel", cosObliquityBp: 8_660 });
    const b = reg("BARBETTE", { materialId: "compound", cosObliquityBp: 10_000 });
    for (const regions of [
      [a, b],
      [b, a],
    ]) {
      const [t] = turret(regions);
      expect([t!.materialId, t!.cosObliquityBp]).toEqual(["compound", 10_000]);
    }
  });
  it("leaves no BARBETTE or TURRET_FACE, and one TURRET at most", () => {
    const out = decodeRegions([reg("BARBETTE"), reg("DECK_MAIN"), reg("TURRET_FACE")]);
    expect(out.map((r) => r.region)).toEqual(["TURRET", "DECK_MAIN"]);
  });
  it("is deterministic, does not mutate its input, and does not re-migrate a v2 file", () => {
    const text = v1File([reg("BARBETTE"), reg("TURRET_FACE", { thicknessUm: 90_000 })]);
    const before = text;
    const once = decodeDesignFile(text, ctx.catalogue);
    expect(decodeDesignFile(text, ctx.catalogue).draft).toEqual(once.draft);
    expect(text).toBe(before);
    const reEncoded = encodeDesignFile(once.draft, ctx.catalogue, null);
    const again = decodeDesignFile(reEncoded, ctx.catalogue);
    expect(again.migratedFrom).toBeNull();
    expect(again.draft).toEqual(once.draft);
  });
  it("rejects a malformed armour record rather than producing a partial design", () => {
    const bad = JSON.stringify({
      format: "bwdesign",
      schemaVersion: 1,
      draft: { ...draft, armour: { ...draft.armour, regions: [{ region: "BARBETTE" }] } },
    });
    expect(() => decodeDesignFile(bad, ctx.catalogue)).toThrow(PersistenceError);
  });
  it("round-trips a v2 design: encode, decode, encode is stable and emits no BARBETTE", () => {
    const v2 = (region: ArmourRegion["region"], o: Partial<ArmourRegion> = {}): ArmourRegion => ({
      region,
      thicknessUm: 100_000,
      lengthMm: 4_000,
      heightMm: 2_500,
      materialId: "iron",
      cosObliquityBp: 10_000,
      ...o,
    });
    const d2: typeof draft = {
      ...draft,
      armour: {
        ...draft.armour,
        regions: [
          v2("DECK_EXTENDED"),
          v2("TURRET"),
          v2("TURRET_TOP"),
          v2("SECONDARY_GUN", { materialId: "compound" }),
        ],
      },
    };
    const text = encodeDesignFile(d2, ctx.catalogue, null);
    const back = decodeDesignFile(text, ctx.catalogue);
    expect(back.draft).toEqual(d2);
    expect(encodeDesignFile(back.draft, ctx.catalogue, null)).toBe(text);
    expect(text).not.toContain("BARBETTE");
    expect(JSON.parse(text).schemaVersion).toBe(2);
  });
  it("migrates a hand-authored v1 save file whole, preserving everything outside armour", () => {
    const fixture = readFileSync(
      new URL("./fixtures/v1-ironclad-turret-and-barbette.bwdesign.json", import.meta.url),
      "utf8",
    );
    const d = decodeDesignFile(fixture, ctx.catalogue);
    const original = JSON.parse(fixture).draft;
    expect(d.migratedFrom).toBe(1);
    expect({ ...d.draft, armour: undefined }).toEqual({ ...original, armour: undefined });
    expect(d.draft.armour.regions.map((r) => r.region)).toEqual([
      "BELT_MAIN",
      "DECK_MAIN",
      "TURRET",
      "MAGAZINE_BOX",
    ]);
    expect(d.draft.armour.regions.find((r) => r.region === "TURRET")).toEqual({
      region: "TURRET",
      thicknessUm: 254_000,
      lengthMm: 6_000,
      heightMm: 3_000,
      materialId: "compound",
      cosObliquityBp: 10_000,
    });
    expect(d.draft.armour.citadelLengthMm).toBe(original.armour.citadelLengthMm);
  });
  it("folds regions in a v1 edit log (base and edits) so autosaved drafts still open", () => {
    const logText = JSON.stringify({
      format: "bwdesign-log",
      schemaVersion: 1,
      log: {
        base: { ...draft, armour: { ...draft.armour, regions: [reg("BARBETTE")] } },
        edits: [
          { kind: "set_armour_region", region: reg("TURRET_FACE", { thicknessUm: 120_000 }) },
          { kind: "remove_armour_region", region: "BARBETTE" },
          { kind: "set_armour_regions", regions: [reg("BARBETTE"), reg("DECK_MAIN")] },
        ],
        cursor: 3,
      },
    });
    const log = decodeLog(logText);
    expect(JSON.stringify(log)).not.toMatch(/BARBETTE|TURRET_FACE/);
    expect(currentDraft(log).armour.regions.map((r) => r.region)).toEqual(["TURRET", "DECK_MAIN"]);
    expect(log.edits).toEqual([]);
  });
});

describe("engine priority in the design file", () => {
  const withPriority = (v: unknown) =>
    JSON.stringify({
      format: "bwdesign",
      schemaVersion: 2,
      draft: { ...draft, machinery: { ...draft.machinery, enginePriorityBp: v } },
      componentHashes: {},
      compiledHash: null,
    });
  it("round-trips an in-range priority and refuses one off the axis or non-integer", () => {
    const d = decodeDesignFile(withPriority(-4_000), ctx.catalogue);
    expect(d.draft.machinery.enginePriorityBp).toBe(-4_000);
    for (const bad of [10_001, -10_001, 1.5, "fast"])
      expect(() => decodeDesignFile(withPriority(bad), ctx.catalogue)).toThrow(PersistenceError);
  });
});

describe("fire control in the design file", () => {
  const withFc = (v: unknown) =>
    JSON.stringify({
      format: "bwdesign",
      schemaVersion: 2,
      draft: { ...draft, fireControl: v },
      componentHashes: {},
      compiledHash: null,
    });
  it("round-trips a position count and refuses a malformed one", () => {
    expect(decodeDesignFile(withFc({ positions: 3 }), ctx.catalogue).draft.fireControl).toEqual({
      positions: 3,
    });
    for (const bad of [{ positions: -1 }, { positions: 1.5 }, { positions: "2" }, 4])
      expect(() => decodeDesignFile(withFc(bad), ctx.catalogue)).toThrow(PersistenceError);
  });
});

describe("freeboard profile in the design file", () => {
  const withProfile = (v: unknown) =>
    JSON.stringify({
      format: "bwdesign",
      schemaVersion: 2,
      draft: { ...draft, hull: { ...draft.hull, freeboardProfile: v } },
      componentHashes: {},
      compiledHash: null,
    });
  it("round-trips NORMAL and LOW and refuses anything else", () => {
    for (const ok of ["NORMAL", "LOW"] as const)
      expect(decodeDesignFile(withProfile(ok), ctx.catalogue).draft.hull.freeboardProfile).toBe(ok);
    for (const bad of ["HIGH", "low", 1, null])
      expect(() => decodeDesignFile(withProfile(bad), ctx.catalogue)).toThrow(PersistenceError);
  });
});

describe("tertiary battery in the design file and edits", () => {
  const withTertiary = (v: unknown) =>
    JSON.stringify({
      format: "bwdesign",
      schemaVersion: 2,
      draft: { ...draft, tertiary: v },
      componentHashes: {},
      compiledHash: null,
    });
  it("round-trips a battery and refuses a malformed one", () => {
    expect(
      decodeDesignFile(withTertiary({ caliberUm: 57_000, count: 6 }), ctx.catalogue).draft.tertiary,
    ).toEqual({ caliberUm: 57_000, count: 6 });
    for (const bad of [
      { caliberUm: 0, count: 1 },
      { caliberUm: 57_000, count: -1 },
      { caliberUm: 57_000.5, count: 1 },
      { caliberUm: 57_000 },
      5,
    ])
      expect(() => decodeDesignFile(withTertiary(bad), ctx.catalogue)).toThrow(PersistenceError);
  });
  it("set_tertiary sets, and a null battery removes it", () => {
    const set = applyEdit(draft, {
      kind: "set_tertiary",
      tertiary: { caliberUm: 47_000, count: 8 },
    });
    expect(set.tertiary).toEqual({ caliberUm: 47_000, count: 8 });
    expect(applyEdit(set, { kind: "set_tertiary", tertiary: null }).tertiary).toBeUndefined();
    expect(() =>
      applyEdit(draft, { kind: "set_tertiary", tertiary: { caliberUm: 47_000, count: 1.5 } }),
    ).toThrow(EditError);
  });
});
