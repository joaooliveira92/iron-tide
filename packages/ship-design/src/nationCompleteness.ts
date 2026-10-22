import { compileDesign } from "./compile.js";
import { lintNavalArms } from "./componentVariants.js";
import { dockRecordFor, newConstructionDockEligibility } from "./dock.js";
import {
  lintArmamentContent,
  type ArmamentStarter,
  type AuthoredArmamentContent,
} from "./armamentContent.js";
import type { ComponentDef } from "./component.js";
import {
  placeholderIssues,
  resolveNavalProfile,
  type NationNavalProfile,
  type Provenance,
} from "./nationProfile.js";
import { PROCUREMENT_TYPES, roleGroupOf, type RoleGroup } from "./fleetProcurement.js";
import type { ShipBuildingContent } from "./shipBuildingContent.js";
import { starterFor, type StarterDesign } from "./shipTypeRoster.js";
import { computeCost, treasuryCostUnits } from "./cost.js";

export const REFERENCE_DESIGN_CLASSES = [
  "HISTORICAL_RECONSTRUCTION",
  "HISTORICALLY_INSPIRED",
  "DOCTRINE_TEMPLATE",
  "BALANCE_TEMPLATE",
] as const;
export type ReferenceDesignClass = (typeof REFERENCE_DESIGN_CLASSES)[number];

export interface CompletenessIssue {
  readonly nationId: string;
  readonly code: string;
  readonly path?: string;
  readonly message: string;
}

export interface NationCompletenessOptions {
  readonly profiles: readonly NationNavalProfile[];
  readonly starters: readonly StarterDesign[];
  readonly content: ShipBuildingContent;
  readonly openingMonth: string;
  readonly standardBudgetUnits: number;
  readonly knownComponentIds: ReadonlySet<string>;
  readonly classifications: Readonly<Record<string, ReferenceDesignClass>>;
  readonly release: boolean;
  readonly armament?: ArmamentCompletenessInput;
}

export interface ArmamentCompletenessInput {
  readonly content: AuthoredArmamentContent;
  readonly components: readonly ComponentDef[];
  readonly starters: readonly ArmamentStarter[];
  readonly technologies: readonly { readonly id: string; readonly year: number }[];
}

const err = (nationId: string, code: string, message: string): CompletenessIssue => ({
  nationId,
  code,
  message,
});

const monthIndex = (m: string): number => Number(m.slice(0, 4)) * 12 + (Number(m.slice(5, 7)) - 1);

function provenanceIssues(
  nationId: string,
  profile: NationNavalProfile,
  release: boolean,
): CompletenessIssue[] {
  const out: CompletenessIssue[] = [];
  const visit = (path: string, prov: Provenance): void => {
    for (const issue of placeholderIssues(nationId, path, prov, release))
      out.push({ nationId, code: issue.code, path, message: issue.message });
  };
  visit("profile.provenance", profile.provenance);
  visit("industrialProfile.provenance", profile.industrialProfile.provenance);
  visit("dock.provenance", profile.dock.provenance);
  visit("doctrineProfile.provenance", profile.doctrineProfile.provenance);
  for (const [familyId, access] of Object.entries(profile.componentAccess))
    if (access.provenance !== undefined)
      visit(`componentAccess.${familyId}.provenance`, access.provenance);
  for (const g of profile.gunModels) visit(`gunModels.${g.id}.provenance`, g.provenance);
  for (const a of profile.ammunitionPatterns)
    visit(`ammunitionPatterns.${a.id}.provenance`, a.provenance);
  for (const v of profile.componentVariants)
    visit(`componentVariants.${v.id}.provenance`, v.provenance);
  return out;
}

