import {
  FlattenedPartSchema,
  LoadoutEntrySchema,
  LoadoutSchema,
  PlatformSchema,
  SlotTemplateSchema,
  decodeStrict,
  decodeStrictResult,
} from "@bluewave/content-schema";
import { canonicalSerialize, compareCodePoints } from "@bluewave/deterministic";
import { describe, expect, it } from "vite-plus/test";
import { num } from "../src/compileShared.js";
import { armamentMountFor, resolveInstalledWeapon } from "../src/armamentContent.js";
import { buildGunPartModel } from "../src/gunPartAdapter.js";
import { nationHasArmamentContent, type AuthoredArmamentContent } from "../src/index.js";
import { platformSlots } from "../src/partCompatibility.js";
import { type GunPlacementTranslation } from "../src/partReadPath.js";
import { componentAccessOf, toCompiledWeaponArmament } from "../src/armamentCompile.js";
import { sortUnresolvedGunPlacements, type UnresolvedGunPlacement } from "../src/partReadPath.js";
import { totalOf } from "../src/partQuantities.js";
import { armamentContent, components, earlyContext } from "./helpers/earlyContext.js";
import {
  compatibility,
  designs,
  gunPartModel,
  gunPlacements,
  gunRequests,
  present,
  resolveRow,
  where,
  type GunPlacement,
} from "./helpers/gunReadPath.js";

const results = gunPlacements.map((row) => ({ row, got: resolveRow(row) }));

const translationOf = (row: GunPlacement): GunPlacementTranslation =>
  present(resolveRow(row).translation, `a translation for ${where(row)}`);

function legacyComponentValue(row: GunPlacement, field: "weightKg" | "costMicro"): number {
  const def = present(
    components.find((c) => c.id === row.familyId),
    `component ${row.familyId}`,
  );
  const params: Record<string, number> = {};
  for (const [name, range] of Object.entries(def.parameters)) {
    params[name] = row.placement.params?.[name] ?? range.min;
  }
  return num(def[field], { ...def.constants, ...params });
}

const FIRST_CLASS = ["france", "germany", "uk"];

