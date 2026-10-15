import type { Finding } from "./findings.js";
import { sortFindings } from "./findings.js";
import { evaluate, type LookupTable } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import { ZONE_IDS, type ZoneDef, type ZoneId } from "./arrangement.js";
import { toSafe } from "./units.js";

/** One lump of the displacement for centre-of-gravity and trim work. */
export interface WeightItem {
  readonly label: string;
  readonly kg: number;
  readonly zMm: number;
  readonly stationPermille: number;
  readonly zoneId: ZoneId;
}

export interface StabilityWindow {
  /** Below this GM (mm) the ship is judged unsafe in service. */
  readonly gmMinMm: number;
  /** Below this GM (mm) the ship will capsize; BLOCKING. */
  readonly gmCapsizeMm: number;
  /** Above this GM (mm) the ship is stiff and rolls violently. */
  readonly gmMaxMm: number;
}

export interface StabilityBalance {
  /** KB as bp of draught. */
  readonly kbBp: number;
  /** Waterplane inertia coefficient, bp: I = cI * L * B^3. */
  readonly inertiaBp: number;
  readonly trimToleranceBp: number;
  /** Fraction of the hull-weight-based allowable bending moment, bp. */
  readonly sectionModulusBp: number;
  readonly stressCriticalBp: number;
  readonly stressBlockingBp: number;
  /** Freeboard/length permille -> seakeeping bp. */
  readonly seakeepingFreeboard: LookupTable;
  /** GM mm -> seakeeping multiplier bp. */
  readonly seakeepingGm: LookupTable;
  readonly thinMarginBp: number;
}

export interface StabilityInput {
  readonly items: readonly WeightItem[];
  readonly lengthMm: number;
  readonly beamMm: number;
  readonly draughtMm: number;
  readonly depthMm: number;
  readonly blockCoeffBp: number;
  /** Longitudinal centre of buoyancy, permille from bow. */
  readonly lcbPermille: number;
  /** Share of buoyancy carried by each zone, bp, in canonical zone order (sums to 10_000). */
  readonly buoyancyByZoneBp: readonly number[];
  readonly hullWeightKg: number;
  readonly window: StabilityWindow;
}

export interface StabilityResult {
  readonly displacementKg: number;
  readonly kgMm: number;
  readonly kbMm: number;
  readonly bmMm: number;
  readonly gmMm: number;
  readonly lcgPermille: number;
  readonly trimBp: number;
  /** Positive = hogging (ends heavy), negative = sagging. */
  readonly peakBendingMomentKgMm: number;
  readonly stressBp: number;
  readonly seakeepingBp: number;
  readonly findings: readonly Finding[];
}

const BP = 10_000n;
const fmt = (n: number) => n.toLocaleString("en-US");