export function validateNationCompleteness(
  opts: NationCompletenessOptions,
  nationId: string,
): CompletenessIssue[] {
  const out: CompletenessIssue[] = [];
  const own = opts.profiles.filter((p) => p.nationId === nationId);
  if (own.length === 0) return [err(nationId, "NATION_NO_PROFILE", "no naval profile authored")];

  const sorted = [...own].sort((a, b) => monthIndex(a.activeFrom) - monthIndex(b.activeFrom));
  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i]!;
    if (p.activeUntil !== null && monthIndex(p.activeUntil) < monthIndex(p.activeFrom))
      out.push(err(nationId, "NATION_BAND_ORDER", `${p.activeFrom}..${p.activeUntil} is inverted`));
    const next = sorted[i + 1];
    if (
      next !== undefined &&
      p.activeUntil !== null &&
      monthIndex(p.activeUntil) >= monthIndex(next.activeFrom)
    )
      out.push(
        err(
          nationId,
          "NATION_BAND_OVERLAP",
          `${p.activeFrom}..${p.activeUntil} overlaps ${next.activeFrom}`,
        ),
      );
  }

  const opening = resolveNavalProfile(opts.profiles, nationId, opts.openingMonth);
  if (opening === null)
    return [...out, err(nationId, "NATION_NO_OPENING_PROFILE", "no profile at opening month")];

  if (opening.hardCapabilities.hullForms.length === 0)
    out.push(err(nationId, "NATION_HARD_INCOMPLETE", "no hull forms allowed"));
  if (opening.hardCapabilities.domesticPlants.length === 0)
    out.push(err(nationId, "NATION_HARD_INCOMPLETE", "no domestic plants"));
  if (opening.doctrineProfile.postures.length === 0)
    out.push(err(nationId, "NATION_DOCTRINE_INCOMPLETE", "no strategic postures"));

  for (const v of [...opening.gunModels, ...opening.componentVariants]) {
    if (!opts.knownComponentIds.has(v.familyId))
      out.push(
        err(
          nationId,
          "NATION_UNKNOWN_COMPONENT",
          `${v.id} overlays unknown family '${v.familyId}'`,
        ),
      );
    if (
      v.introductionMonth !== undefined &&
      v.obsoleteMonth != null &&
      monthIndex(v.obsoleteMonth) < monthIndex(v.introductionMonth)
    )
      out.push(err(nationId, "NATION_VARIANT_DATE", `${v.id} retires before it is introduced`));
  }
  for (const key of Object.keys(opening.componentAccess))
    if (!opts.knownComponentIds.has(key))
      out.push(
        err(nationId, "NATION_UNKNOWN_COMPONENT", `componentAccess names unknown family '${key}'`),
      );

  for (const issue of lintNavalArms(opening, opts.release))
    if (issue.code !== "VARIANT_PLACEHOLDER") out.push(err(nationId, issue.code, issue.message));
  out.push(...provenanceIssues(nationId, opening, opts.release));

  const env = opts.content.environmentFor(opts.openingMonth, nationId);
  const coveredGroups = new Set<RoleGroup>();
  for (const type of PROCUREMENT_TYPES) {
    const starter = starterFor(type, opts.starters, opts.openingMonth, nationId);
    if (starter === null) {
      out.push(err(nationId, "NATION_STARTER_MISSING", `no opening ${type} starter`));
      continue;
    }
    const classification = opts.classifications[starter.id];
    if (classification === undefined || !REFERENCE_DESIGN_CLASSES.includes(classification))
      out.push(
        err(nationId, "NATION_STARTER_UNCLASSIFIED", `${starter.id} has no valid classification`),
      );
    const compiled = compileDesign(starter.draft, env.ctx);
    const blocking = compiled.findings.filter((f) => f.severity === "BLOCKING");
    if (!compiled.valid || blocking.length > 0)
      out.push(
        err(
          nationId,
          "NATION_STARTER_ILLEGAL",
          `${starter.id}: ${blocking.map((f) => f.id).join(", ")}`,
        ),
      );
    if (compiled.naturalClass !== type)
      out.push(
        err(
          nationId,
          "NATION_STARTER_CLASS",
          `${starter.id} classifies as ${compiled.naturalClass}, not ${type}`,
        ),
      );
    if (compiled.findings.some((f) => f.id === "NO_FACILITY_FITS"))
      out.push(err(nationId, "NATION_STARTER_NO_DOCK", `${starter.id} fits no dock`));
    const dock = newConstructionDockEligibility(dockRecordFor(opening), {
      lengthMm: 0,
      beamMm: 0,
      displacementKg: compiled.totalKg,
      heaviestKg: 0,
    });
    if (!dock.eligible)
      out.push(
        err(
          nationId,
          "NATION_STARTER_EXCEEDS_DOCK",
          `${starter.id}: ${dock.rejections.map((r) => r.code).join(", ")}`,
        ),
      );
    const cost = treasuryCostUnits(
      computeCost(compiled, starter.draft, env.costBalance, env.costCtx).total,
      opts.content.treasuryUnitMicro,
    );
    if (cost > opts.standardBudgetUnits)
      out.push(
        err(
          nationId,
          "NATION_STARTER_UNAFFORDABLE",
          `${starter.id} costs ${String(cost)} > ${String(opts.standardBudgetUnits)}`,
        ),
      );
    coveredGroups.add(roleGroupOf(type));
  }
  for (const group of ["capital", "cruiser", "light", "colonial"] as const)
    if (!coveredGroups.has(group))
      out.push(err(nationId, "NATION_ROLE_UNCOVERED", `no viable procurement path for ${group}`));

  const again = resolveNavalProfile(opts.profiles, nationId, opts.openingMonth);
  if (again === null || again.activeFrom !== opening.activeFrom)
    out.push(
      err(nationId, "NATION_RESOLUTION_NONDETERMINISTIC", "profile resolution is not stable"),
    );

  return out;
}

export function validateAllNations(opts: NationCompletenessOptions): CompletenessIssue[] {
  const nations = [...new Set(opts.profiles.map((p) => p.nationId))].sort();
  return [
    ...nations.flatMap((nationId) => validateNationCompleteness(opts, nationId)),
    ...validateArmamentContent(opts),
  ];
}

export function validateArmamentContent(opts: NationCompletenessOptions): CompletenessIssue[] {
  if (opts.armament === undefined) return [];
  const findings = lintArmamentContent({
    ...opts.armament,
    profiles: opts.profiles,
    release: opts.release,
  });
  return findings
    .filter((f) => f.severity === "BLOCKING")
    .map((f) => err(f.entity.id, f.code, f.message));
}
