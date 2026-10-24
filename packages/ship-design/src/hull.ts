import { groupedInteger } from "./numberText.js";
import { quantity } from "./explanation.js";
import { powRational } from "@bluewave/deterministic";
import type { Finding, Remedy } from "./findings.js";
import { sortFindings } from "./findings.js";
import {
  LEDGER_CATEGORIES,
  ledgerTotal,
  withLine,
  type DisplacementLedger,
  type LedgerCategory,
} from "./ledger.js";
import { kg, toSafe, type Bp, type Kg, type Mm } from "./units.js";
import { designInvariant } from "./errors.js";

export interface HullForm {
  readonly id: string;
  readonly lengthMinMm: number;
  readonly lengthMaxMm: number;
  readonly lbMinX100: number;
  readonly lbMaxX100: number;
  readonly formBp: Bp;
  readonly waterplaneCoeffBp: Bp;
  readonly sheerBp: Bp;
}

export interface HullSpec {
  readonly hullFormId: string;
  readonly lengthWl: Mm;
  readonly beam: Mm;
  readonly draught: Mm;
  readonly depthToMainDeck: Mm;
  readonly blockCoeffBp: Bp;
  readonly materialId: string;
  readonly structuralSchemeId: string;
  readonly subdivisionGrade: 0 | 1 | 2 | 3 | 4;
  readonly targetDisplacementKg: Kg;
  readonly limitDisplacementKg: Kg | null;
  readonly designMarginBp: Bp;
  readonly growthReserveBp: Bp;
  readonly freeboardProfile?: "NORMAL" | "LOW";
}

export interface HullBalance {
  readonly hullCoeffMilliKg: number;
  readonly seawaterKgPerM3: number;
  readonly materialBp: Readonly<Record<string, number>>;
  readonly schemeBp: Readonly<Record<string, number>>;
  readonly subdivisionBp: readonly [number, number, number, number, number];
  readonly buoyancyTolBp: number;
  readonly overTargetTolBp: number;
  readonly reserveBuoyancyWarnBp: number;
  readonly reserveBuoyancyCriticalBp: number;
  readonly lowFreeboardReserveCutBp?: number;
  readonly lowFreeboardHullWeightSavingBp?: number;
}

export interface HullResult {
  readonly ledger: DisplacementLedger;
  readonly totalKg: Kg;
  readonly buoyantKg: Kg;
  readonly freeboardMm: number;
  readonly reserveBuoyancyBp: number;
  readonly findings: readonly Finding[];
}

const BP = 10_000n;
const MM3_PER_M3 = 1_000_000_000n;
const MM3_TO_M3_POW_FACTOR = powRational(MM3_PER_M3, 63, 50);

export function buoyantDisplacement(h: HullSpec, b: HullBalance): Kg {
  const v =
    (BigInt(h.lengthWl) *
      BigInt(h.beam) *
      BigInt(h.draught) *
      BigInt(h.blockCoeffBp) *
      BigInt(b.seawaterKgPerM3)) /
    (MM3_PER_M3 * BP);
  return kg(toSafe("buoyantDisplacement", v));
}

export function hullStructureWeight(h: HullSpec, form: HullForm, b: HullBalance): Kg {
  const mat = b.materialBp[h.materialId];
  const scheme = b.schemeBp[h.structuralSchemeId];
  if (mat === undefined || scheme === undefined)
    throw designInvariant("unknown material or structural scheme");
  const sub = b.subdivisionBp[h.subdivisionGrade];
  const volume = BigInt(h.lengthWl) * BigInt(h.beam) * BigInt(h.depthToMainDeck);
  const p = powRational(volume, 63, 50);
  const num =
    BigInt(b.hullCoeffMilliKg) *
    BigInt(mat) *
    BigInt(scheme) *
    BigInt(sub) *
    BigInt(form.formBp) *
    p;
  const keepBp =
    h.freeboardProfile === "LOW" ? BP - BigInt(b.lowFreeboardHullWeightSavingBp ?? 0) : BP;
  const den = 1000n * BP ** 4n * MM3_TO_M3_POW_FACTOR * BP;
  return kg(toSafe("hullStructureWeight", (num * keepBp + den - 1n) / den));
}