describe("gun read path over today's content (ship-part-model 03)", () => {
  it("covers all 92 reference designs and all 230 gun placements", () => {
    expect(designs.length).toBe(92);
    expect(gunPlacements.length).toBe(230);
    expect(gunPartModel.unread).toEqual([]);
  });

  describe("strict content-schema boundary", () => {
    it("every gun and gun-mount part decodes unchanged through FlattenedPartSchema", () => {
      expect(gunPartModel.parts.length).toBeGreaterThan(0);
      for (const part of gunPartModel.parts) {
        expect(decodeStrict(FlattenedPartSchema, part), part.id).toEqual(part);
      }
      for (const { row, got } of results) {
        const t = present(got.translation, where(row));
        expect(decodeStrict(FlattenedPartSchema, t.mountPart), where(row)).toEqual(t.mountPart);
      }
    });

    it("every placement's entry and every design's loadout decode through the loadout schemas", () => {
      for (const design of designs) {
        const entries = results
          .filter(({ row }) => row.design.id === design.id)
          .map(({ row, got }) => present(got.translation, where(row)).entry);
        for (const entry of entries) {
          expect(decodeStrict(LoadoutEntrySchema, entry), design.id).toEqual(entry);
        }
        const loadout = { platform: design.draft.hull.hullFormId, entries };
        expect(decodeStrict(LoadoutSchema, loadout), design.id).toEqual(loadout);
      }
    });

    it("the compatibility templates and platforms decode through their schemas", () => {
      for (const template of compatibility.slotTemplates) {
        expect(decodeStrict(SlotTemplateSchema, template)).toEqual(template);
      }
      for (const platform of compatibility.platforms) {
        expect(decodeStrict(PlatformSchema, platform)).toEqual(platform);
      }
    });

    it("adapter-side facts never reach a part: the strict decode rejects them", () => {
      const t = translationOf(present(gunPlacements[0], "a placement"));
      for (const [field, value] of [
        ["familyId", t.familyId],
        ["resolvedMountType", t.legacyResolvedMountType],
        ["translationDisposition", "RECLASSIFIED_AS_CENTRAL_BATTERY"],
      ] as const) {
        const result = decodeStrictResult(FlattenedPartSchema, { ...t.gunPart, [field]: value });
        expect(result._tag, field).toBe("Failure");
      }
      expect(decodeStrictResult(LoadoutEntrySchema, { ...t.entry, barrels: 2 })._tag).toBe(
        "Failure",
      );
    });
  });

  describe("one loadout entry per placement", () => {
    it("each placement is one entry in its zone slot, preserving its station and side", () => {
      for (const { row, got } of results) {
        const t = present(got.translation, where(row));
        const barrels = row.placement.params?.barrels ?? 1;
        expect(t.legacyBarrels, where(row)).toBe(barrels);
        expect(t.mountCount * t.gunsPerMount, where(row)).toBe(barrels);
        expect(t.containedUnits, where(row)).toBe(barrels);
        expect(t.entry, where(row)).toEqual({
          id: row.placement.instanceId,
          slot: `${row.placement.zoneId.toLowerCase()}.gun_mount`,
          part: t.mountPart.id,
          mountCount: t.mountCount,
          stationPermille: row.placement.stationPermille,
          ...(row.placement.side !== undefined ? { side: row.placement.side } : {}),
          ...(row.placement.magazineRef !== undefined
            ? { magazineEntry: row.placement.magazineRef }
            : {}),
          entries: {
            guns: [
              {
                part: t.gunPart.id,
                mountCount: t.containedUnits,
                ...(row.placement.params?.rounds !== undefined
                  ? { params: { rounds: row.placement.params.rounds } }
                  : {}),
              },
            ],
          },
        });
      }
    });

    it("applies §9.2: single-gun mounts count mounts, rotating 1–2-gun mounts count guns", () => {
      for (const { row, got } of results) {
        const t = present(got.translation, where(row));
        if (t.disposition !== null) continue;
        if (["TURRET", "BARBETTE"].includes(t.mountType)) {
          expect(t.mountCount, where(row)).toBe(1);
          expect([1, 2], where(row)).toContain(t.gunsPerMount);
        } else {
          expect(t.gunsPerMount, where(row)).toBe(1);
          expect(t.mountCount, where(row)).toBe(t.legacyBarrels);
        }
      }
    });

    it("every entry lands in a slot of its design's platform that accepts a gun mount", () => {
      for (const { row, got } of results) {
        const t = present(got.translation, where(row));
        const slots = present(
          platformSlots(compatibility, row.design.draft.hull.hullFormId),
          `platform ${row.design.draft.hull.hullFormId}`,
        );
        const slot = present(
          slots.find((s) => s.id === t.entry.slot),
          `slot ${t.entry.slot}`,
        );
        expect(slot.zone, where(row)).toBe(row.placement.zoneId);
        expect(slot.accepts, where(row)).toEqual(["gun_mount"]);
        const guns = present(
          t.mountPart.slots?.find((s) => s.id === "guns"),
          `${t.mountPart.id} guns slot`,
        );
        expect(guns.accepts).toEqual(["gun"]);
        expect(guns.mountCount).toEqual({ min: t.gunsPerMount, max: t.gunsPerMount });
      }
    });
  });

  describe("basis-driven mass and cost", () => {
    it("every placement's mass and cost equal the legacy component formula", () => {
      for (const { row, got } of results) {
        const t = present(got.translation, where(row));
        expect(totalOf(t.quantities, "massKg"), `${where(row)} mass`).toBe(
          legacyComponentValue(row, "weightKg"),
        );
        expect(totalOf(t.quantities, "costMicro"), `${where(row)} cost`).toBe(
          legacyComponentValue(row, "costMicro"),
        );
      }
    });

    it("hand-works a 1-mount, 2-gun turret: fixed ×1, per gun ×2, gun mass and cost ×2", () => {
      const row = present(
        gunPlacements.find((p) => {
          const t = translationOf(p);
          return t.mountType === "TURRET" && t.gunsPerMount === 2 && t.disposition === null;
        }),
        "a 2-gun turret placement",
      );
      const t = translationOf(row);
      const line = (scope: string, id: string) =>
        present(
          t.quantities.find((q) => q.scope === scope && q.id === id),
          `${scope}.${id}`,
        );
      expect(line("mount", "installation_fixed")).toMatchObject({
        kind: "massKg",
        basis: "PER_LOADOUT_ENTRY",
        multiplier: 1,
      });
      expect(line("mount", "installation_per_gun")).toMatchObject({
        kind: "massKg",
        basis: "PER_CONTAINED_UNIT",
        multiplier: 2,
      });
      expect(line("mount", "mount_cost_per_gun")).toMatchObject({
        kind: "costMicro",
        basis: "PER_CONTAINED_UNIT",
        multiplier: 2,
      });
      expect(line("gun", "gun_mass")).toMatchObject({ basis: "PER_PART_UNIT", multiplier: 2 });
      expect(line("gun", "gun_cost")).toMatchObject({ basis: "PER_PART_UNIT", multiplier: 2 });
      for (const q of t.quantities) expect(q.contribution).toBe(q.value * q.multiplier);
    });

    it("a casemate battery of n guns is n mounts: fixed ×1, per gun ×n, gun ×n", () => {
      const row = present(
        gunPlacements.find(
          (p) =>
            translationOf(p).mountType === "CASEMATE" && (p.placement.params?.barrels ?? 1) > 1,
        ),
        "a multi-gun casemate placement",
      );
      const t = translationOf(row);
      expect(t.gunsPerMount).toBe(1);
      for (const q of t.quantities) {
        const expected = q.basis === "PER_LOADOUT_ENTRY" ? 1 : t.legacyBarrels;
        expect(q.multiplier, `${q.scope}.${q.id}`).toBe(expected);
      }
    });
  });

  it("is byte-identical to the legacy resolver except the D17 identity paths", () => {
    let resolved = 0;
    let reclassified = 0;
    for (const { row, got } of results) {
      const nationId = row.design.draft.nationId;
      const ctx = earlyContext(row.design.month);
      const legacy = nationHasArmamentContent(armamentContent, nationId)
        ? resolveInstalledWeapon({
            content: armamentContent,
            components,
            nationId,
            familyId: row.familyId,
            gunCount: row.placement.params?.barrels ?? 1,
            month: row.design.month,
            unlockedTechnologyIds: ctx.unlockedTechs,
            componentAccess: componentAccessOf(ctx.navalProfile),
          })
        : null;
      if (legacy?.resolved == null) {
        expect(got.resolved, where(row)).toBeNull();
        expect(got.compiled, where(row)).toBeNull();
        expect(got.unresolved, where(row)).not.toBeNull();
        continue;
      }
      resolved += 1;
      expect(got.unresolved, where(row)).toBeNull();
      const legacyCompiled = toCompiledWeaponArmament(
        legacy.resolved,
        legacy.mountType,
        row.placement.instanceId,
      );
      const t = present(got.translation, where(row));
      const gotResolved = present(got.resolved, where(row));
      const gotCompiled = present(got.compiled, where(row));
      if (t.disposition === null) {
        expect(gotResolved, where(row)).toEqual(legacy.resolved);
        expect(gotCompiled, where(row)).toEqual(legacyCompiled);
        continue;
      }
      reclassified += 1;
      expect(String(legacy.resolved.mountId), where(row)).toBe(t.legacyMountId);
      expect(String(gotResolved.mountId), where(row)).toBe(t.mountPart.id);
      expect(gotCompiled.mountType, where(row)).toBe("BROADSIDE_BATTERY");
      expect(legacyCompiled.mountType, where(row)).toBe(t.legacyResolvedMountType);
      expect(gotResolved, where(row)).toEqual({ ...legacy.resolved, mountId: gotResolved.mountId });
      expect(gotCompiled, where(row)).toEqual({
        ...legacyCompiled,
        mountId: gotCompiled.mountId,
        mountType: gotCompiled.mountType,
      });
    }
    expect(resolved).toBe(68);
    expect(reclassified).toBe(6);
  });

  describe("D17 central-battery reclassification", () => {
    const d17 = results.flatMap(({ row, got }) =>
      got.translation?.disposition === "RECLASSIFIED_AS_CENTRAL_BATTERY"
        ? [{ row, t: got.translation }]
        : [],
    );

    it("reclassifies exactly the nine §9.2 placements as BROADSIDE_BATTERY assemblies", () => {
      expect(
        d17
          .map(({ row, t }) => `${where(row)}:${t.familyId}:${t.legacyResolvedMountType}`)
          .sort(compareCodePoints),
      ).toEqual([
        "kaiser_1875:main_aft:gun_bl_263mm_rkl20:TURRET",
        "kaiser_1875:main_fwd:gun_bl_263mm_rkl20:TURRET",
        "mesudiye_1875:main_aft:gun_rml_10in_18ton:BARBETTE",
        "mesudiye_1875:main_fwd:gun_rml_10in_18ton:BARBETTE",
        "mesudiye_1875:sec:gun_rml_7in_7ton:BARBETTE",
        "redoutable_1878:main_aft:gun_bl_274mm_m1875:BARBETTE",
        "redoutable_1878:main_fwd:gun_bl_274mm_m1875:BARBETTE",
        "sachsen_1878:main_aft:gun_bl_263mm_rkl20:TURRET",
        "sachsen_1878:main_fwd:gun_bl_263mm_rkl20:TURRET",
      ]);
    });

    it("keeps barrels and the fixed installation, and the disposition stays out of content", () => {
      for (const { row, t } of d17) {
        expect(t.mountType, where(row)).toBe("BROADSIDE_BATTERY");
        expect(t.mountPart.spec.mountType, where(row)).toBe("BROADSIDE_BATTERY");
        expect(t.mountPart.id, where(row)).toBe(`${t.familyId}_central_battery_${t.legacyBarrels}`);
        expect(t.mountCount, where(row)).toBe(1);
        expect(t.gunsPerMount * t.mountCount, where(row)).toBe(t.legacyBarrels);
        const legacyMount = present(
          armamentMountFor(
            armamentContent,
            components,
            t.familyId,
            t.legacyResolvedMountType,
            t.legacyBarrels,
          ),
          `legacy mount for ${where(row)}`,
        );
        expect(t.legacyMountId).toBe(String(legacyMount.id));
        const fixed = present(
          t.quantities.find((q) => q.scope === "mount" && q.id === "installation_fixed"),
          `${where(row)} fixed installation`,
        );
        expect(fixed.basis).toBe("PER_LOADOUT_ENTRY");
        expect(fixed.contribution).toBe(legacyMount.baseInstallationMassKg);
        expect(t.mountPart.spec.firingArcDeg).toBe(legacyMount.firingArcDeg);
        const content = canonicalSerialize({ part: t.mountPart, entry: t.entry });
        expect(content, where(row)).not.toContain("RECLASSIFIED");
        expect(content, where(row)).not.toContain(t.legacyResolvedMountType);
      }
    });
  });

  describe("unresolved placements", () => {
    const unresolved = results.flatMap(({ got }) => (got.unresolved ? [got.unresolved] : []));

    it("every one of the 162 non-resolving placements carries a reason and its parts", () => {
      expect(unresolved.length).toBe(162);
      expect(unresolved.length + 68).toBe(gunPlacements.length);
      expect(new Set(unresolved.map((u) => u.code))).toEqual(
        new Set(["PART_READ_PATH_NO_FIRST_CLASS_ARMAMENT"]),
      );
      const nations = [...new Set(unresolved.map((u) => u.nationId))].sort(compareCodePoints);
      expect(nations).toEqual([
        "austria_hungary",
        "brazil",
        "italy",
        "japan",
        "netherlands",
        "ottoman_empire",
        "portugal",
        "qing",
        "russia",
        "spain",
        "usa",
      ]);
      for (const nation of nations) {
        expect(nationHasArmamentContent(armamentContent, nation)).toBe(false);
      }
      for (const nation of FIRST_CLASS) expect(nations).not.toContain(nation);
      for (const u of unresolved) {
        expect(u.gunPart, `${u.designId}:${u.instanceId}`).not.toBeNull();
        expect(u.mountPart, `${u.designId}:${u.instanceId}`).not.toBeNull();
        expect(u.blockingCodes).toEqual([]);
        expect(u.message).toContain(u.nationId);
      }
      expect(
        unresolved
          .filter((u) => u.designId === "mesudiye_1875")
          .filter((u) => u.mountPart?.includes("_central_battery_"))
          .map((u) => u.instanceId)
          .sort(compareCodePoints),
      ).toEqual(["main_aft", "main_fwd", "sec"]);
    });

    it("sorts the diagnostics by design and placement regardless of input order", () => {
      const sorted = sortUnresolvedGunPlacements(unresolved);
      expect(sortUnresolvedGunPlacements([...unresolved].reverse())).toEqual(sorted);
      const keys = sorted.map((u) => `${u.designId}\u0000${u.instanceId}`);
      expect([...keys].sort(compareCodePoints)).toEqual(keys);
      expect(new Set(keys).size).toBe(keys.length);
    });

    const french = present(
      gunPlacements.find((p) => p.design.draft.nationId === "france"),
      "a French gun placement",
    );

    it("a first-class nation with no ammunition pattern is PART_READ_PATH_NO_AMMUNITION", () => {
      const content: AuthoredArmamentContent = {
        ...armamentContent,
        ammunition: armamentContent.ammunition.filter((a) => a.nationId !== "france"),
      };
      const got = resolveRow(french, { content });
      expect(got.resolved).toBeNull();
      expect(got.unresolved).toMatchObject({
        designId: french.design.id,
        instanceId: french.placement.instanceId,
        nationId: "france",
        familyId: french.familyId,
        code: "PART_READ_PATH_NO_AMMUNITION",
      } satisfies Partial<UnresolvedGunPlacement>);
    });

    it("a resolver block is PART_READ_PATH_RESOLVER_BLOCKED with its sorted BLOCKING codes", () => {
      const got = resolveRow(french, { month: "1870-01" });
      expect(got.resolved).toBeNull();
      const u = present(got.unresolved, "an unresolved record");
      expect(u.code).toBe("PART_READ_PATH_RESOLVER_BLOCKED");
      expect(u.blockingCodes.length).toBeGreaterThan(0);
      expect([...u.blockingCodes].sort(compareCodePoints)).toEqual(u.blockingCodes);
      expect(u.blockingCodes).toEqual(
        [...new Set(got.findings.filter((f) => f.severity === "BLOCKING").map((f) => f.code))].sort(
          compareCodePoints,
        ),
      );
    });

    it("a family with no model is kept as PART_READ_PATH_NO_GUN_MODEL, never dropped", () => {
      const model = buildGunPartModel({
        content: armamentContent,
        components,
        requests: [...gunRequests, { nationId: "france", familyId: "no_such_gun" }],
      });
      expect(model.unread).toEqual([
        {
          nationId: "france",
          familyId: "no_such_gun",
          code: "PART_READ_PATH_NO_GUN_MODEL",
          message: "No gun model for family 'no_such_gun' available to 'france'.",
        },
      ]);
      const got = resolveRow({ ...french, familyId: "no_such_gun" }, { model });
      expect(got.translation).toBeNull();
      expect(got.unresolved?.code).toBe("PART_READ_PATH_NO_GUN_MODEL");
    });
  });

  describe("availability boundary through the resolver", () => {
    it("a retirementMonth becomes availableUntil one month later, with identical availability", () => {
      const row = present(
        gunPlacements.find(
          (p) =>
            p.design.draft.nationId === "france" &&
            armamentContent.gunModels.some(
              (m) => m.nationId === "france" && m.familyId === p.familyId,
            ),
        ),
        "a French placement with an authored model",
      );
      const content: AuthoredArmamentContent = {
        ...armamentContent,
        gunModels: armamentContent.gunModels.map((m) =>
          m.nationId === "france" && m.familyId === row.familyId
            ? { ...m, retirementMonth: "1885-06" }
            : m,
        ),
      };
      const model = buildGunPartModel({ content, components, requests: gunRequests });
      const part = present(
        model.parts.find(
          (p) =>
            p.nation === "france" &&
            content.gunModels.some((m) => m.id === p.id && m.familyId === row.familyId),
        ),
        "the retired French part",
      );
      expect(part.lifecycle.availableUntil).toBe("1885-07");
      expect(decodeStrict(FlattenedPartSchema, part)).toEqual(part);
      for (const [month, available] of [
        ["1885-06", true],
        ["1885-07", false],
      ] as const) {
        const ctx = earlyContext(month);
        const legacy = resolveInstalledWeapon({
          content,
          components,
          nationId: "france",
          familyId: row.familyId,
          gunCount: row.placement.params?.barrels ?? 1,
          month,
          unlockedTechnologyIds: ctx.unlockedTechs,
          componentAccess: componentAccessOf(ctx.navalProfile),
        });
        const got = resolveRow(row, { content, model, month });
        expect(legacy.resolved !== null, `legacy at ${month}`).toBe(available);
        expect(got.resolved !== null, `parts at ${month}`).toBe(available);
        expect(got.resolved).toEqual(legacy.resolved);
      }
    });
  });

  describe("determinism", () => {
    it("the part index and its ids do not depend on the request order", () => {
      const reversed = buildGunPartModel({
        content: armamentContent,
        components,
        requests: [...gunRequests].reverse(),
      });
      expect(canonicalSerialize(reversed.parts)).toBe(canonicalSerialize(gunPartModel.parts));
      const ids = gunPartModel.parts.map((p) => p.id);
      expect([...ids].sort(compareCodePoints)).toEqual(ids);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it("a family-derived model is one shared part with no nation; an authored one names it", () => {
      for (const part of gunPartModel.parts) {
        const authored = armamentContent.gunModels.find((m) => m.id === part.id);
        if (authored === undefined) {
          expect(part.id.startsWith("standard_"), part.id).toBe(true);
          expect(part.nation, part.id).toBeUndefined();
          expect(part.origin.sourceFile).toBe("ship-building/components.yaml");
        } else {
          expect(part.nation, part.id).toBe(authored.nationId);
          expect(part.origin.sourceFile).toBe("ship-building/armament/gun-models.yaml");
        }
      }
    });

    it("translating twice gives byte-identical entries, parts and quantities", () => {
      const again = gunPlacements.map((row) => resolveRow(row));
      expect(canonicalSerialize(again)).toBe(canonicalSerialize(results.map((r) => r.got)));
    });
  });
});
