/**
 * Torpedoes as first-class parts (ship-part-model ticket 13a, SPM-R17).
 *
 * The tests observe the highest seams: the whole-catalogue builder, the part queries, the
 * compiled torpedo contract and the fit stage, over the real production content. Expected
 * values come from the authoritative combat models and the research, never recomputed the
 * way the builder computes them.
 */
import {
  FlattenedPartSchema,
  LoadoutSchema,
  PART_TAGS,
  decodeStrict,
} from "@bluewave/content-schema";
import type { FlattenedPart, LoadoutData } from "@bluewave/content-schema";
import { canonicalSerialize } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import {
  buildCompatibilitySlots,
  buildLauncherPartModel,
  buildPartCatalogue,
  buildTorpedoPartModel,
  compileTorpedo,
  partsForSlot,
  platformSlots,
  resolvePart,
  TORPEDO_SOURCE_FIELDS,
  validateLoadoutFit,
  type PartCatalogue,
  type SourceCatalogue,
} from "../src/index.js";
import {
  armamentContent,
  components,
  hullRecords,
  navalProfiles,
  plants,
  shipBalance,
} from "./helpers/earlyContext.js";
import { torpedoDiameterUm, torpedoModels } from "./helpers/torpedoModels.js";

const source: SourceCatalogue = {
  components,
  plants,
  armour: shipBalance.armour,
  armament: armamentContent,
  profiles: navalProfiles,
  tagVocabulary: PART_TAGS,
  torpedoDiameterUm,
  torpedoModels,
};

const built = buildPartCatalogue(source);
const partById = new Map(built.parts.map((p) => [p.id, p] as const));
const torpedoParts = built.parts.filter((p) => p.family === "torpedo");
const catalogue: PartCatalogue = { parts: built.parts, slotTemplates: [], platforms: [] };
const launcherModel = buildLauncherPartModel({
  components,
  profiles: navalProfiles,
  torpedoDiameterUm,
});

const WHITEHEAD = "whitehead_14in_1886";
const part = (id: string): FlattenedPart => {
  const found = partById.get(id);
  if (found === undefined) throw new Error(`missing part ${id}`);
  return found;
};

describe("the torpedo catalogue (13a)", () => {
  it("covers every combat torpedo model, strictly decoded", () => {
    expect(torpedoParts.map((p) => p.id)).toEqual(
      torpedoModels.map((m) => String(m.torpedoModelId)).sort(),
    );
    for (const p of torpedoParts) {
      expect(decodeStrict(FlattenedPartSchema, p), p.id).toEqual(p);
    }
  });

  it("documents one destination per combat torpedo-model field", () => {
    expect(new Set(TORPEDO_SOURCE_FIELDS.map((f) => f.field)).size).toBe(
      TORPEDO_SOURCE_FIELDS.length,
    );
    const mapped = new Set(TORPEDO_SOURCE_FIELDS.map((f) => f.field));
    const contentSide = new Set([
      "availableFrom",
      "availableUntil",
      "warheadFirstPattern",
      "provenance",
      "sourceFile",
    ]);
    for (const key of Object.keys(torpedoModels[0]!)) {
      expect(mapped.has(key) || contentSide.has(key), key).toBe(true);
    }
    expect(built.inventory.unmappedFieldsFound).toBe(0);
  });

  it("is deterministic: input order does not change the parts", () => {
    const shuffled = buildPartCatalogue({
      ...source,
      torpedoModels: [...torpedoModels].reverse(),
      components: [...components].reverse(),
      profiles: [...navalProfiles].reverse(),
    });
    expect(canonicalSerialize(shuffled.parts)).toBe(canonicalSerialize(built.parts));
  });

  it("fails with PARTCAT_DUPLICATE_ID when one id is generated twice with different content", () => {
    const first = torpedoModels[0]!;
    const dup = buildPartCatalogue({
      ...source,
      torpedoModels: [
        ...torpedoModels,
        { ...first, provenance: { ...first.provenance, note: "a conflicting record" } },
      ],
    });
    expect(dup.failures.map((f) => f.code)).toContain("PARTCAT_DUPLICATE_ID");
  });

  it("rejects an unsupported source value with a typed, path-specific failure", () => {
    const bad = buildTorpedoPartModel({
      models: [{ ...torpedoModels[0]!, compatibleLauncherFamilyIds: ["nonsense"] }],
    });
    expect(bad.parts).toEqual([]);
    expect(bad.unread.map((u) => u.code)).toEqual(["TORPEDO_READ_PATH_UNKNOWN_LAUNCH_FAMILY"]);
  });
});

