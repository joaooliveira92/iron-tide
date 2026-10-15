// packages/campaign/src/technologyMaterialization.ts
// DESIGN-03 §6 technology-variation materialization: turn canonical technology
// definitions plus a validated variation profile into a deterministic
// CampaignTechnologyManifest. The profile/manifest contracts and their
// validation live in ./technologyVariation.js; this module owns the algorithm.
import { sha256Hex } from "@bluewave/deterministic";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  computeTechnologyManifestHash,
  RNG_ALGORITHM_VERSION,
  STREAM_FAMILY,
  type CampaignTechnologyManifest,
  type TechnologyDefinition,
  type TechnologyManifestEntry,
  type TechnologyVariationProfile,
  validateTechnologyVariationProfile,
} from "./technologyVariation.js";

function buildKey(p: {
  campaignSeed: string;
  technologyId: string;
  settingId: string;
  formulaVersion: string;
  decisionTypeId: "availability_shift" | "effectiveness_multiplier";
}): string {
  return `${RNG_ALGORITHM_VERSION}|${p.campaignSeed}|${STREAM_FAMILY}|${p.technologyId}|${p.settingId}|${p.formulaVersion}|${p.decisionTypeId}`;
}

function uniformInt(key: string, min: number, max: number): number {
  const h = sha256Hex(key);
  const v = parseInt(h.slice(0, 8), 16);
  const range = max - min + 1;
  return min + (v % range);
}

function triangular(keyBase: string, min: number, max: number): number {
  const a = uniformInt(keyBase + "|a", min, max);
  const b = uniformInt(keyBase + "|b", min, max);
  return Math.trunc((a + b) / 2);
}

interface TechnologyVariationContext {
  profile: TechnologyVariationProfile;
  campaignSeed: string;
  contentHash: string;
  rulesetHash: string;
}

// Deep-clone the caller's definitions so materialization never mutates input.
function cloneTechnologyDefinitions(techs: TechnologyDefinition[]): TechnologyDefinition[] {
  return techs.map((t) => ({
    ...t,
    canonicalEffectValues: { ...t.canonicalEffectValues },
    variableEffectIds: [...t.variableEffectIds],
    prerequisiteTechnologyIds: [...(t.prerequisiteTechnologyIds ?? [])],
    prerequisiteDelayMonths:
      typeof t.prerequisiteDelayMonths === "object" && t.prerequisiteDelayMonths !== null
        ? { ...(t.prerequisiteDelayMonths as Record<string, number>) }
        : t.prerequisiteDelayMonths,
    effectVariationBounds: t.effectVariationBounds
      ? Object.fromEntries(Object.entries(t.effectVariationBounds).map(([k, v]) => [k, { ...v }]))
      : undefined,
  }));
}

// Apply ineligible defaults for incomplete metadata and reject invalid delays.
function normalizeAndValidateTechnologyMetadata(
  technologies: TechnologyDefinition[],
  c: DiagnosticCollector,
): boolean {
  for (const t of technologies) {
    const missing =
      t.variationEligible === undefined ||
      t.dateVariationEligible === undefined ||
      t.effectivenessVariationEligible === undefined ||
      t.earliestPermittedAvailabilityMonth === undefined ||
      t.latestPermittedAvailabilityMonth === undefined ||
      t.variableEffectIds === undefined ||
      t.prerequisiteTechnologyIds === undefined;
    if (missing) {
      c.addWarning(
        "TECHNOLOGY_VARIATION_METADATA_MISSING",
        `Technology ${t.technologyId} missing eligibility metadata, treated ineligible`,
        { stage: "technology-variation" },
      );
      t.variationEligible = false;
      t.dateVariationEligible = false;
      t.effectivenessVariationEligible = false;
    }
    if (t.prerequisiteDelayMonths !== undefined) {
      if (typeof t.prerequisiteDelayMonths === "number") {
        if (!Number.isInteger(t.prerequisiteDelayMonths) || t.prerequisiteDelayMonths < 0) {
          c.addError(
            "INVALID_TECHNOLOGY_VARIATION_PROFILE",
            `prerequisiteDelayMonths for ${t.technologyId} must be non-negative integer`,
            { stage: "technology-variation" },
          );
          return false;
        }
      } else if (typeof t.prerequisiteDelayMonths === "object") {
        for (const [pre, d] of Object.entries(
          t.prerequisiteDelayMonths as Record<string, number>,
        )) {
          if (!Number.isInteger(d) || d < 0) {
            c.addError(
              "INVALID_TECHNOLOGY_VARIATION_PROFILE",
              `prerequisiteDelayMonths[${pre}] for ${t.technologyId} must be non-negative integer`,
              { stage: "technology-variation" },
            );
            return false;
          }
        }
      }
    }
  }
  return true;
}

