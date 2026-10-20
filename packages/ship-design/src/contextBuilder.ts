import type { HullFormData, ShipBalance } from "./compile.js";
import { aluminiumBalanceProblem } from "./aluminium.js";
import { antiAircraftBalanceProblem } from "./antiAircraft.js";
import { classificationRulesFromRecord } from "./classificationRules.js";
import type { PropulsionPlant } from "./machinery.js";
import { bp } from "./units.js";
import type { ZoneDef, ZoneId } from "./arrangement.js";

/** Parsed hull-form record as authored in hull-forms.yaml (validated upstream by content-schema). */
export interface HullFormRecord {
  readonly id: string;
  readonly lengthMinMm: number;
  readonly lengthMaxMm: number;
  readonly lbMinX100: number;
  readonly lbMaxX100: number;
  readonly formBp: number;
  readonly waterplaneCoeffBp: number;
  readonly sheerBp: number;
  readonly volumeFullnessBp: number;
  readonly deckFullnessBp: number;
  readonly lcbPermille: number;
  /** Optional traits such as `merchant_derived` (validated by content-schema). */
  readonly traits?: readonly string[];
  readonly zones: readonly {
    readonly id: string;
    readonly startPermille: number;
    readonly endPermille: number;
    readonly volumeBp: number;
    readonly deckAreaBp: number;
    readonly buoyancyBp: number;
  }[];
}

export class ContentError extends Error {
  /** Stable discriminator (RULES.md "Errors"): recover by `_tag`, not `instanceof`. */
  readonly _tag = "ContentError";
  constructor(message: string) {
    super(message);
    this.name = "ContentError";
  }
}

/** Converts authored hull-form records into the runtime map `ShipContext.hullForms`. Duplicate ids are an error. */
export function hullFormsFromRecords(
  records: readonly HullFormRecord[],
): Record<string, HullFormData> {
  const out: Record<string, HullFormData> = {};
  for (const r of records) {
    if (out[r.id]) throw new ContentError(`duplicate hull form '${r.id}'`);
    const zones: ZoneDef[] = r.zones.map((z) => ({
      id: z.id as ZoneId,
      startPermille: z.startPermille,
      endPermille: z.endPermille,
      volumeBp: z.volumeBp,
      deckAreaBp: z.deckAreaBp,
    }));
    out[r.id] = {
      form: {
        id: r.id,
        lengthMinMm: r.lengthMinMm,
        lengthMaxMm: r.lengthMaxMm,
        lbMinX100: r.lbMinX100,
        lbMaxX100: r.lbMaxX100,
        formBp: bp(r.formBp),
        waterplaneCoeffBp: bp(r.waterplaneCoeffBp),
        sheerBp: bp(r.sheerBp),
      },
      zones,
      volumeFullnessBp: r.volumeFullnessBp,
      deckFullnessBp: r.deckFullnessBp,
      lcbPermille: r.lcbPermille,
      buoyancyByZoneBp: r.zones.map((z) => z.buoyancyBp),
      traits: r.traits ?? [],
    };
  }
  return out;
}

export function plantsFromRecords(records: readonly PropulsionPlant[]): PropulsionPlant[] {
  const ids = new Set<string>();
  for (const p of records) {
    if (ids.has(p.id)) throw new ContentError(`duplicate plant '${p.id}'`);
    ids.add(p.id);
  }
  return [...records];
}

const REQUIRED_BALANCE_KEYS = [
  "hull",
  "machinery",
  "arrangement",
  "weapons",
  "armour",
  "stability",
  "systems",
  "ledgerCategoryOf",
  "lumpZFractionBp",
  "armourZFractionBp",
  "crewKgPerHead",
  "stabilityWindowByCategory",
  "minReserveBpByExpectation",
] as const;

/** Light shape check of balance.yaml's `ship` section; throws a ContentError naming the missing key. */
export function shipBalanceFromRecord(raw: unknown): ShipBalance {
  if (raw === null || typeof raw !== "object")
    throw new ContentError("ship balance must be an object");
  const rec = raw as Record<string, unknown>;
  for (const k of REQUIRED_BALANCE_KEYS)
    if (rec[k] === undefined) throw new ContentError(`ship balance is missing '${k}'`);
  if (rec.antiAircraft !== undefined) {
    const problem = antiAircraftBalanceProblem(rec.antiAircraft);
    if (problem !== null) throw new ContentError(problem);
  }
  if (rec.aluminiumSuperstructure !== undefined) {
    const problem = aluminiumBalanceProblem(rec.aluminiumSuperstructure);
    if (problem !== null) throw new ContentError(problem);
  }
  if (rec.classification !== undefined) {
    try {
      classificationRulesFromRecord(rec.classification);
    } catch (e) {
      throw new ContentError(e instanceof Error ? e.message : String(e));
    }
  }
  return raw as ShipBalance;
}
