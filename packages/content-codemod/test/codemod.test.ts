import { FlattenedPartSchema, decodeStrict } from "@bluewave/content-schema";
import type { FlattenedPart } from "@bluewave/content-schema";
import { PART_SOURCE_FIELDS } from "@bluewave/ship-design";
import { describe, expect, it } from "vite-plus/test";
import { canonicalSerialize } from "@bluewave/deterministic";
import { fromYaml } from "../src/yaml.js";
import { planFromLegacy, planFromStaged } from "../src/index.js";
import { components, legacySource } from "./helpers/production.js";
import type { LegacySource } from "../src/types.js";
import type { MigrationFailure } from "../src/failure.js";

const planned = (() => {
  const result = planFromLegacy(legacySource);
  if (!result.ok) throw new Error(JSON.stringify(result.failures));
  return result.value;
})();

const partsById = ((): ReadonlyMap<string, FlattenedPart> => {
  const map = new Map<string, FlattenedPart>();
  for (const file of planned.files.filter((f) => f.path.startsWith("parts/"))) {
    const records = (fromYaml(file.content) as { parts: unknown[] }).parts;
    for (const record of records) {
      const part = decodeStrict(FlattenedPartSchema, record);
      map.set(part.id, part);
    }
  }
  return map;
})();

const failuresOf = (source: LegacySource): readonly MigrationFailure[] => {
  const result = planFromLegacy(source);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.failures;
};

const WEAPON_GUN = new Set(["MAIN_GUN", "SECONDARY_GUN", "DUAL_PURPOSE_GUN", "AA_WEAPON"]);
const categoryOf = (id: string) => components.find((c) => c.id === id)?.category;

