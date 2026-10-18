import { groupedInteger } from "./numberText.js";
import type { Finding } from "./findings.js";
import { placementTarget, sortFindings } from "./findings.js";
import { evaluate, type LookupTable } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import { toSafe } from "./units.js";

export const ARMOUR_REGIONS = [
  "BELT_MAIN",
  "BELT_UPPER",
  "BELT_ENDS",
  "DECK_MAIN",
  "DECK_SLOPE",
  "DECK_EXTENDED",
  "TURRET",
  "TURRET_TOP",
  "SECONDARY_GUN",
  "CONNING_TOWER",
  "MAGAZINE_BOX",
  "SPLINTER_PLATING",
  "TORPEDO_BULKHEAD",
  "TORPEDO_BELT",
] as const;

/** Regions that face plunging fire at reduced striking velocity (`ArmourBalance.deckPenetrationBp`). */
const DECK_REGIONS: ReadonlySet<ArmourRegionId> = new Set([
  "DECK_MAIN",
  "DECK_SLOPE",
  "DECK_EXTENDED",
]);
export type ArmourRegionId = (typeof ARMOUR_REGIONS)[number];

export interface ArmourRegion {
  readonly region: ArmourRegionId;
  readonly thicknessUm: number;
  readonly lengthMm: number;
  readonly heightMm: number;
  readonly materialId: string;
  /** cos(obliquity) in bp: 10_000 for a flat-on hit, lower for sloped plate (more effective). */
  readonly cosObliquityBp: number;
}

/** What the design must resist: a reference shell class with its penetration at the intended range band. */
export interface ThreatProfile {
  readonly id: string;
  readonly penetrationUm: number;
}

/** When an armour material may be fitted, and the thickest plate of it that can be made. All fields but `fromMonth` optional. */
export interface ArmourMaterialAvailability {
  readonly requires?: readonly string[];
  readonly fromMonth: string;
  readonly obsoleteMonth?: string | null;
  /** Thickest plate of this material that can be manufactured, um. */
  readonly maxThicknessUm?: number;
}

export interface ArmourBalance {
  /**
   * Optional availability per material. A material without an entry is unrestricted, so content that does not (yet)
   * declare availability behaves as before.
   */
  readonly materialAvailability?: Readonly<Record<string, ArmourMaterialAvailability>>;
  readonly steelKgPerM3: number;
  readonly backingBp: number;
  readonly fixingsBp: number;
  /** Effective-thickness multiplier per armour material, bp. */
  readonly materialEffBp: Readonly<Record<string, number>>;
  /** Deck armour faces plunging fire at reduced striking velocity: threat penetration x this / 10_000 for DECK_* regions. */
  readonly deckPenetrationBp: number;
  readonly coverageWarnBp: number;
  readonly coverageCriticalBp: number;
  readonly magazineWarnBp: number;
  readonly magazineCriticalBp: number;
  /** Required torpedo-bulkhead depth (mm) versus warhead mass (kg). */
  readonly underwaterRequiredDepth: LookupTable;
  readonly floodBaseBp: readonly [number, number, number, number, number];
  readonly floodReserveWeightBp: number;
  readonly floodDamageControlWeightBp: number;
  readonly magVulnBaseBp: number;
  readonly magVulnBoilerBp: number;
  readonly magVulnTorpedoBp: number;
}

const BP = 10_000n;
const fmt = (n: number) => groupedInteger(n);

/** F-A1: region plate weight in kg, rounded up. */
export function regionWeightKg(r: ArmourRegion, b: ArmourBalance): number {
  if (r.thicknessUm < 0 || r.lengthMm < 0 || r.heightMm < 0)
    throw new Error("armour dimensions must be >= 0");
  const area = BigInt(r.lengthMm) * BigInt(r.heightMm); // mm2
  const num =
    area *
    BigInt(r.thicknessUm) *
    BigInt(b.steelKgPerM3) *
    BigInt(b.backingBp) *
    BigInt(b.fixingsBp);
  const den = 1000n * 1_000_000_000n * BP * BP; // um->mm, mm3->m3
  return toSafe("regionWeight", (num + den - 1n) / den);
}

