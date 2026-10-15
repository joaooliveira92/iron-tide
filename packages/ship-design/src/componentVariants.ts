/**
 * Shared component families with national models (docs/ships-nation-orientation.md §3): a family is a
 * `components.yaml` entry; a national model overlays it with a bounded set of field overrides. Guns are kept
 * separate from their installation (`GunModelDef.mounts`) and their ammunition pattern, so a 6-in gun in a
 * casemate does not behave identically to the same gun in a turret.
 *
 * `catalogueForNation` is the single place a nation's catalogue is derived from the shared one. It only ever
 * *restricts* (drops UNAVAILABLE families, enforces the hard-capability calibre ceiling) or *relabels* (overlays a
 * national model); it never widens the global component set, so global classification stays authoritative.
 */
import type { ComponentDef } from "./component.js";
import type { AmmunitionPattern, GunModelDef, NationNavalProfile } from "./nationProfile.js";

const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + (Number(m.slice(5, 7)) - 1);

/** The `ComponentDef` fields a national override may touch (plus `attributes.<name>` and `constants.<name>`). */
const OVERRIDABLE_FIELDS = new Set<string>([
  "displayName",
  "weightKg",
  "volumeLitre",
  "costMicro",
  "crew",
  "powerKw",
  "deckFootprintMm2",
  "heightMm",
  "zCgMm",
  "coolingKw",
  "tags",
  "requires",
  "attributes",
  "constants",
  "parameters",
  "fcClass",
  "fcClasses",
  "maintenanceMonthlyBp",
  "buildWorkMicro",
  "productionLine",
]);

export interface VariantLintIssue {
  readonly id: string;
  readonly code: string;
  readonly message: string;
}

/** Lint a variant's override keys against the allowed field space. Deterministic; never throws. */
export function lintVariantOverrides(
  overrides: Readonly<Record<string, unknown>>,
): VariantLintIssue[] {
  const out: VariantLintIssue[] = [];
  for (const key of Object.keys(overrides).sort()) {
    if (OVERRIDABLE_FIELDS.has(key)) continue;
    if (key.startsWith("attributes.") || key.startsWith("constants.")) continue;
    out.push({
      id: key,
      code: "VARIANT_UNKNOWN_FIELD",
      message: `override field '${key}' is not overridable`,
    });
  }
  return out;
}

/** Apply a shallow override map to a base component, merging one level into `attributes`/`constants`/`parameters`. */
export function applyComponentOverrides(
  base: ComponentDef,
  overrides: Readonly<Record<string, string | number | readonly string[]>>,
): ComponentDef {
  const next: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    if (key.startsWith("attributes.") || key.startsWith("constants.")) {
      const [group, name] = key.split(".") as [string, string];
      next[group] = { ...base[group as "attributes" | "constants"], [name]: String(value) };
    } else if (key === "attributes" || key === "constants" || key === "parameters") {
      next[key] = {
        ...(base[key] as Record<string, unknown> | undefined),
        ...(value as object),
      };
    } else {
      next[key] = value;
    }
  }
  return next as unknown as ComponentDef;
}

/** A national gun model applied to its shared family, with the model's introduction floor enforced. */
export function applyGunModel(base: ComponentDef, model: GunModelDef): ComponentDef {
  const merged = applyComponentOverrides(base, model.overrides);
  const fromMonth = model.introductionMonth ?? merged.introduction.fromMonth;
  return {
    ...merged,
    introduction: {
      fromMonth:
        monthIndex(fromMonth) > monthIndex(merged.introduction.fromMonth)
          ? fromMonth
          : merged.introduction.fromMonth,
      obsoleteMonth: model.obsoleteMonth ?? merged.introduction.obsoleteMonth,
    },
  };
}