describe("content codemod planner (ticket 11c)", () => {
  it("migrates the whole catalogue and every design", () => {
    expect(planned.manifest.records.parts).toBe(319);
    expect(planned.manifest.records.designs).toBe(93);
    expect(planned.manifest.records.placements).toBe(836);
    expect(planned.manifest.records.gunPlacements).toBe(233);
    expect(planned.manifest.records.tubePlacements).toBe(30);
    expect(planned.manifest.records.fittingPlacements).toBe(573);
    const familyTotal = Object.values(planned.manifest.records.partsByFamily).reduce(
      (a, b) => a + b,
      0,
    );
    expect(familyTotal).toBe(319);
    expect(planned.manifest.records.partsByFamily.torpedo).toBe(8);
    expect(planned.designs).toHaveLength(93);
  });

  it("generates the eight torpedo parts, including the 1884 Whitehead revision", () => {
    const file = planned.files.find((f) => f.path === "parts/torpedo.yaml");
    expect(file).toBeDefined();
    const records = (fromYaml(file!.content) as { parts: unknown[] }).parts.map((record) =>
      decodeStrict(FlattenedPartSchema, record),
    );
    expect(records.map((r) => r.id)).toEqual([
      "ger_533mm_g7a_1934",
      "ger_533mm_g7e_1936",
      "jpn_61cm_type93_1935",
      "rn_21in_mk_iv_1916",
      "rn_21in_mk_viii_1927",
      "usn_21in_mk14_1931",
      "whitehead_14in_1886",
      "whitehead_18in_1894",
    ]);
    const whitehead = records.find((r) => r.id === "whitehead_14in_1886")!;
    expect(whitehead.family).toBe("torpedo");
    expect(whitehead.revisions.map((r) => r.from)).toEqual(["1884-01"]);
  });

  it("records the three independent data-quality counts, unmixed", () => {
    const dq = planned.manifest.dataQuality;
    expect(dq.unresolvedArmamentPlacements).toBe(165);
    expect(dq.unresolvedMagazineRelationships).toBe(0);
    expect(dq.waivers).toBe(0);
    expect(dq.centralBatteryPlacements).toBe(9);
    expect(dq.launcherVariants).toBe(17);
    expect(dq.waivedLauncherRecords).toBe(5);
    expect(dq.torpedoEntriesAffected).toBe(9);
  });

  it("emits a manifest with schema, source identity, paths, counts and hashes", () => {
    const manifest = planned.manifest;
    expect(manifest.schema).toBe("ship-part-content-migration/1");
    expect(manifest.stagedOnly).toBe(true);
    expect(manifest.source.kind).toBe("legacy");
    expect(manifest.content.files.map((f) => f.path)).toEqual(planned.files.map((f) => f.path));
    expect(manifest.content.hash).toBe(planned.contentHash);
    for (const file of manifest.content.files) {
      expect(file.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(planned.manifestFile.path).toBe("manifest.json");
  });

  it("documents one destination per source field and rejects an unmapped one", () => {
    expect(PART_SOURCE_FIELDS.length).toBeGreaterThan(0);
    const base = components.find((c) => c.id === "quarters_crew");
    expect(base).toBeDefined();
    const failures = failuresOf({
      ...legacySource,
      components: [...components, { ...base!, forbidsCoLocation: ["MAGAZINE"] }],
    });
    expect(failures.map((f) => f.code)).toContain("CODEMOD_CATALOGUE_FAILURE");
    expect(failures.some((f) => f.message.includes("PARTCAT_UNMAPPED_FIELD"))).toBe(true);
  });

  it("rejects an unknown tag and incomplete physical facts, typed and path-specific", () => {
    const tagged = components.find((c) => c.category === "ACCOMMODATION") ?? components[0]!;
    const badTag = failuresOf({
      ...legacySource,
      components: [...components, { ...tagged, tags: [...tagged.tags, "not_a_tag"] }],
    });
    expect(badTag.some((f) => f.message.includes("PARTCAT_UNKNOWN_TAG"))).toBe(true);

    const complete = components.find(
      (c) =>
        c.heightMm !== undefined &&
        c.zCgMm !== undefined &&
        c.attributes === undefined &&
        c.upgradePath.length === 0,
    );
    expect(complete).toBeDefined();
    const incomplete = failuresOf({
      ...legacySource,
      components: [...components, { ...complete!, zCgMm: undefined }],
    });
    expect(incomplete.some((f) => f.code === "CODEMOD_CATALOGUE_FAILURE")).toBe(true);
    expect(incomplete.some((f) => f.message.includes("PARTCAT_PHYSICAL_INCOMPLETE"))).toBe(true);
  });

  it("rejects a duplicate generated id, never a silent overwrite", () => {
    const base = components.find((c) => c.id === "quarters_crew")!;
    const failures = failuresOf({
      ...legacySource,
      components: [...components, { ...base, displayName: "variant", weightKg: "10000" }],
    });
    expect(failures.some((f) => f.message.includes("PARTCAT_DUPLICATE_ID"))).toBe(true);
  });

  it("rejects a destination collision in a staged source", () => {
    const sample = [...partsById.values()][0]!;
    const staged = planFromStaged({
      parts: [sample, { ...sample, name: `${sample.name} altered` }],
      slotTemplates: [],
      platforms: [],
      designs: [],
      sourceFiles: [],
    });
    expect(staged.ok).toBe(false);
    if (!staged.ok) {
      expect(staged.failures.map((f) => f.code)).toContain("CODEMOD_DESTINATION_COLLISION");
    }
  });

  it("fails typed, never guesses, for an invalid tube count", () => {
    const found = legacySource.designs
      .flatMap((design) => design.draft.placements.map((placement) => ({ design, placement })))
      .find(({ placement }) => categoryOf(placement.componentId) === "TORPEDO_TUBE");
    expect(found).toBeDefined();
    const { design, placement } = found!;
    const designs = legacySource.designs.map((d) =>
      d.id === design.id
        ? {
            ...d,
            draft: {
              ...d.draft,
              placements: d.draft.placements.map((p) =>
                p.instanceId === placement.instanceId
                  ? { ...p, params: { ...p.params, tubes: 0 } }
                  : p,
              ),
            },
          }
        : d,
    );
    const failures = failuresOf({ ...legacySource, designs });
    expect(failures.map((f) => f.code)).toContain("CODEMOD_UNTRANSLATED_PLACEMENT");
  });

  it("orders deterministically: input order does not change the output", () => {
    const shuffled: LegacySource = {
      ...legacySource,
      components: [...components].reverse(),
      armament: {
        gunFamilies: [...legacySource.armament.gunFamilies].reverse(),
        gunModels: [...legacySource.armament.gunModels].reverse(),
        gunMounts: [...legacySource.armament.gunMounts].reverse(),
        ammunition: [...legacySource.armament.ammunition].reverse(),
      },
      profiles: [...legacySource.profiles].reverse(),
      designs: [...legacySource.designs].reverse(),
      hullForms: [...legacySource.hullForms].reverse(),
    };
    const result = planFromLegacy(shuffled);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.contentHash).toBe(planned.contentHash);
    expect(canonicalSerialize(result.value.files)).toBe(canonicalSerialize(planned.files));
  });

  it("keeps the D17 batteries' mountType and barrel identity on the staged loadout", () => {
    const source = new Map(
      legacySource.designs.flatMap((d) =>
        d.draft.placements.map((p) => [`${d.id}:${p.instanceId}`, p] as const),
      ),
    );
    const batteryEntries = planned.designs.flatMap((d) =>
      d.loadout.entries
        .filter(
          (e) =>
            partsById.get(e.part)?.family === "gun_mount" && e.part.includes("_central_battery_"),
        )
        .map((e) => ({ designId: d.id, entry: e })),
    );
    expect(batteryEntries).toHaveLength(9);
    for (const { designId, entry } of batteryEntries) {
      const mount = partsById.get(entry.part)!;
      expect(mount.family).toBe("gun_mount");
      if (mount.family !== "gun_mount") continue;
      expect(mount.spec.mountType).toBe("BROADSIDE_BATTERY");
      expect(entry.mountCount).toBe(1);
      const placement = source.get(`${designId}:${entry.id}`);
      expect(placement).toBeDefined();
      expect(mount.spec.gunsPerMount).toBe(placement?.params?.["barrels"] ?? 1);
    }
  });

  it("keeps torpedo mountCount equal to the legacy tubes for the 30 tube placements", () => {
    const source = new Map(
      legacySource.designs.flatMap((d) =>
        d.draft.placements.map((p) => [`${d.id}:${p.instanceId}`, p] as const),
      ),
    );
    const tubes = planned.designs.flatMap((d) =>
      d.loadout.entries
        .filter((e) => partsById.get(e.part)?.family === "torpedo_launcher")
        .map((e) => ({ designId: d.id, entry: e })),
    );
    expect(tubes).toHaveLength(30);
    for (const { designId, entry } of tubes) {
      const placement = source.get(`${designId}:${entry.id}`);
      expect(entry.mountCount).toBe(placement?.params?.["tubes"] ?? 1);
    }
  });

  it("counts a gun placement as unresolved only on the documented compatibility path", () => {
    const gunPlacements = legacySource.designs.flatMap((design) =>
      design.draft.placements.filter((placement) =>
        WEAPON_GUN.has(categoryOf(placement.componentId) ?? ""),
      ),
    );
    expect(gunPlacements.length).toBe(233);
  });
});