/** F-A2: penetration margin in bp, clamped to [-10000, +10000]. Negative = the shell defeats the plate. */
export function penetrationMarginBp(
  r: ArmourRegion,
  threat: ThreatProfile,
  b: ArmourBalance,
): number {
  const eff = b.materialEffBp[r.materialId];
  if (eff === undefined) throw new Error(`unknown armour material '${r.materialId}'`);
  if (threat.penetrationUm <= 0) throw new Error("threat penetration must be > 0");
  const effective = (BigInt(r.thicknessUm) * BigInt(eff) * BigInt(r.cosObliquityBp)) / (BP * BP);
  const pen = BigInt(threat.penetrationUm);
  const raw = ((effective - pen) * BP) / pen;
  const v = raw > BP ? BP : raw < -BP ? -BP : raw;
  return Number(v);
}

export interface MagazineProtectionInput {
  readonly magazineId: string;
  readonly beltMarginBp: number | null;
  readonly deckMarginBp: number | null;
  readonly boxMarginBp: number | null;
  readonly adjacentBoilers: boolean;
  readonly adjacentTorpedoTubes: boolean;
  readonly flashProtectionBp: number;
}

export interface ArmourInput {
  readonly regions: readonly ArmourRegion[];
  readonly threats: readonly ThreatProfile[];
  /** The adversary the requirement expects (must be in `threats`). */
  readonly designThreatId: string;
  readonly citadelLengthMm: number;
  readonly magazines: readonly MagazineProtectionInput[];
  readonly torpedoWarheadKg: number;
  readonly bunkerProtectionBp: number;
  readonly subdivisionGrade: 0 | 1 | 2 | 3 | 4;
  readonly reserveBuoyancyBp: number;
  readonly damageControlBp: number;
  /** Fire-risk contributions (bp) of flammable stowages, already summed per tag by the caller. */
  readonly flammableBp: number;
}

export interface ArmourResult {
  readonly weightByRegionKg: Readonly<Record<string, number>>;
  readonly totalWeightKg: number;
  /** Margin in bp per region per threat id. */
  readonly marginBp: Readonly<Record<string, Readonly<Record<string, number>>>>;
  readonly coverageBp: number;
  readonly magazineProtectionBp: Readonly<Record<string, number>>;
  readonly magazineVulnerabilityBp: Readonly<Record<string, number>>;
  readonly underwaterResistanceBp: number;
  readonly floodingResistanceBp: number;
  readonly fireRiskBp: number;
  readonly findings: readonly Finding[];
}

const clampBp = (v: number, lo = 0, hi = 10_000) => Math.max(lo, Math.min(hi, v));