// Deterministic Kahn topological order; undefined on a prerequisite cycle.
function topologicalTechnologyOrder(
  technologies: TechnologyDefinition[],
  c: DiagnosticCollector,
): string[] | undefined {
  const adj = new Map<string, string[]>();
  const indeg = new Map<string, number>();
  for (const t of technologies) {
    adj.set(t.technologyId, []);
    indeg.set(t.technologyId, 0);
  }
  for (const t of technologies) {
    for (const pre of t.prerequisiteTechnologyIds ?? []) {
      if (adj.has(pre)) {
        adj.get(pre)!.push(t.technologyId);
        indeg.set(t.technologyId, (indeg.get(t.technologyId) ?? 0) + 1);
      }
    }
  }
  const ready = [...indeg.entries()]
    .filter(([, d]) => d === 0)
    .map(([id]) => id)
    .sort();
  const order: string[] = [];
  const q = [...ready];
  while (q.length) {
    const id = q.shift()!;
    order.push(id);
    const nxt = (adj.get(id) ?? []).sort();
    const newly: string[] = [];
    for (const dep of nxt) {
      const d = (indeg.get(dep) ?? 1) - 1;
      indeg.set(dep, d);
      if (d === 0) newly.push(dep);
    }
    newly.sort();
    q.push(...newly);
    q.sort();
  }
  if (order.length !== technologies.length) {
    const remaining = [...indeg.entries()]
      .filter(([, d]) => d > 0)
      .map(([id]) => id)
      .sort();
    c.addError(
      "TECHNOLOGY_PREREQUISITE_CYCLE",
      `Technology prerequisite cycle: ${remaining.join(", ")}`,
      { stage: "technology-variation" },
    );
    return undefined;
  }
  return order;
}

// §6.6: derive one technology's date shift and effectiveness multiplier.
function deriveTechnologyVariation(
  t: TechnologyDefinition,
  profile: TechnologyVariationProfile,
  campaignSeed: string,
  c: DiagnosticCollector,
): { shift: number; mult: number } | undefined {
  let shift = 0;
  let mult = 10_000;
  if (!t.variationEligible) return { shift, mult };
  if (t.dateVariationEligible) {
    if (profile.dateDistributionId === "constant_zero_v1") shift = 0;
    else if (profile.dateDistributionId === "symmetric_triangular_integer_v1") {
      const base = buildKey({
        campaignSeed,
        technologyId: t.technologyId,
        settingId: profile.settingId,
        formulaVersion: profile.variationFormulaVersion,
        decisionTypeId: "availability_shift",
      });
      shift = triangular(base, profile.earliestDateShiftMonths, profile.latestDateShiftMonths);
    }
  }
  if (t.effectivenessVariationEligible) {
    let effMin = profile.effectivenessVariationMinBp;
    let effMax = profile.effectivenessVariationMaxBp;
    if (t.effectVariationBounds) {
      for (const [effId, bounds] of Object.entries(t.effectVariationBounds)) {
        if (!Number.isInteger(bounds.minBp) || !Number.isInteger(bounds.maxBp)) {
          c.addError(
            "INVALID_TECHNOLOGY_VARIATION_PROFILE",
            `effectVariationBounds ${effId} must be integers`,
            { stage: "technology-variation" },
          );
          return undefined;
        }
        const eMin = Math.max(effMin, bounds.minBp);
        const eMax = Math.min(effMax, bounds.maxBp);
        if (eMin > eMax) {
          c.addError(
            "INVALID_EFFECT_VARIATION_BOUNDS",
            `Empty intersection for ${t.technologyId}.${effId} [${bounds.minBp}..${bounds.maxBp}] vs profile [${effMin}..${effMax}]`,
            { stage: "technology-variation" },
          );
          return undefined;
        }
        effMin = eMin;
        effMax = eMax;
      }
    }
    if (profile.effectivenessDistributionId === "constant_10000_v1") mult = 10_000;
    else if (profile.effectivenessDistributionId === "symmetric_triangular_integer_v1") {
      const base = buildKey({
        campaignSeed,
        technologyId: t.technologyId,
        settingId: profile.settingId,
        formulaVersion: profile.variationFormulaVersion,
        decisionTypeId: "effectiveness_multiplier",
      });
      mult = triangular(base, effMin, effMax);
    }
  }
  return { shift, mult };
}