export function compileStability(
  i: StabilityInput,
  zones: readonly ZoneDef[],
  b: StabilityBalance,
): StabilityResult {
  if (
    i.buoyancyByZoneBp.length !== ZONE_IDS.length ||
    i.buoyancyByZoneBp.reduce((a, v) => a + v, 0) !== 10_000
  ) {
    throw new Error("buoyancyByZoneBp must have nine entries summing to 10000");
  }
  const total = i.items.reduce((a, it) => a + it.kg, 0);
  if (total <= 0) throw new Error("stability needs a positive displacement");
  const findings: Finding[] = [];
  const W = BigInt(total);

  const kg = toSafe("kg", i.items.reduce((a, it) => a + BigInt(it.kg) * BigInt(it.zMm), 0n) / W);
  const kb = toSafe("kb", (BigInt(i.draughtMm) * BigInt(b.kbBp)) / BP);
  const bm = toSafe(
    "bm",
    (BigInt(i.beamMm) ** 2n * BigInt(b.inertiaBp)) / (BigInt(i.draughtMm) * BigInt(i.blockCoeffBp)),
  );
  const gm = kb + bm - kg;
  const w = i.window;

  const base = { formulaId: "F-S2", inputs: { kgMm: kg, kbMm: kb, bmMm: bm } };
  if (gm < w.gmCapsizeMm) {
    findings.push({
      id: "STABILITY_CAPSIZE",
      severity: "BLOCKING",
      what: "The ship is unstable and will capsize.",
      why: `GM ${gm} mm (KB ${kb} + BM ${bm} - KG ${kg}) is below the capsize threshold ${w.gmCapsizeMm} mm.`,
      consequence: "The ship cannot be built: it would roll over at the quayside.",
      remedies: [
        {
          id: "lower_weights",
          description:
            "Move heavy items lower or remove topweight (directors, upper armour, guns).",
        },
        { id: "widen_beam", description: "Increase beam: BM grows with the square of beam." },
        { id: "ballast", description: "Add low ballast or deeper fuel bunkers." },
        { id: "reduce_draught_ratio", description: "Reduce displacement so draught falls." },
      ],
      evidence: { ...base, threshold: w.gmCapsizeMm, value: gm },
    });
  } else if (gm < w.gmMinMm) {
    findings.push({
      id: "STABILITY_LOW",
      severity: "CRITICAL",
      what: "Initial stability is dangerously low.",
      why: `GM ${gm} mm is below the safe minimum ${w.gmMinMm} mm.`,
      consequence: "Heavy-weather losses are likely and the ship capsizes easily when damaged.",
      remedies: [
        { id: "lower_weights", description: "Lower heavy items or remove topweight." },
        { id: "widen_beam", description: "Increase beam." },
        {
          id: "lighter_armour_high",
          description: "Remove or thin armour placed high on the ship.",
        },
      ],
      evidence: { ...base, threshold: w.gmMinMm, value: gm },
    });
  } else if (gm > w.gmMaxMm) {
    findings.push({
      id: "STABILITY_STIFF",
      severity: "WARNING",
      what: "The ship is too stiff.",
      why: `GM ${gm} mm exceeds the comfortable maximum ${w.gmMaxMm} mm.`,
      consequence: "Violent, short-period rolling degrades gunnery and crew effectiveness.",
      remedies: [
        { id: "raise_weights", description: "Carry weight higher (superstructure, directors)." },
        { id: "narrower_beam", description: "Reduce beam." },
        { id: "accept", description: "Accept the rolling for a safer damaged-stability margin." },
      ],
      evidence: { ...base, threshold: w.gmMaxMm, value: gm },
    });
  } else if (BigInt(gm - w.gmMinMm) * BP < BigInt(w.gmMinMm) * BigInt(b.thinMarginBp)) {
    findings.push({
      id: "STABILITY_MARGIN_THIN",
      severity: "ADVISORY",
      what: "Stability is close to the safe minimum.",
      why: `GM ${gm} mm is within ${b.thinMarginBp / 100}% of the minimum ${w.gmMinMm} mm.`,
      consequence: "Any later refit that adds topweight will push the ship below safe limits.",
      remedies: [],
      evidence: { ...base, threshold: w.gmMinMm, value: gm },
    });
  }

  // Trim (F-S5)
  const lcg = toSafe(
    "lcg",
    i.items.reduce((a, it) => a + BigInt(it.kg) * BigInt(it.stationPermille), 0n) / W,
  );
  const trimBp = (lcg - i.lcbPermille) * 10;
  if (Math.abs(trimBp) > b.trimToleranceBp) {
    const critical = Math.abs(trimBp) > 2 * b.trimToleranceBp;
    const bow = trimBp < 0;
    findings.push({
      id: bow ? "TRIM_BOW_HEAVY" : "TRIM_STERN_HEAVY",
      severity: critical ? "CRITICAL" : "WARNING",
      what: `The ship is ${bow ? "bow" : "stern"}-heavy.`,
      why: `LCG ${lcg}‰ vs LCB ${i.lcbPermille}‰ gives ${trimBp} bp of trim (tolerance ${b.trimToleranceBp} bp).`,
      consequence: bow
        ? "Buries the bow in a seaway and slows the ship."
        : "Squats aft: more power for the same speed and a wet quarterdeck.",
      remedies: [
        {
          id: "move_weights",
          description: `Shift heavy items toward the ${bow ? "stern" : "bow"}.`,
        },
        { id: "move_machinery", description: "Reposition machinery or magazines." },
        {
          id: "change_hull_form",
          description: "Choose a hull form with the centre of buoyancy where the weight is.",
        },
      ],
      evidence: {
        formulaId: "F-S5",
        inputs: { lcg, lcb: i.lcbPermille },
        threshold: b.trimToleranceBp,
        value: Math.abs(trimBp),
      },
    });
  }

  // Structural stress (F-S6): discretise into the nine zones, rectangle-rule integration of shear.
  const zoneWeight = new Map<ZoneId, bigint>();
  for (const it of i.items)
    zoneWeight.set(it.zoneId, (zoneWeight.get(it.zoneId) ?? 0n) + BigInt(it.kg));
  // MISSION overlays other zones; fold its weight and buoyancy out of the line-of-hull integration.
  const line = zones.filter((z) => z.id !== "MISSION");
  const missionW = zoneWeight.get("MISSION") ?? 0n;
  // Trapezoid integration of shear to bending moment at each zone boundary, then remove the closing error
  // linearly (the free ship trims until moments balance). Gameplay approximation, see spec F-S6.
  let shear = 0n;
  const moments: bigint[] = [];
  const cum: bigint[] = [];
  let moment = 0n;
  let run = 0n;
  for (const z of line) {
    const idx = ZONE_IDS.indexOf(z.id);
    const buoy = (W * BigInt(i.buoyancyByZoneBp[idx]!)) / BP;
    let wz = zoneWeight.get(z.id) ?? 0n;
    if (z.id === "SUPERSTRUCTURE") wz += missionW; // keep the load on the line of the hull
    const prev = shear;
    shear += wz - buoy;
    const segMm = (BigInt(i.lengthMm) * BigInt(z.endPermille - z.startPermille)) / 1000n;
    moment += ((prev + shear) * segMm) / 2n;
    run += segMm;
    moments.push(moment);
    cum.push(run);
  }
  const closing = moments[moments.length - 1] ?? 0n;
  const totalLen = cum[cum.length - 1] ?? 1n;
  let peak = 0n;
  for (let k = 0; k < moments.length; k++) {
    const corrected = moments[k]! - (closing * cum[k]!) / totalLen;
    if ((corrected < 0n ? -corrected : corrected) > (peak < 0n ? -peak : peak)) peak = corrected;
  }
  // Mission zone buoyancy share is carried by the neighbouring zones; fold it so equilibrium holds.
  const allowed = (BigInt(i.hullWeightKg) * BigInt(i.depthMm) * BigInt(b.sectionModulusBp)) / BP;
  const stressBp =
    allowed <= 0n ? 1_000_000 : toSafe("stress", ((peak < 0n ? -peak : peak) * BP) / allowed);
  if (stressBp > b.stressCriticalBp) {
    const blocking = stressBp > b.stressBlockingBp;
    findings.push({
      id: blocking ? "STRUCTURAL_OVERSTRESS" : "STRUCTURAL_FAILURE_RISK",
      severity: blocking ? "BLOCKING" : "CRITICAL",
      what: `The hull girder is overstressed (${peak > 0n ? "hogging" : "sagging"}).`,
      why: `Bending index ${stressBp} bp of allowable (critical ${b.stressCriticalBp}, blocking ${b.stressBlockingBp}).`,
      consequence: blocking
        ? "The hull would break its back; it cannot be built."
        : "The hull works in a seaway: leaks, reduced speed limits and short service life.",
      remedies: [
        {
          id: "stronger_scheme",
          description: "Choose a longitudinal framing scheme (heavier but stronger).",
        },
        {
          id: "spread_weights",
          description:
            peak > 0n
              ? "Move heavy weights toward amidships."
              : "Move heavy weights toward the ends.",
        },
        {
          id: "shorter_hull",
          description: "Shorten the hull or deepen it (depth raises section strength).",
        },
      ],
      evidence: {
        formulaId: "F-S6",
        inputs: { hullWeightKg: i.hullWeightKg, depthMm: i.depthMm },
        threshold: blocking ? b.stressBlockingBp : b.stressCriticalBp,
        value: stressBp,
      },
    });
  }

  // Seakeeping (F-S7)
  const fbPermille = Math.floor(((i.depthMm - i.draughtMm) * 1000) / i.lengthMm);
  const sFb = evaluate(parseFormula("lookup(t, x)"), {
    vars: { x: fbPermille },
    tables: { t: b.seakeepingFreeboard },
  });
  const sGm = evaluate(parseFormula("lookup(t, x)"), {
    vars: { x: gm },
    tables: { t: b.seakeepingGm },
  });
  const seakeepingBp = Math.max(
    0,
    Math.min(10_000, toSafe("sea", (BigInt(sFb) * BigInt(sGm)) / BP)),
  );

  void fmt;
  return {
    displacementKg: total,
    kgMm: kg,
    kbMm: kb,
    bmMm: bm,
    gmMm: gm,
    lcgPermille: lcg,
    trimBp,
    peakBendingMomentKgMm: toSafe("peak", peak),
    stressBp,
    seakeepingBp,
    findings: sortFindings(findings),
  };
}