export function compileArmour(input: ArmourInput, b: ArmourBalance): ArmourResult {
  const findings: Finding[] = [];
  const designThreat = input.threats.find((t) => t.id === input.designThreatId);
  if (!designThreat) throw new Error(`design threat '${input.designThreatId}' not in threats`);

  const regions = [...input.regions].sort((x, y) =>
    x.region < y.region ? -1 : x.region > y.region ? 1 : 0,
  );
  const weightByRegionKg: Record<string, number> = {};
  const marginBp: Record<string, Record<string, number>> = {};
  let total = 0;
  for (const r of regions) {
    weightByRegionKg[r.region] = (weightByRegionKg[r.region] ?? 0) + regionWeightKg(r, b);
    total += regionWeightKg(r, b);
    const m: Record<string, number> = marginBp[r.region] ?? {};
    const isDeck = DECK_REGIONS.has(r.region);
    for (const t of input.threats) {
      const effective = isDeck
        ? {
            ...t,
            penetrationUm: Math.max(
              1,
              Math.floor((t.penetrationUm * b.deckPenetrationBp) / 10_000),
            ),
          }
        : t;
      m[t.id] = Math.max(m[t.id] ?? -10_000, penetrationMarginBp(r, effective, b));
    }
    marginBp[r.region] = m;
  }
  const margin = (region: ArmourRegionId): number | null =>
    marginBp[region]?.[designThreat.id] ?? null;

  const belt = regions.filter((r) => r.region === "BELT_MAIN").reduce((a, r) => a + r.lengthMm, 0);
  const coverageBp =
    input.citadelLengthMm <= 0
      ? 0
      : Math.min(10_000, toSafe("cov", (BigInt(belt) * BP) / BigInt(input.citadelLengthMm)));
  if (input.citadelLengthMm > 0 && coverageBp < b.coverageWarnBp) {
    const critical = coverageBp < b.coverageCriticalBp;
    findings.push({
      id: "CITADEL_INCOMPLETE",
      severity: critical ? "CRITICAL" : "WARNING",
      what: "The armoured belt does not cover the machinery and magazine spaces.",
      why: `Belt ${fmt(belt)} mm of ${fmt(input.citadelLengthMm)} mm citadel = ${coverageBp} bp (limit ${critical ? b.coverageCriticalBp : b.coverageWarnBp} bp).`,
      consequence:
        "Shells can reach the boilers or magazines at the waterline; one hit can cripple the ship.",
      remedies: [
        {
          id: "extend_belt",
          description: `Extend the belt by about ${fmt(input.citadelLengthMm - belt)} mm (adds weight).`,
        },
        {
          id: "shorten_citadel",
          description: "Shorten the citadel by compacting machinery or magazines.",
        },
        { id: "thin_belt", description: "Thin the belt to afford full length coverage." },
      ],
      evidence: {
        formulaId: "F-A3",
        inputs: { belt, citadel: input.citadelLengthMm },
        threshold: b.coverageWarnBp,
        value: coverageBp,
      },
    });
  }

  const sides = [
    margin("BELT_MAIN"),
    margin("DECK_MAIN"),
    margin("DECK_EXTENDED"),
    margin("TURRET"),
  ].filter((v): v is number => v !== null);
  if (sides.length > 0 && sides.every((v) => v < 0)) {
    findings.push({
      id: "ARMOUR_INEFFECTIVE_VS_ADVERSARY",
      severity: "WARNING",
      what: `No armour region defeats the expected adversary (${designThreat.id}).`,
      why: `Best margin ${Math.max(...sides)} bp against ${fmt(designThreat.penetrationUm)} µm penetration.`,
      consequence:
        "The protection adds weight but does not stop the shells the ship is expected to meet.",
      remedies: [
        {
          id: "thicker_belt",
          description: "Thicken the belt or deck, or use a more effective armour material.",
        },
        { id: "slope_plate", description: "Slope the plate to raise effective thickness." },
        { id: "drop_armour", description: "Give up armour and spend the weight on speed or guns." },
      ],
      evidence: {
        formulaId: "F-A2",
        inputs: { penetrationUm: designThreat.penetrationUm },
        threshold: 0,
        value: Math.max(...sides),
      },
    });
  }

  const magazineProtectionBp: Record<string, number> = {};
  const magazineVulnerabilityBp: Record<string, number> = {};
  for (const m of [...input.magazines].sort((x, y) => (x.magazineId < y.magazineId ? -1 : 1))) {
    const parts = [m.beltMarginBp, m.deckMarginBp, m.boxMarginBp].filter(
      (v): v is number => v !== null,
    );
    const prot = parts.length === 0 ? -10_000 : Math.min(...parts);
    magazineProtectionBp[m.magazineId] = prot;
    magazineVulnerabilityBp[m.magazineId] = clampBp(
      b.magVulnBaseBp +
        (m.adjacentBoilers ? b.magVulnBoilerBp : 0) +
        (m.adjacentTorpedoTubes ? b.magVulnTorpedoBp : 0) -
        m.flashProtectionBp,
    );
    if (prot < b.magazineWarnBp) {
      const critical = prot < b.magazineCriticalBp;
      findings.push({
        id: "MAGAZINE_UNPROTECTED",
        severity: critical ? "CRITICAL" : "WARNING",
        what: `Magazine ${m.magazineId} is not protected against the expected adversary.`,
        why: `Weakest protection margin ${prot} bp (limit ${critical ? b.magazineCriticalBp : b.magazineWarnBp} bp).`,
        consequence: "A single penetrating hit can detonate the magazine and lose the ship.",
        remedies: [
          {
            id: "armour_box",
            description: "Add a magazine armour box or thicken deck/belt over it.",
          },
          {
            id: "move_magazine",
            description: "Move the magazine behind the thickest armour, away from the hull sides.",
          },
          { id: "flash_protection", description: "Fit flash protection to limit propagation." },
        ],
        evidence: {
          formulaId: "F-A4",
          inputs: { threatPenetrationUm: designThreat.penetrationUm },
          threshold: critical ? b.magazineCriticalBp : b.magazineWarnBp,
          value: prot,
        },
        subject: { targets: [placementTarget(m.magazineId)] },
      });
    }
  }

  // F-A5 underwater: effective depth = bulkhead thickness-equivalent from the TORPEDO_BULKHEAD/BELT regions' heights plus bunkers.
  const tb = regions.filter((r) => r.region === "TORPEDO_BULKHEAD" || r.region === "TORPEDO_BELT");
  const depthMm = tb.reduce((a, r) => a + r.heightMm, 0);
  const required = Math.max(
    1,
    evaluate(parseFormula("lookup(req, w)"), {
      vars: { w: input.torpedoWarheadKg },
      tables: { req: b.underwaterRequiredDepth },
    }),
  );
  const effDepth = toSafe(
    "effDepth",
    (BigInt(depthMm) * (BP + BigInt(input.bunkerProtectionBp))) / BP,
  );
  const underwaterResistanceBp = clampBp(toSafe("uw", (BigInt(effDepth) * BP) / BigInt(required)));

  // F-A6 flooding resistance, F-A7 fire risk
  const floodingResistanceBp = clampBp(
    b.floodBaseBp[input.subdivisionGrade] +
      toSafe("fr", (BigInt(input.reserveBuoyancyBp) * BigInt(b.floodReserveWeightBp)) / BP) +
      toSafe("fd", (BigInt(input.damageControlBp) * BigInt(b.floodDamageControlWeightBp)) / BP),
  );
  const fireRiskBp = clampBp(input.flammableBp - input.damageControlBp);

  return {
    weightByRegionKg,
    totalWeightKg: total,
    marginBp,
    coverageBp,
    magazineProtectionBp,
    magazineVulnerabilityBp,
    underwaterResistanceBp,
    floodingResistanceBp,
    fireRiskBp,
    findings: sortFindings(findings),
  };
}

