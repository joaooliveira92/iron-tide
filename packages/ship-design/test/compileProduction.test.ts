import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FlattenedPartSchema,
  PlatformSchema,
  ReferenceDesignLoadoutSchema,
  SlotTemplateSchema,
  decodeStrict,
  parseYamlSafe,
  type FlattenedPart,
  type ReferenceDesignLoadoutData,
  type SlotTemplateData,
  type PlatformData,
} from "@bluewave/content-schema";
import { canonicalSerialize } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  buildProductionPartModel,
  compileDesign,
  compileDesignFromLoadout,
  type ProductionCompile,
  type ProductionPartModel,
} from "../src/index.js";
import { nationalContext, readReferenceDesignEntries } from "./helpers/earlyContext.js";

const shipBuilding = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "content",
  "production",
  "1880",
  "ship-building",
);

function readYaml(path: string): Record<string, unknown> {
  const collector = { addError: () => undefined, hasErrors: false } as never;
  const parsed = parseYamlSafe(readFileSync(path, "utf8"), path, collector);
  if (!parsed.success) throw new Error(`bad YAML: ${path}`);
  return parsed.data as Record<string, unknown>;
}

const parts: FlattenedPart[] = readdirSync(join(shipBuilding, "parts"))
  .filter((name) => name.endsWith(".yaml"))
  .flatMap((name) =>
    (readYaml(join(shipBuilding, "parts", name))["parts"] as unknown[]).map((record) =>
      decodeStrict(FlattenedPartSchema, record),
    ),
  );
const platforms: PlatformData[] = (
  readYaml(join(shipBuilding, "platforms.yaml"))["platforms"] as unknown[]
).map((record) => decodeStrict(PlatformSchema, record));
const slotTemplates: SlotTemplateData[] = (
  readYaml(join(shipBuilding, "slot-templates.yaml"))["slotTemplates"] as unknown[]
).map((record) => decodeStrict(SlotTemplateSchema, record));
const loadouts: ReferenceDesignLoadoutData[] = readdirSync(join(shipBuilding, "design-loadouts"))
  .filter((name) => name.endsWith(".yaml"))
  .flatMap((name) =>
    (readYaml(join(shipBuilding, "design-loadouts", name))["designs"] as unknown[]).map((record) =>
      decodeStrict(ReferenceDesignLoadoutSchema, record),
    ),
  );

const model = buildProductionPartModel({ parts, slotTemplates, platforms });
const legacyById = new Map(readReferenceDesignEntries().map((d) => [d.id, d] as const));

function stripCompiledTorpedo(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripCompiledTorpedo);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      if (key === "compiledTorpedo" || key === "hash") continue;
      out[key] = stripCompiledTorpedo(inner);
    }
    return out;
  }
  return value;
}

const compile = (
  loadout: ReferenceDesignLoadoutData,
  partModel: ProductionPartModel = model,
): ProductionCompile =>
  compileDesignFromLoadout({
    designId: loadout.id,
    header: loadout.header,
    loadout: loadout.loadout,
    model: partModel,
    month: loadout.month,
    nation: { nationId: loadout.header.nation },
    ctx: nationalContext(loadout.month, loadout.header.nation),
  });