describe("the 1884 Whitehead revision (13a, ticket AC 4)", () => {
  it("resolves before and after the 1884 revision from the compiled production part", () => {
    const before = resolvePart(catalogue, WHITEHEAD, "1883-12");
    const after = resolvePart(catalogue, WHITEHEAD, "1884-01");
    expect(before?.revision).toBe("base");
    expect(before?.spec["warheadExplosiveMassKg"]).toBe(12);
    expect(after?.revision).toBe("1884-01");
    expect(after?.spec["warheadExplosiveMassKg"]).toBe(27);
  });

  it("points the re-rating provenance at the revision", () => {
    const revision = part(WHITEHEAD).revisions.find((r) => r.from === "1884-01");
    expect(revision).toBeDefined();
    expect(revision?.provenance.sourceStatus).toBe("VERIFIED");
    expect(revision?.provenance.sources[0]?.archiveOrUrl).toBe(
      "docs/research/ship-building-early-band-2.md",
    );
  });

  it("compiles the production part to the revised warhead, carrying the revision id", () => {
    const before = compileTorpedo(part(WHITEHEAD), "1883-12");
    const after = compileTorpedo(part(WHITEHEAD), "1884-01");
    expect(before.ok && before.value.warheadExplosiveEquivalentMassKg).toBe(12);
    expect(after.ok && after.value.revision).toBe("1884-01");
    expect(after.ok && after.value.warheadExplosiveEquivalentMassKg).toBe(27);
  });
});

const MOUNT_ORDER = [
  "ABOVE_WATER_FIXED",
  "ABOVE_WATER_TRAINABLE",
  "UNDERWATER_FIXED",
  "UNDERWATER_TRAINABLE",
  "SUBMARINE_INTERNAL",
] as const;

const launchTypesFor = (model: (typeof torpedoModels)[number]): string[] => {
  const types = new Set<string>();
  for (const familyId of model.compatibleLauncherFamilyIds) {
    const mountType = MOUNT_ORDER.find((m) => familyId.endsWith(m.toLowerCase()));
    if (mountType !== undefined) types.add(mountType);
  }
  return MOUNT_ORDER.filter((m) => types.has(m));
};

const expectedCompiled = (
  model: (typeof torpedoModels)[number],
  month: string,
): Record<string, unknown> => {
  const id = String(model.torpedoModelId);
  const reRated = id === WHITEHEAD && month >= "1884-01";
  const warhead = reRated
    ? model.warheadExplosiveMassKg
    : id === WHITEHEAD
      ? 12
      : model.warheadExplosiveMassKg;
  const equivalent = reRated
    ? model.warheadExplosiveEquivalentMassKg
    : id === WHITEHEAD
      ? 12
      : model.warheadExplosiveEquivalentMassKg;
  return {
    partId: id,
    revision: reRated ? "1884-01" : "base",
    diameterUm: model.diameterMm * 1000,
    massKg: model.massKg,
    warheadType: model.warheadType,
    warheadExplosiveMassKg: warhead,
    warheadExplosiveEquivalentMassKg: equivalent,
    propulsionType: model.propulsionType,
    speedSettings: model.orderedSettings.map((s) => ({
      settingId: s.settingId,
      speedMilliKnots: s.speedKnotsBp,
      rangeM: s.rangeM,
    })),
    minimumArmingDistanceM: model.minimumArmingDistanceM,
    reliabilityBp: model.reliabilityBp,
    guidanceCapability: model.guidanceCapability,
    launchTypes: launchTypesFor(model),
    technologyPrerequisiteIds: [...model.technologyPrerequisiteIds],
    tubeHitHazardPolicy: model.tubeHitHazardPolicyId,
    ...(model.propulsionType === "OXYGEN" && model.oxygenState !== null
      ? { oxygenWakeVisibilityModifierBp: model.oxygenState.wakeVisibilityModifierBp }
      : {}),
  };
};