/** Read a numeric override-or-base value (e.g. an attribute), or undefined. */
function attrOf(def: ComponentDef, name: string): number | undefined {
  const raw = def.attributes?.[name] ?? def.constants?.[name];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export interface CatalogueSelection {
  readonly catalogue: readonly ComponentDef[];
  /** Family id → the national model id that replaced it (for the UI's provenance badge). */
  readonly appliedModels: Readonly<Record<string, string>>;
  /** Family ids removed because the nation cannot obtain them. */
  readonly unavailable: readonly string[];
}

/**
 * Derive a nation's component catalogue from the shared one at a month.
 *
 * Order of operations (all restrict-or-relabel, never widen):
 *  1. drop families whose access is UNAVAILABLE;
 *  2. enforce the hard-capability gun calibre ceiling (domestic, or the import ceiling for imported families, ADR-0114);
 *  3. overlay the newest applicable national gun model or component variant;
 *  4. apply a variant's introduction floor.
 */
export function catalogueForNation(
  base: readonly ComponentDef[],
  profile: NationNavalProfile,
  month: string,
): CatalogueSelection {
  const appliedModels: Record<string, string> = {};
  const unavailable: string[] = [];
  const out: ComponentDef[] = [];

  // Pick, per family, the newest national model introduced at or before the month; if every model is still in the
  // future, keep the earliest so the family survives (its introduction floor then date-gates it).
  const intro = (m?: string) => monthIndex(m ?? "1880-01");
  const pick = <T extends { introductionMonth?: string }>(
    list: readonly T[],
    familyOf: (t: T) => string,
  ): Map<string, T> => {
    const chosen = new Map<string, T>();
    for (const item of list) {
      const family = familyOf(item);
      const prev = chosen.get(family);
      const fits = intro(item.introductionMonth) <= monthIndex(month);
      if (prev === undefined) {
        chosen.set(family, item);
        continue;
      }
      const prevFits = intro(prev.introductionMonth) <= monthIndex(month);
      if (fits && (!prevFits || intro(item.introductionMonth) >= intro(prev.introductionMonth)))
        chosen.set(family, item);
      else if (!prevFits && intro(item.introductionMonth) < intro(prev.introductionMonth))
        chosen.set(family, item);
    }
    return chosen;
  };
  const gunByFamily = pick(profile.gunModels, (g) => g.familyId);
  const variantByFamily = pick(profile.componentVariants, (v) => v.familyId);

  for (const def of base) {
    const access = profile.componentAccess[def.id];
    if (access?.status === "UNAVAILABLE") {
      unavailable.push(def.id);
      continue;
    }
    // Hard-capability calibre ceiling: only restricts, never grants. A family the profile obtains from
    // abroad (IMPORTED/LICENSE_BUILT/CAPTURED_OR_STUDIED) may exceed the domestic ceiling up to the
    // nation's import ceiling; the domestic ceiling itself is never inflated (ADR-0114).
    const caliber = attrOf(def, "caliberUm");
    const importCeiling =
      profile.hardCapabilities.maxImportedGunCaliberUm ?? profile.hardCapabilities.maxGunCaliberUm;
    const ceiling =
      access !== undefined && access.status !== "DOMESTIC"
        ? importCeiling
        : profile.hardCapabilities.maxGunCaliberUm;
    if (caliber !== undefined && caliber > ceiling) continue;

    const gun = gunByFamily.get(def.id);
    if (gun !== undefined) {
      out.push(applyGunModel(def, gun));
      appliedModels[def.id] = gun.id;
      continue;
    }
    const variant = variantByFamily.get(def.id);
    if (variant !== undefined) {
      out.push(applyComponentOverrides(def, variant.overrides));
      appliedModels[def.id] = variant.id;
      continue;
    }
    out.push(def);
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { catalogue: out, appliedModels, unavailable };
}

/**
 * The nation's preferred ammunition pattern for a doctrine bias: the pattern whose penetration bias is closest to
 * the profile's `hePreferenceBp` (a low bias favours HE, a high bias AP). Deterministic tie-break by id.
 */
export function preferredAmmunition(profile: NationNavalProfile): AmmunitionPattern | null {
  const want = 10_000 - profile.doctrineProfile.hePreferenceBp; // hePreferenceBp 10000 = pure AP -> bias 0
  const sorted = [...profile.ammunitionPatterns].sort(
    (a, b) =>
      Math.abs(a.penetrationBiasBp - want) - Math.abs(b.penetrationBiasBp - want) ||
      (a.id < b.id ? -1 : 1),
  );
  return sorted.length === 0 ? null : sorted[0]!.pattern;
}

/** Lint a profile's arms content: override keys, duplicate ids, and release placeholders. */
export function lintNavalArms(profile: NationNavalProfile, release: boolean): VariantLintIssue[] {
  const out: VariantLintIssue[] = [];
  const seen = new Set<string>();
  const note = (id: string, code: string, message: string) => out.push({ id, code, message });
  const checkVariant = (v: {
    id: string;
    overrides: Readonly<Record<string, unknown>>;
    provenance: { sourceStatus: string };
  }) => {
    if (seen.has(v.id)) note(v.id, "VARIANT_DUPLICATE_ID", `duplicate variant id '${v.id}'`);
    seen.add(v.id);
    if (release && v.provenance.sourceStatus === "PLACEHOLDER")
      note(v.id, "VARIANT_PLACEHOLDER", `variant '${v.id}' is a PLACEHOLDER at release`);
    for (const issue of lintVariantOverrides(v.overrides)) note(v.id, issue.code, issue.message);
  };
  for (const g of profile.gunModels) checkVariant(g);
  for (const v of profile.componentVariants) checkVariant(v);
  for (const a of profile.ammunitionPatterns) {
    if (seen.has(a.id)) note(a.id, "VARIANT_DUPLICATE_ID", `duplicate variant id '${a.id}'`);
    seen.add(a.id);
    if (release && a.provenance.sourceStatus === "PLACEHOLDER")
      note(a.id, "VARIANT_PLACEHOLDER", `ammunition '${a.id}' is a PLACEHOLDER at release`);
  }
  return out;
}