// One technology's varied availability/effectiveness decision + manifest entry.
function materializeTechnologyEntry(
  t: TechnologyDefinition,
  context: TechnologyVariationContext,
  c: DiagnosticCollector,
): { entry: TechnologyManifestEntry; finalAvailabilityMonth: number } | undefined {
  const { profile, campaignSeed, contentHash, rulesetHash } = context;
  const derived = deriveTechnologyVariation(t, profile, campaignSeed, c);
  if (derived === undefined) return undefined;
  const { shift, mult } = derived;
  const raw = t.canonicalAvailabilityMonth + shift;
  const clamped = Math.min(
    Math.max(raw, t.earliestPermittedAvailabilityMonth),
    t.latestPermittedAvailabilityMonth,
  );
  const canonicalEff = { ...t.canonicalEffectValues };
  const varied: Record<string, number> = {};
  for (const [k, v] of Object.entries(canonicalEff)) {
    if (
      t.variableEffectIds.includes(k) &&
      t.effectivenessVariationEligible &&
      t.variationEligible
    ) {
      // §6.6: variedEffectValue = roundTowardZero(canonicalEffectValue * multiplierBp / 10_000).
      // BigInt division truncates toward zero, matching round-toward-zero for signed values
      // and floor for unsigned values.
      varied[k] = Number((BigInt(v) * BigInt(mult)) / BigInt(10000));
    } else varied[k] = v;
  }
  const entry: TechnologyManifestEntry = {
    technologyId: t.technologyId,
    canonicalAvailabilityMonth: t.canonicalAvailabilityMonth,
    selectedDateShift: shift,
    finalAvailabilityMonth: clamped,
    canonicalEffectValues: canonicalEff,
    effectivenessMultiplier: mult,
    finalVariedEffectValues: varied,
    eligibilityFlags: {
      variationEligible: t.variationEligible,
      dateVariationEligible: t.dateVariationEligible,
      effectivenessVariationEligible: t.effectivenessVariationEligible,
    },
    variationDecisionRecordIds: [
      buildKey({
        campaignSeed,
        technologyId: t.technologyId,
        settingId: profile.settingId,
        formulaVersion: profile.variationFormulaVersion,
        decisionTypeId: "availability_shift",
      }),
      buildKey({
        campaignSeed,
        technologyId: t.technologyId,
        settingId: profile.settingId,
        formulaVersion: profile.variationFormulaVersion,
        decisionTypeId: "effectiveness_multiplier",
      }),
    ],
    contentHash,
    rulesetHash,
    formulaVersion: profile.variationFormulaVersion,
  };
  return { entry, finalAvailabilityMonth: clamped };
}

// §6 prerequisite propagation: a successor may not become available before its
// predecessor plus the declared delay.
function propagatePrerequisiteAvailability(
  order: string[],
  byId: Map<string, TechnologyDefinition>,
  finalAvailability: Map<string, number>,
  entries: Record<string, TechnologyManifestEntry>,
): void {
  for (const id of order) {
    const t = byId.get(id)!;
    let cur = finalAvailability.get(id)!;
    for (const pre of t.prerequisiteTechnologyIds ?? []) {
      const preFinal = finalAvailability.get(pre);
      if (preFinal === undefined) continue;
      let delay = 0;
      if (typeof t.prerequisiteDelayMonths === "number") delay = t.prerequisiteDelayMonths;
      else if (typeof t.prerequisiteDelayMonths === "object" && t.prerequisiteDelayMonths !== null)
        delay = (t.prerequisiteDelayMonths as Record<string, number>)[pre] ?? 0;
      const required = preFinal + delay;
      if (cur < required) {
        cur = required;
        finalAvailability.set(id, cur);
        entries[id]!.finalAvailabilityMonth = cur;
      }
    }
  }
}

export function materializeTechnologyVariation(
  techs: TechnologyDefinition[],
  profile: TechnologyVariationProfile,
  campaignSeed: string,
  contentHash: string,
  rulesetHash: string,
  c: DiagnosticCollector,
): CampaignTechnologyManifest | undefined {
  if (!validateTechnologyVariationProfile(profile, c)) return undefined;
  const cloned = cloneTechnologyDefinitions(techs);
  const sorted = [...cloned].sort((a, b) => a.technologyId.localeCompare(b.technologyId));

  if (!normalizeAndValidateTechnologyMetadata(sorted, c)) return undefined;

  const order = topologicalTechnologyOrder(sorted, c);
  if (order === undefined) return undefined;

  const context: TechnologyVariationContext = { profile, campaignSeed, contentHash, rulesetHash };
  const byId = new Map(sorted.map((t) => [t.technologyId, t]));
  const entries: Record<string, TechnologyManifestEntry> = {};
  const finalAvailability = new Map<string, number>();

  for (const t of sorted) {
    const materialized = materializeTechnologyEntry(t, context, c);
    if (materialized === undefined) return undefined;
    entries[t.technologyId] = materialized.entry;
    finalAvailability.set(t.technologyId, materialized.finalAvailabilityMonth);
  }

  propagatePrerequisiteAvailability(order, byId, finalAvailability, entries);

  return {
    entries,
    contentHash,
    rulesetHash,
    formulaVersion: profile.variationFormulaVersion,
    manifestHash: computeTechnologyManifestHash({
      entries,
      contentHash,
      rulesetHash,
      formulaVersion: profile.variationFormulaVersion,
    }),
  };
}