describe("the compiled torpedo contract (SPM-R17)", () => {
  it("carries the model's identity and combat values verbatim (the first pattern at 1880-01)", () => {
    const compiled = compileTorpedo(part(WHITEHEAD), "1880-01");
    expect(compiled.ok).toBe(true);
    if (!compiled.ok) return;
    const model = torpedoModels.find((m) => String(m.torpedoModelId) === WHITEHEAD)!;
    expect(compiled.value).toEqual(expectedCompiled(model, "1880-01"));
  });

  it("compiles every model to its mapped source values at a post-availability month", () => {
    for (const model of torpedoModels) {
      const id = String(model.torpedoModelId);
      const compiled = compileTorpedo(part(id), "1940-01");
      expect(compiled.ok, id).toBe(true);
      if (!compiled.ok) continue;
      expect(compiled.value, id).toEqual(expectedCompiled(model, "1940-01"));
    }
  });

  it("compiles an oxygen model with its per-model wake modifier", () => {
    const oxygen = compileTorpedo(part("jpn_61cm_type93_1935"), "1935-06");
    expect(oxygen.ok).toBe(true);
    if (!oxygen.ok) return;
    expect(oxygen.value.propulsionType).toBe("OXYGEN");
    expect(oxygen.value.oxygenWakeVisibilityModifierBp).toBe(2_500);
    expect(oxygen.value.tubeHitHazardPolicy).toBe("OXYGEN");
  });

  it("fails typed on a non-torpedo part", () => {
    const result = compileTorpedo(part("tube_14in_above_water"), "1880-01");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failures.map((f) => f.code)).toEqual(["COMPILED_TORPEDO_NOT_A_TORPEDO"]);
  });

  it("fails typed on an oxygen-state mismatch", () => {
    // The schema admits the modifier (it is optional); the compiler is what rejects it on a
    // non-OXYGEN model, so the value is never silently dropped.
    const whitehead = part(WHITEHEAD);
    const decoded = decodeStrict(FlattenedPartSchema, {
      ...whitehead,
      spec: { ...whitehead.spec, oxygenWakeVisibilityModifierBp: 2_500 },
    });
    const compiled = compileTorpedo(decoded, "1880-01");
    expect(compiled.ok).toBe(false);
    if (compiled.ok) return;
    expect(compiled.failures.map((f) => f.code)).toEqual(["COMPILED_TORPEDO_OXYGEN_STATE"]);
  });
});

describe("launcher compatibility and waivers with first-class torpedo parts", () => {
  const launcherSlotParts = (launcherId: string, month: string): readonly string[] => {
    const result = partsForSlot({
      catalogue,
      owner: { part: launcherId },
      slot: "torpedo",
      month,
    });
    return result.status === "OK" ? [...result.parts, ...result.undecided.map((u) => u.part)] : [];
  };

  it("resolves every one of the 19 launchers against the torpedo it loads", () => {
    const launchers = built.parts.filter((p) => p.family === "torpedo_launcher");
    expect(launchers).toHaveLength(19);
    for (const launcher of launchers) {
      expect(launcherSlotParts(launcher.id, "1880-01")).toContain(WHITEHEAD);
    }
  });

  it("fits a production launcher with the real torpedo part and applies the waiver", () => {
    const waived = launcherModel.parts.find((p) => p.id === "fr_tube_380mm_aw")!;
    const fit = launcherFit(waived, part(WHITEHEAD), true);
    expect(fit.status).toBe("ACCEPTED");
    expect(fit.waivers).toHaveLength(1);
    expect(fit.waivers[0]).toMatchObject({ torpedo: WHITEHEAD, launcher: "fr_tube_380mm_aw" });
  });

  it("rejects the waivered launcher once its waiver is removed, and admits no unrelated torpedo", () => {
    const waived = launcherModel.parts.find((p) => p.id === "fr_tube_380mm_aw")!;
    const rejected = launcherFit(waived, part(WHITEHEAD), false);
    expect(rejected.status).toBe("REJECTED");
    expect(rejected.findings.map((f) => [f.code, f.detail["constraint"]])).toEqual([
      ["FIT_CONSTRAINT_VIOLATED", "diameterUmEqualsBore"],
    ]);
  });
});

// ---------------------------------------------------------------------------

function launcherFit(
  launcherPart: FlattenedPart,
  torpedo: FlattenedPart,
  keepWaivers: boolean,
  month = "1890-01",
): ReturnType<typeof validateLoadoutFit> {
  const compatibility = buildCompatibilitySlots({ hullForms: hullRecords });
  const partWithWaivers: FlattenedPart = keepWaivers
    ? launcherPart
    : { ...launcherPart, legacyExceptions: undefined };
  const platform = compatibility.platforms[0]!;
  const slots = platformSlots(compatibility, platform.id)!;
  const slot = slots.find((s) => s.accepts?.includes("torpedo_launcher") === true)!;
  const loadout: LoadoutData = decodeStrict(LoadoutSchema, {
    platform: platform.id,
    entries: [
      {
        slot: slot.id,
        part: partWithWaivers.id,
        mountCount: 1,
        entries: { torpedo: [{ part: torpedo.id }] },
      },
    ],
  });
  return validateLoadoutFit({
    parts: [partWithWaivers, torpedo],
    slotTemplates: compatibility.slotTemplates,
    platforms: compatibility.platforms,
    loadout,
    month,
  });
}
