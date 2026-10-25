import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FlattenedPartSchema,
  PlatformSchema,
  ReferenceDesignLoadoutSchema,
  ShipTypeRecordSchema,
  SlotTemplateSchema,
  decodeStrict,
  parseYamlSafe,
  type FlattenedPart,
  type PlatformData,
  type ReferenceDesignLoadoutData,
  type ShipTypeRecord,
  type ShipTypeRequirement,
  type SlotTemplateData,
} from "@bluewave/content-schema";
import { canonicalSerialize } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { partCatalogue, compileDesign, compileTorpedo } from "../src/index.js";
import { compileDesignFromLoadout } from "../src/compile.js";
import { nationalContext, readReferenceDesignEntries } from "./helpers/earlyContext.js";

const root = join(import.meta.dirname, "..", "..", "..", "content", "production", "1880");
const shipBuilding = join(root, "ship-building");

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
const shipTypeRecords: ShipTypeRecord[] = (
  readYaml(join(shipBuilding, "ship-types.yaml"))["shipTypes"] as unknown[]
).map((record) => decodeStrict(ShipTypeRecordSchema, record));

const catalogue = partCatalogue({ parts, slotTemplates, platforms });
const legacyById = new Map(readReferenceDesignEntries().map((d) => [d.id, d] as const));

