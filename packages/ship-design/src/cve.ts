import type { CompiledDesign, DesignDraft } from "./compile.js";
import { evaluate, type LookupTable } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import { designInvariant } from "./errors.js";

export const CVE_LABEL = "DEV METRIC: not a combat result";

export interface CveWeights {
  readonly offence: number;
  readonly protection: number;
  readonly mobility: number;
  readonly reliability: number;
  readonly suitability: number;
}

export interface CveBalance {
  readonly weightsByCategory: Readonly<Record<string, CveWeights>>;
  readonly offence: LookupTable;
  readonly torpedoOffence: LookupTable;
  readonly speed: LookupTable;
  readonly range: LookupTable;
  readonly warningPenaltyBp: number;
  readonly criticalPenaltyBp: number;
}

export interface CveScores {
  readonly label: typeof CVE_LABEL;
  readonly offenceBp: number;
  readonly protectionBp: number;
  readonly mobilityBp: number;
  readonly reliabilityBp: number;
  readonly suitabilityBp: number;
  readonly cveBp: number;
}

const look = (t: LookupTable, x: number) =>
  evaluate(parseFormula("lookup(t, x)"), { vars: { x }, tables: { t } });
const clamp = (v: number) => Math.max(0, Math.min(10_000, v));

export function computeCve(
  c: CompiledDesign,
  d: DesignDraft,
  plantReliabilityBp: number,
  b: CveBalance,
): CveScores {
  const w = b.weightsByCategory[d.requirement.category];
  if (!w) throw designInvariant(`no CVE weights for category '${d.requirement.category}'`);
  const sum = w.offence + w.protection + w.mobility + w.reliability + w.suitability;
  if (sum !== 10_000)
    throw designInvariant(`CVE weights for '${d.requirement.category}' sum to ${sum}, not 10000`);

  const acc =
    c.systems && c.systems.gunControl.length > 0
      ? Math.floor(
          c.systems.gunControl.reduce((a, g) => a + g.accuracyBp, 0) / c.systems.gunControl.length,
        )
      : 0;
  const gunScore = look(
    b.offence,
    Math.floor(((c.weapons?.sustainedPerMinX100 ?? 0) * acc) / 10_000),
  );
  const tubes =
    d.placements.length === 0
      ? 0
      : c.components.filter((k) => k.category === "TORPEDO_TUBE").length;
  const offenceBp = clamp(gunScore + look(b.torpedoOffence, tubes));

  const a = c.armour;
  const protectionBp = a
    ? clamp(
        Math.floor(
          (a.coverageBp +
            a.underwaterResistanceBp +
            a.floodingResistanceBp +
            clamp(
              5_000 +
                Object.values(a.marginBp)
                  .flatMap((m) => Object.values(m))
                  .reduce((x, y) => Math.max(x, y), -10_000) /
                  2,
            )) /
            4,
        ),
      )
    : 0;

  const vmax = c.machinery?.maxSpeedMilliKnots ?? 0;
  const range = c.machinery?.rangeNmAtCruise ?? 0;
  const sea = c.stability?.seakeepingBp ?? 0;
  const mobilityBp = clamp(Math.floor((look(b.speed, vmax) + look(b.range, range) + sea) / 3));

  const reliabilityBp = clamp(plantReliabilityBp - (c.systems?.reliabilityPenaltyBp ?? 0));

  const req = d.requirement;
  const speedFit =
    req.requiredSpeedMilliKnots <= 0
      ? 10_000
      : Math.min(10_000, Math.floor((vmax * 10_000) / req.requiredSpeedMilliKnots));
  const rangeFit =
    req.requiredRangeNm <= 0
      ? 10_000
      : Math.min(10_000, Math.floor((range * 10_000) / req.requiredRangeNm));
  let suit = Math.floor((speedFit + rangeFit) / 2);
  for (const f of c.findings)
    suit -=
      f.severity === "WARNING"
        ? b.warningPenaltyBp
        : f.severity === "CRITICAL"
          ? b.criticalPenaltyBp
          : 0;
  const suitabilityBp = c.valid ? clamp(suit) : 0;

  const cveBp = clamp(
    Math.floor(
      (offenceBp * w.offence +
        protectionBp * w.protection +
        mobilityBp * w.mobility +
        reliabilityBp * w.reliability +
        suitabilityBp * w.suitability) /
        10_000,
    ),
  );
  return {
    label: CVE_LABEL,
    offenceBp,
    protectionBp,
    mobilityBp,
    reliabilityBp,
    suitabilityBp,
    cveBp,
  };
}