const gateFinding = (
  id: string,
  severity: Finding["severity"],
  what: string,
  why: string,
  consequence: string,
  remedies: [string, string][],
  threshold: number,
  value: number,
): Finding => ({
  id,
  severity,
  what,
  why,
  consequence,
  remedies: remedies.map(([rid, description]) => ({ id: rid, description })),
  evidence: { formulaId: "F-A-AVAIL", inputs: {}, threshold, value },
});

/**
 * The single armour tech gate, used by the design compile (all regions) and by refits (only the regions a refit installs).
 * Not yet introduced / missing tech / plate thicker than the material allows are BLOCKING; an obsolete material is ADVISORY,
 * as for components. Pure and order-stable (input order).
 */
export function armourAvailabilityFindings(
  regions: readonly ArmourRegion[],
  b: ArmourBalance,
  month: string,
  unlockedTechs: ReadonlySet<string>,
): Finding[] {
  const out: Finding[] = [];
  for (const r of regions) {
    const a = b.materialAvailability?.[r.materialId];
    if (a === undefined) continue;
    const missing = (a.requires ?? []).filter((t) => !unlockedTechs.has(t));
    if (missing.length > 0 || a.fromMonth > month) {
      out.push(
        gateFinding(
          "ARMOUR_TECH_UNAVAILABLE",
          "BLOCKING",
          `${r.materialId} armour (${r.region}) is not available to this nation yet.`,
          missing.length > 0
            ? `Missing technology: ${missing.join(", ")}.`
            : `Introduced ${a.fromMonth}; current month ${month}.`,
          "A ship cannot carry armour that cannot yet be made.",
          [
            ["research", "Research the missing technology."],
            ["alternative", "Use an earlier armour material that is available."],
            ["wait", "Delay the work until the material is available."],
          ],
          0,
          1,
        ),
      );
      continue;
    }
    if (a.obsoleteMonth != null && a.obsoleteMonth <= month) {
      out.push(
        gateFinding(
          "ARMOUR_MATERIAL_OBSOLETE",
          "ADVISORY",
          `${r.materialId} armour (${r.region}) is obsolete.`,
          `Obsolete since ${a.obsoleteMonth}.`,
          "The plate is outclassed by newer armour.",
          [["upgrade", "Use a newer armour material."]],
          0,
          1,
        ),
      );
    }
    if (a.maxThicknessUm !== undefined && r.thicknessUm > a.maxThicknessUm) {
      out.push(
        gateFinding(
          "ARMOUR_THICKNESS_UNAVAILABLE",
          "BLOCKING",
          `${r.materialId} plate for ${r.region} is thicker than can be made.`,
          `${fmt(r.thicknessUm)} um requested; at most ${fmt(a.maxThicknessUm)} um.`,
          "Industry cannot roll or forge a plate that thick in this material.",
          [
            ["thinner", "Reduce the plate thickness."],
            ["other_material", "Use a different armour material."],
            ["wait", "Delay the work until thicker plate can be made."],
          ],
          a.maxThicknessUm,
          r.thicknessUm,
        ),
      );
    }
  }
  return out;
}

