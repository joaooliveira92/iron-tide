import type { ComponentDef } from "./component.js";
import type { AmmunitionPattern, GunModelDef, NationNavalProfile } from "./nationProfile.js";

const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + (Number(m.slice(5, 7)) - 1);

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

function attrOf(def: ComponentDef, name: string): number | undefined {
  const raw = def.attributes?.[name] ?? def.constants?.[name];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export interface CatalogueSelection {
  readonly catalogue: readonly ComponentDef[];
  readonly appliedModels: Readonly<Record<string, string>>;
  readonly unavailable: readonly string[];
}

export function catalogueForNation(
  base: readonly ComponentDef[],
  profile: NationNavalProfile,
  month: string,
): CatalogueSelection {
  const appliedModels: Record<string, string> = {};
  const unavailable: string[] = [];
  const out: ComponentDef[] = [];

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

export function preferredAmmunition(profile: NationNavalProfile): AmmunitionPattern | null {
  const want = 10_000 - profile.doctrineProfile.hePreferenceBp;
  const sorted = [...profile.ammunitionPatterns].sort(
    (a, b) =>
      Math.abs(a.penetrationBiasBp - want) - Math.abs(b.penetrationBiasBp - want) ||
      (a.id < b.id ? -1 : 1),
  );
  return sorted.length === 0 ? null : sorted[0]!.pattern;
}

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