describe("production parts content → compile (ticket 11d)", () => {
  it("carries the staged plan: 323 parts, 11 slot templates, 8 platforms, 95 loadouts", () => {
    expect(parts).toHaveLength(323);
    expect(slotTemplates).toHaveLength(11);
    expect(platforms).toHaveLength(8);
    expect(loadouts).toHaveLength(95);
    for (const loadout of loadouts) {
      expect(legacyById.has(loadout.id), loadout.id).toBe(true);
    }
  });

  it("carries the eight torpedo parts and resolves the DQ-TORPEDO-001 forPart cross-references", () => {
    const torpedoes = parts.filter((p) => p.family === "torpedo");
    expect(torpedoes.map((p) => p.id)).toEqual([
      "ger_533mm_g7a_1934",
      "ger_533mm_g7e_1936",
      "jpn_61cm_type93_1935",
      "rn_21in_mk_iv_1916",
      "rn_21in_mk_viii_1927",
      "usn_21in_mk14_1931",
      "whitehead_14in_1886",
      "whitehead_18in_1894",
    ]);
    const byId = new Map(parts.map((p) => [p.id, p] as const));
    let waivers = 0;
    for (const launcher of parts.filter((p) => p.family === "torpedo_launcher")) {
      for (const exception of launcher.legacyExceptions ?? []) {
        waivers += 1;
        expect(byId.get(exception.forPart)?.family, exception.forPart).toBe("torpedo");
      }
    }
    expect(waivers).toBe(5);
    expect(byId.get("whitehead_14in_1886")?.revisions.map((r) => r.from)).toEqual(["1884-01"]);
  });

  it("seam: production content → torpedo part → CompiledTorpedo for the 1884 Whitehead", () => {
    const whitehead = parts.find((p) => p.id === "whitehead_14in_1886");
    expect(whitehead).toBeDefined();
    const before = compileTorpedo(whitehead!, "1883-12");
    const after = compileTorpedo(whitehead!, "1884-01");
    expect(before.ok && before.value.warheadExplosiveEquivalentMassKg).toBe(12);
    expect(after.ok && after.value.revision).toBe("1884-01");
    expect(after.ok && after.value.warheadExplosiveEquivalentMassKg).toBe(27);
    expect(after.ok && after.value.partId).toBe("whitehead_14in_1886");
  });

  it("compiles every activated design through the barrier and matches the legacy compile", () => {
    const partOf = new Map(parts.map((p) => [p.id, p] as const));
    const placementFamilies = new Set(["gun_mount", "torpedo_launcher", "fitting", "sensor"]);
    let placements = 0;
    for (const loadout of loadouts) {
      placements += loadout.loadout.entries.filter((e) => {
        const part = partOf.get(e.part);
        return part !== undefined && placementFamilies.has(part.family);
      }).length;
      const result = compileDesignFromLoadout({
        designId: loadout.id,
        header: loadout.header,
        loadout: loadout.loadout,
        catalogue,
        month: loadout.month,
        conditions: { nation: { nationId: loadout.header.nation } },
        ctx: nationalContext(loadout.month, loadout.header.nation),
      });
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
      for (const component of result.compiled.components) {
        if (component.category !== "TORPEDO_TUBE" || component.torpedoMount === null) continue;
        expect(
          component.torpedoMount.compiledTorpedo,
          `${loadout.id}:${component.instanceId}`,
        ).toBeDefined();
      }
    }
    expect(placements).toBe(871);
  });

  it("executes the four D17 designs through the production barrier and pins their central batteries", () => {
    const d17 = new Set(["redoutable_1878", "kaiser_1875", "sachsen_1878", "mesudiye_1875"]);
    const expected: Record<string, number> = {
      redoutable_1878: 2,
      kaiser_1875: 2,
      sachsen_1878: 2,
      mesudiye_1875: 3,
    };
    for (const loadout of loadouts.filter((l) => d17.has(l.id))) {
      const central = loadout.loadout.entries.filter((entry) =>
        entry.part.includes("_central_battery_"),
      );
      expect(central, loadout.id).toHaveLength(expected[loadout.id]!);
      const result = compileDesignFromLoadout({
        designId: loadout.id,
        header: loadout.header,
        loadout: loadout.loadout,
        catalogue,
        month: loadout.month,
        conditions: { nation: { nationId: loadout.header.nation } },
        ctx: nationalContext(loadout.month, loadout.header.nation),
      });
      expect(result.status, loadout.id).toBe("ACCEPTED");
    }
  });

  it("rejects an activated loadout that does not fit, exposing no derived metric", () => {
    const loadout = loadouts[0]!;
    const broken = {
      ...loadout.loadout,
      entries: loadout.loadout.entries.map((entry) =>
        entry.params?.["installedKw"] === undefined
          ? entry
          : { ...entry, params: { installedKw: 99_999_999 } },
      ),
    };
    const result = compileDesignFromLoadout({
      designId: loadout.id,
      header: loadout.header,
      loadout: broken,
      catalogue,
      month: loadout.month,
      conditions: { nation: { nationId: loadout.header.nation } },
      ctx: nationalContext(loadout.month, loadout.header.nation),
    });
    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED" || result.status === "NOT_EVALUABLE") {
      expect(result.findings.length).toBeGreaterThan(0);
      expect(Object.hasOwn(result, "compiled")).toBe(false);
    }
  });

  it("rejects a design whose intended type requires a slot the loadout does not fill (SPM-R12)", () => {
    const loadout = loadouts[0]!;
    const requirement: ShipTypeRequirement = {
      slot: "not_a_real_slot",
      interface: "gun_mount",
      constraints: {},
    };
    const shipTypes = shipTypeRecords.map((record) => ({
      ...record,
      classification: { ...record.classification, requires: [requirement] },
    }));
    const result = compileDesignFromLoadout({
      designId: loadout.id,
      header: loadout.header,
      loadout: loadout.loadout,
      catalogue,
      month: loadout.month,
      conditions: { nation: { nationId: loadout.header.nation } },
      ctx: { ...nationalContext(loadout.month, loadout.header.nation), shipTypes },
    });
    expect(result.status).toBe("REJECTED");
    if (result.status === "REJECTED" || result.status === "NOT_EVALUABLE") {
      expect(result.findings.map((f) => f.id)).toContain("TYPE_REQUIRES_SLOT_MISSING");
      expect(Object.hasOwn(result, "compiled")).toBe(false);
    }
  });
});