/** One armour material as the Drawing Board offers it for a month. */
export interface ArmourMaterialOption {
  readonly id: string;
  /** Effective-thickness multiplier, bp (higher = better plate). */
  readonly effBp: number;
  /** False when the material is not yet introduced or its technology is missing. */
  readonly available: boolean;
  /** Why it is unavailable, or null. */
  readonly unavailableReason: string | null;
  /** Thickest plate that can be made, um, or null when unlimited. */
  readonly maxThicknessUm: number | null;
  readonly obsolete: boolean;
}

/** The armour materials of the balance, weakest first (then by id), with their availability for `month`. Pure. */
export function armourMaterialOptions(
  b: ArmourBalance,
  month: string,
  unlockedTechs: ReadonlySet<string>,
): ArmourMaterialOption[] {
  return Object.entries(b.materialEffBp)
    .map(([id, effBp]): ArmourMaterialOption => {
      const a = b.materialAvailability?.[id];
      const missing = (a?.requires ?? []).filter((t) => !unlockedTechs.has(t));
      const notYet = a !== undefined && a.fromMonth > month;
      const unavailableReason =
        missing.length > 0
          ? `needs ${missing.join(", ")}`
          : notYet
            ? `introduced ${a.fromMonth}`
            : null;
      return {
        id,
        effBp,
        available: unavailableReason === null,
        unavailableReason,
        maxThicknessUm: a?.maxThicknessUm ?? null,
        obsolete: a?.obsoleteMonth != null && a.obsoleteMonth <= month,
      };
    })
    .sort((x, y) => x.effBp - y.effBp || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
}

/** The hull and citadel measurements a new region's starting size is taken from. */
export interface RegionSizing {
  readonly lengthWlMm: number;
  readonly beamMm: number;
  readonly depthMm: number;
  /** Citadel length; 0 means "not set", and the starting size falls back to 60% of the waterline length. */
  readonly citadelLengthMm: number;
}

/** Starting plate thickness for a new region, um. A convention to start from, not a recommendation. */
const START_THICKNESS_UM: Readonly<Record<ArmourRegionId, number>> = {
  BELT_MAIN: 150_000,
  BELT_UPPER: 75_000,
  BELT_ENDS: 75_000,
  DECK_MAIN: 50_000,
  DECK_SLOPE: 75_000,
  DECK_EXTENDED: 50_000,
  TURRET: 150_000,
  TURRET_TOP: 50_000,
  SECONDARY_GUN: 75_000,
  CONNING_TOWER: 150_000,
  MAGAZINE_BOX: 50_000,
  SPLINTER_PLATING: 12_000,
  TORPEDO_BULKHEAD: 25_000,
  TORPEDO_BELT: 25_000,
};

/**
 * A new armour region with deterministic starting dimensions taken from the hull: belts and decks follow the citadel,
 * ends take the rest of the waterline, turrets/barbettes/tower are small fixed blocks. All of it is a starting convention
 * the player edits (`materialId` is the caller's choice, `cosObliquityBp` starts flat-on). Dimensions are floored at 0.
 */
export function newArmourRegion(
  region: ArmourRegionId,
  size: RegionSizing,
  materialId: string,
): ArmourRegion {
  const citadel =
    size.citadelLengthMm > 0 ? size.citadelLengthMm : Math.floor((size.lengthWlMm * 6) / 10);
  const beltHeight = Math.max(0, Math.floor(Math.min(2_400, (size.depthMm * 35) / 100)));
  const deckWidth = Math.max(0, Math.floor((size.beamMm * 8) / 10));
  const dims: Record<ArmourRegionId, readonly [number, number]> = {
    BELT_MAIN: [citadel, beltHeight],
    BELT_UPPER: [citadel, beltHeight],
    BELT_ENDS: [Math.max(0, size.lengthWlMm - citadel), beltHeight],
    DECK_MAIN: [citadel, deckWidth],
    DECK_SLOPE: [citadel, deckWidth],
    DECK_EXTENDED: [Math.max(0, size.lengthWlMm - citadel), deckWidth],
    TURRET: [6_000, 2_500],
    TURRET_TOP: [4_000, 4_000],
    SECONDARY_GUN: [3_000, 2_000],
    CONNING_TOWER: [3_000, 2_000],
    MAGAZINE_BOX: [citadel, deckWidth],
    SPLINTER_PLATING: [citadel, beltHeight],
    TORPEDO_BULKHEAD: [citadel, beltHeight],
    TORPEDO_BELT: [citadel, beltHeight],
  };
  const [lengthMm, heightMm] = dims[region];
  return {
    region,
    thicknessUm: START_THICKNESS_UM[region],
    lengthMm,
    heightMm,
    materialId,
    cosObliquityBp: 10_000,
  };
}

/**
 * "All or nothing": armour only the citadel. Belts and decks are cut to the citadel length; the upper belt, the extended deck and
 * the unarmoured ends are dropped; everything else is kept as is. Pure. The caller supplies the citadel length.
 */
export function allOrNothingRegions(
  regions: readonly ArmourRegion[],
  citadelLengthMm: number,
): ArmourRegion[] {
  const cut = new Set<ArmourRegionId>(["BELT_MAIN", "DECK_MAIN", "DECK_SLOPE", "MAGAZINE_BOX"]);
  const drop = new Set<ArmourRegionId>(["BELT_ENDS", "BELT_UPPER", "DECK_EXTENDED"]);
  return regions
    .filter((r) => !drop.has(r.region))
    .map((r) =>
      cut.has(r.region) ? { ...r, lengthMm: Math.min(r.lengthMm, citadelLengthMm) } : r,
    );
}