export function reserveBuoyancyBp(h: HullSpec, form: HullForm, b?: HullBalance): number {
  const fb = BigInt(h.depthToMainDeck) - BigInt(h.draught);
  if (fb <= 0n) return 0;
  const v =
    (fb * BigInt(form.waterplaneCoeffBp) * BigInt(form.sheerBp)) /
    (BigInt(h.draught) * BigInt(h.blockCoeffBp));
  const keepBp = h.freeboardProfile === "LOW" ? BP - BigInt(b?.lowFreeboardReserveCutBp ?? 0) : BP;
  return toSafe("reserveBuoyancyBp", (v * keepBp) / BP);
}

const fmt = (n: number) => groupedInteger(n);

export function compileHull(
  hull: HullSpec,
  form: HullForm,
  balance: HullBalance,
  others: DisplacementLedger,
  hullWeightSavingBp = 0,
): HullResult {
  const findings: Finding[] = [];
  const dims = { L: hull.lengthWl, B: hull.beam, T: hull.draught, D: hull.depthToMainDeck };

  if (hull.lengthWl < form.lengthMinMm || hull.lengthWl > form.lengthMaxMm) {
    findings.push({
      id: "HULL_DIMENSION_RANGE",
      severity: "BLOCKING",
      what: `Waterline length ${fmt(hull.lengthWl)} mm is outside the ${form.id} hull form range.`,
      why: `Allowed ${fmt(form.lengthMinMm)}-${fmt(form.lengthMaxMm)} mm.`,
      consequence: "The yard has no proven scantlings for this hull; it cannot be laid down.",
      remedies: [
        {
          id: "set_length_min",
          description: `Set length to ${fmt(Math.max(form.lengthMinMm, Math.min(form.lengthMaxMm, hull.lengthWl)))} mm.`,
          edit: {
            hull: {
              lengthWl: Math.max(form.lengthMinMm, Math.min(form.lengthMaxMm, hull.lengthWl)),
            },
          },
        },
        {
          id: "change_form",
          description: "Choose a hull form whose length range covers this ship.",
        },
        {
          id: "change_category",
          description: "Re-scope the requirement to a smaller or larger ship category.",
        },
      ],
      evidence: {
        formulaId: "F-H2",
        inputs: dims,
        threshold: hull.lengthWl < form.lengthMinMm ? form.lengthMinMm : form.lengthMaxMm,
        value: hull.lengthWl,
      },
    });
  }
  if (
    hull.draught <= 0 ||
    hull.beam <= 0 ||
    hull.lengthWl <= 0 ||
    hull.draught >= hull.depthToMainDeck
  ) {
    findings.push({
      id: "HULL_GEOMETRY_INVALID",
      severity: "BLOCKING",
      what: "Hull dimensions are not physically consistent.",
      why: `Length ${hull.lengthWl}, beam ${hull.beam}, draught ${hull.draught}, depth ${hull.depthToMainDeck} (mm); draught must be positive and below depth to the main deck.`,
      consequence: "The hull has no freeboard or no volume; it would not float.",
      remedies: [
        { id: "raise_depth", description: "Increase depth to main deck above the draught." },
        { id: "reduce_draught", description: "Reduce the design draught." },
        { id: "check_dims", description: "Enter positive length and beam." },
      ],
      evidence: {
        formulaId: "F-H4",
        inputs: dims,
        threshold: 0,
        value: hull.depthToMainDeck - hull.draught,
      },
    });
    return {
      ledger: others,
      totalKg: ledgerTotal(others),
      buoyantKg: kg(0),
      freeboardMm: 0,
      reserveBuoyancyBp: 0,
      findings: sortFindings(findings),
    };
  }

  const lb = Math.floor((hull.lengthWl * 100) / hull.beam);
  if (lb < form.lbMinX100 || lb > form.lbMaxX100) {
    findings.push({
      id: "HULL_PROPORTIONS",
      severity: "WARNING",
      what: ["Length/beam ratio ", quantity(lb, 100, 2), ` is outside the ${form.id} range.`],
      why: [
        "Form range ",
        quantity(form.lbMinX100, 100, 2),
        "-",
        quantity(form.lbMaxX100, 100, 2),
        ".",
      ],
      consequence:
        lb < form.lbMinX100
          ? "Stubby hull: poor speed-power efficiency."
          : "Slender hull: weak transverse stability and structure.",
      remedies: [
        { id: "adjust_beam", description: "Change beam to bring L/B inside the form range." },
        { id: "adjust_length", description: "Change length to bring L/B inside the form range." },
        { id: "change_form", description: "Choose a hull form designed for this proportion." },
      ],
      evidence: {
        formulaId: "F-H2",
        inputs: { lbX100: lb },
        threshold: lb < form.lbMinX100 ? form.lbMinX100 : form.lbMaxX100,
        value: lb,
      },
    });
  }

  const buoyantKg = buoyantDisplacement(hull, balance);
  const structureKg = hullStructureWeight(hull, form, balance);
  const hullKg = kg(structureKg - Number((BigInt(structureKg) * BigInt(hullWeightSavingBp)) / BP));
  let ledger = withLine(others, "hull", hullKg);

  let sub = 0;
  for (const c of LEDGER_CATEGORIES) if (c !== "margin" && c !== "reserve") sub += ledger[c];
  const marginKg = Number((BigInt(sub) * BigInt(hull.designMarginBp) + BP - 1n) / BP);
  const reserveKg = Number(
    (BigInt(hull.targetDisplacementKg) * BigInt(hull.growthReserveBp) + BP - 1n) / BP,
  );
  ledger = withLine(withLine(ledger, "margin", kg(marginKg)), "reserve", kg(reserveKg));
  const totalKg = ledgerTotal(ledger);

  const excess = totalKg - buoyantKg;
  const tol = Number((BigInt(buoyantKg) * BigInt(balance.buoyancyTolBp)) / BP);
  const overTarget =
    totalKg -
    Math.floor(
      Number((BigInt(hull.targetDisplacementKg) * BigInt(10_000 + balance.overTargetTolBp)) / BP),
    );
  const limit = hull.limitDisplacementKg;

  if (excess > tol || overTarget > 0 || (limit !== null && totalKg > limit)) {
    const need = Math.max(excess - tol, overTarget, limit !== null ? totalKg - limit : 0, 1);
    const ranked = (Object.keys(ledger) as LedgerCategory[])
      .filter((c) => c !== "hull" && c !== "margin" && c !== "reserve" && ledger[c] > 0)
      .sort((a, b) => ledger[b] - ledger[a] || (a < b ? -1 : 1))
      .slice(0, 2);
    const perMmDraught = Math.max(
      1,
      Math.floor(
        Number(
          (BigInt(hull.lengthWl) *
            BigInt(hull.beam) *
            BigInt(hull.blockCoeffBp) *
            BigInt(balance.seawaterKgPerM3)) /
            (MM3_PER_M3 * BP),
        ),
      ),
    );
    const remedies: Remedy[] = [
      ...ranked.map((c) => ({
        id: `reduce_${c}`,
        description: `Reduce ${c} by about ${fmt(Math.min(need, ledger[c]))} kg (currently ${fmt(ledger[c])} kg).`,
        edit: { ledger: c, reduceKg: Math.min(need, ledger[c]) },
      })),
      {
        id: "reduce_margin_reserve",
        description: `Cut design margin and growth reserve (${fmt(marginKg + reserveKg)} kg combined); this lowers modernization potential and weight-growth protection.`,
      },
    ];
    if (limit === null || totalKg <= limit) {
      remedies.push({
        id: "increase_draught",
        description: `Raise design draught by about ${fmt(Math.ceil(excess / perMmDraught))} mm (+${fmt(perMmDraught)} kg buoyancy per mm); costs freeboard.`,
        edit: { hull: { draughtDeltaMm: Math.ceil(excess / perMmDraught) } },
      });
    }
    remedies.push({
      id: "lengthen_hull",
      description:
        "Lengthen the hull: more buoyancy, but more structure weight, cost and construction time.",
    });
    findings.push({
      id: limit !== null && totalKg > limit ? "OVERWEIGHT_LIMIT" : "OVERWEIGHT_UNRECOVERABLE",
      severity: "BLOCKING",
      what: `Calculated displacement ${fmt(totalKg)} kg exceeds what this hull may carry.`,
      why: `Ledger ${fmt(totalKg)} kg vs buoyancy at design draught ${fmt(buoyantKg)} kg (tolerance ${fmt(tol)} kg), target ${fmt(hull.targetDisplacementKg)} kg${limit !== null ? `, limit ${fmt(limit)} kg` : ""}. Short by ${fmt(need)} kg.`,
      consequence:
        "The ship would float below its design waterline, losing freeboard and reserve buoyancy; it cannot be built.",
      remedies,
      evidence: {
        formulaId: "F-H5",
        inputs: { totalKg, buoyantKg, targetKg: hull.targetDisplacementKg },
        threshold: buoyantKg + tol,
        value: totalKg,
      },
    });
  } else if (-excess > tol) {
    findings.push({
      id: "HULL_BUOYANCY_MISMATCH",
      severity: "WARNING",
      what: "The hull is larger than its load requires.",
      why: `Ledger ${fmt(totalKg)} kg is ${fmt(-excess)} kg below buoyancy at design draught ${fmt(buoyantKg)} kg.`,
      consequence:
        "The ship floats high: wasted hull cost and weight, and higher wind heel; speed-power numbers assume the design draught.",
      remedies: [
        { id: "reduce_draught", description: "Reduce the design draught to match the load." },
        { id: "add_payload", description: "Add armament, fuel or armour with the spare capacity." },
        { id: "shorten_hull", description: "Shorten or narrow the hull to save cost." },
      ],
      evidence: {
        formulaId: "F-H1",
        inputs: { totalKg, buoyantKg },
        threshold: buoyantKg - tol,
        value: totalKg,
      },
    });
  }

  const freeboardMm = hull.depthToMainDeck - hull.draught;
  const reserve = reserveBuoyancyBp(hull, form, balance);
  if (hull.freeboardProfile === "LOW") {
    findings.push({
      id: "LOW_FREEBOARD_PRESET",
      severity: "ADVISORY",
      what: "The low-freeboard construction preset is selected.",
      why: `Reserve buoyancy is reduced to ${reserve} bp (freeboard ${fmt(freeboardMm)} mm) in exchange for a lighter hull.`,
      consequence:
        "Less reserve buoyancy: the ship is wetter in a seaway and tolerates less flooding than the normal preset.",
      remedies: [
        { id: "normal_freeboard", description: "Return to the normal freeboard preset." },
        { id: "raise_depth", description: "Increase depth to the main deck instead." },
      ],
      evidence: {
        formulaId: "F-H4",
        inputs: { freeboardMm, draught: hull.draught },
        threshold: balance.reserveBuoyancyWarnBp,
        value: reserve,
      },
    });
  }
  if (reserve < balance.reserveBuoyancyWarnBp) {
    const critical = reserve < balance.reserveBuoyancyCriticalBp;
    findings.push({
      id: "LOW_RESERVE_BUOYANCY",
      severity: critical ? "CRITICAL" : "WARNING",
      what: "Reserve buoyancy is low.",
      why: `Freeboard ${fmt(freeboardMm)} mm gives ${reserve} bp reserve buoyancy; threshold ${critical ? balance.reserveBuoyancyCriticalBp : balance.reserveBuoyancyWarnBp} bp.`,
      consequence: "The ship ships green water in a seaway and survives flooding poorly.",
      remedies: [
        { id: "raise_depth", description: "Increase depth to the main deck (raises hull weight)." },
        { id: "reduce_draught", description: "Reduce draught by lightening the ship." },
        { id: "increase_beam", description: "Increase beam to raise waterplane area." },
      ],
      evidence: {
        formulaId: "F-H4",
        inputs: { freeboardMm, draught: hull.draught },
        threshold: critical ? balance.reserveBuoyancyCriticalBp : balance.reserveBuoyancyWarnBp,
        value: reserve,
      },
    });
  }

  return {
    ledger,
    totalKg,
    buoyantKg,
    freeboardMm,
    reserveBuoyancyBp: reserve,
    findings: sortFindings(findings),
  };
}