describe("production compile from a parts loadout (ticket 11d)", () => {
  it("compiles every production design through the barrier and matches the legacy result", () => {
    for (const loadout of loadouts) {
      const result = compile(loadout);
      expect(result.status, loadout.id).toBe("ACCEPTED");
      if (result.status !== "ACCEPTED") continue;
      const legacy = legacyById.get(loadout.id)!;
      const legacyCompiled = compileDesign(
        legacy.draft,
        nationalContext(loadout.month, legacy.draft.nationId),
      );
      expect(canonicalSerialize(stripCompiledTorpedo(result.compiled)), loadout.id).toBe(
        canonicalSerialize(stripCompiledTorpedo(legacyCompiled)),
      );
    }
  });

  it("exposes no derived metric for a loadout that does not fit", () => {
    const loadout = loadouts[0]!;
    const broken = {
      ...loadout.loadout,
      entries: loadout.loadout.entries.map((entry) =>
        entry.params?.["installedKw"] === undefined
          ? entry
          : { ...entry, params: { installedKw: 99_999_999 } },
      ),
    };
    const result = compile({ ...loadout, loadout: broken });
    expect(result.status).toBe("REJECTED");
    if (result.status !== "REJECTED") return;
    expect(result.findings.length).toBeGreaterThan(0);
    expect("compiled" in result).toBe(false);
  });

  it("refuses a loadout whose part the resolver cannot read", () => {
    const loadout = loadouts[0]!;
    const unknown = {
      ...loadout.loadout,
      entries: loadout.loadout.entries.map((entry) =>
        entry.part === loadout.loadout.entries[0]!.part
          ? { ...entry, part: "no_such_part" }
          : entry,
      ),
    };
    const result = compile({ ...loadout, loadout: unknown });
    expect(result.status).toBe("UNTRANSLATED");
    if (result.status !== "UNTRANSLATED") return;
    expect(result.issues.map((i) => i.code)).toContain("RESOLVE_UNKNOWN_PART");
  });

  it("a visual-only change leaves every derived metric and the compiled design identical (I-14)", () => {
    const loadout = loadouts[0]!;
    const baseline = compile(loadout);
    expect(baseline.status).toBe("ACCEPTED");
    if (baseline.status !== "ACCEPTED") return;
    const target = loadout.loadout.entries[0]!.part;
    const withVisual = parts.map((part) =>
      part.id === target
        ? {
            ...part,
            visual: { traits: { enclosure: { value: "enclosed" as const, reason: "I-14" } } },
          }
        : part,
    );
    const result = compile(
      loadout,
      buildProductionPartModel({ parts: withVisual, slotTemplates, platforms }),
    );
    expect(result.status).toBe("ACCEPTED");
    if (result.status !== "ACCEPTED") return;
    expect(canonicalSerialize(result.compiled)).toBe(canonicalSerialize(baseline.compiled));
  });

  it("derives the ledger from the same part record the fit validated", () => {
    const loadout = loadouts[0]!;
    const baseline = compile(loadout);
    expect(baseline.status).toBe("ACCEPTED");
    if (baseline.status !== "ACCEPTED") return;
    const entry = loadout.loadout.entries.find((e) => {
      if ((e.mountCount ?? 1) !== 1) return false;
      const part = model.partOf(e.part);
      return part?.quantities.some((q) => q.kind === "massKg" && q.basis === "PER_PART_UNIT");
    });
    expect(entry, "a singly-mounted part with a mass quantity").toBeDefined();
    if (entry === undefined) return;
    const part = model.partOf(entry.part)!;
    const deltaKg = 1234;
    const heavier = parts.map((p) =>
      p.id === part.id
        ? {
            ...p,
            quantities: p.quantities.map((q) =>
              q.kind === "massKg" && q.basis === "PER_PART_UNIT"
                ? { ...q, value: q.value + deltaKg }
                : q,
            ),
          }
        : p,
    );
    const result = compile(
      loadout,
      buildProductionPartModel({ parts: heavier, slotTemplates, platforms }),
    );
    expect(result.status).toBe("ACCEPTED");
    if (result.status !== "ACCEPTED") return;
    const before = baseline.compiled.components.find((c) => c.instanceId === entry.id)!;
    const after = result.compiled.components.find((c) => c.instanceId === entry.id)!;
    expect(after.weightKg - before.weightKg).toBe(deltaKg);
  });

  it("rejects a part the model makes unavailable, so fit and ledger cannot disagree", () => {
    const loadout = loadouts[0]!;
    const target = loadout.loadout.entries[0]!.part;
    const unavailable = parts.map((part) =>
      part.id === target
        ? { ...part, lifecycle: { ...part.lifecycle, availableFrom: "9999-01" } }
        : part,
    );
    const result = compile(
      loadout,
      buildProductionPartModel({ parts: unavailable, slotTemplates, platforms }),
    );
    expect(result.status).toBe("REJECTED");
    if (result.status !== "REJECTED") return;
    expect(result.findings.map((f) => f.id)).toContain("FIT_NOT_YET_AVAILABLE");
    expect(Object.hasOwn(result, "compiled")).toBe(false);
  });
});
