import { groupedInteger } from "./numberText.js";
import type { ZoneId } from "./arrangement.js";
import type { ComponentCategory } from "./component.js";
import type { Finding } from "./findings.js";
import { placementTarget, sortFindings } from "./findings.js";
import { toSafe } from "./units.js";

export type LoadCase = "HARBOUR" | "CRUISING" | "ACTION";
export const LOAD_CASES: readonly LoadCase[] = ["HARBOUR", "CRUISING", "ACTION"];
export type AccommodationStandard = "SPARTAN" | "STANDARD" | "GENEROUS";

export interface SystemItem {
  readonly instanceId: string;
  readonly category: ComponentCategory;
  readonly powerKw: number;
  readonly coolingKw: number;
  readonly crew: number;
}

export interface Generator {
  readonly instanceId: string;
  readonly kw: number;
  readonly zoneId: ZoneId;
}

export interface DirectorUnit {
  readonly instanceId: string;
  readonly supportedClasses: readonly string[];
  readonly accuracyBonusBp: number;
  /** Maximum number of guns this director can control at once. */
  readonly capacity: number;
  readonly stationPermille: number;
}

export interface FcGun {
  readonly instanceId: string;
  readonly fcClass: string;
}

export interface SystemsBalance {
  /** Share of nominal demand drawn in each case, per category (bp); `DEFAULT` is the fallback. */
  readonly caseProfileBp: Readonly<Record<string, Readonly<Record<LoadCase, number>>>>;
  /** Derate on generator output when every generator sits in one zone, bp. */
  readonly generatorConcentrationDerateBp: number;
  /** Reliability lost per 100 bp of cooling shortfall, bp. */
  readonly coolingReliabilityPerPercentBp: number;
  /** Crew needed to run the hull itself, per tonne of displacement x1000. */
  readonly hullCrewPerTonneX1000: number;
  /** Volume per head in litres by accommodation standard. */
  readonly litrePerHead: Readonly<Record<AccommodationStandard, number>>;
  readonly baseAccuracyBp: number;
  readonly localControlPenaltyBp: number;
  readonly smokeInterferencePermille: number;
  readonly smokeInterferencePenaltyBp: number;
  /** Redundancy each fire-control position adds, bp (capped at 10_000 in total). BALANCE TARGET; absent = 0. */
  readonly fireControlPositionRedundancyBp?: number;
}

export interface SystemsInput {
  readonly items: readonly SystemItem[];
  readonly generators: readonly Generator[];
  readonly coolingSupplyKw: number;
  readonly displacementKg: number;
  readonly accommodationStandard: AccommodationStandard;
  readonly accommodationVolumeLitre: number;
  readonly guns: readonly FcGun[];
  readonly directors: readonly DirectorUnit[];
  readonly funnelStationsPermille: readonly number[];
  /** Fire-control positions (spotting tops, conning towers, plotting rooms): redundancy against loss. Absent = 0. */
  readonly fireControlPositions?: number;
}

export interface GunControl {
  readonly gunId: string;
  readonly directorId: string | null;
  readonly accuracyBp: number;
}

export interface SystemsResult {
  readonly demandKw: Readonly<Record<LoadCase, number>>;
  readonly supplyKw: number;
  readonly coolingDemandKw: number;
  readonly coolingShortfallBp: number;
  readonly reliabilityPenaltyBp: number;
  readonly crewRequired: number;
  readonly crewCapacity: number;
  /** >10_000 means overcrowded. */
  readonly crowdingBp: number;
  readonly gunControl: readonly GunControl[];
  /** Share of the fire-control bonus that survives losing positions, bp. Redundancy, not accuracy. */
  readonly fireControlRedundancyBp: number;
  readonly findings: readonly Finding[];
}

const BP = 10_000n;
const fmt = (n: number) => groupedInteger(n);
const byId = <T extends { instanceId: string }>(a: T, b: T) =>
  a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0;

export function compileSystems(i: SystemsInput, b: SystemsBalance): SystemsResult {
  const findings: Finding[] = [];
  const profileFor = (c: ComponentCategory) => b.caseProfileBp[c] ?? b.caseProfileBp.DEFAULT;
  if (!b.caseProfileBp.DEFAULT) throw new Error("caseProfileBp.DEFAULT is required");

  // F-M4 electrical
  const demand: Record<LoadCase, number> = { HARBOUR: 0, CRUISING: 0, ACTION: 0 };
  for (const it of [...i.items].sort(byId)) {
    const prof = profileFor(it.category)!;
    for (const c of LOAD_CASES)
      demand[c] += toSafe("demand", (BigInt(it.powerKw) * BigInt(prof[c]) + BP - 1n) / BP);
  }
  const nominal = i.generators.reduce((a, g) => a + g.kw, 0);
  const zonesUsed = new Set(i.generators.map((g) => g.zoneId));
  const concentrated = i.generators.length > 1 && zonesUsed.size === 1;
  const supply = concentrated
    ? toSafe("supply", (BigInt(nominal) * (BP - BigInt(b.generatorConcentrationDerateBp))) / BP)
    : nominal;
  for (const c of ["ACTION", "CRUISING"] as const) {
    if (demand[c] > supply) {
      findings.push({
        id: "POWER_SHORTFALL",
        severity: "CRITICAL",
        what: `Electrical generation cannot meet ${c.toLowerCase()} demand.`,
        why: `${fmt(demand[c])} kW demanded vs ${fmt(supply)} kW available${concentrated ? ` (generators concentrated in ${[...zonesUsed][0]}, derated ${b.generatorConcentrationDerateBp} bp)` : ""}.`,
        consequence: "Turrets, fire control and pumps shut down or run degraded when it matters.",
        remedies: [
          {
            id: "add_generator",
            description: `Add about ${fmt(demand[c] - supply)} kW of generation.`,
          },
          { id: "drop_consumers", description: "Remove or downgrade power-hungry systems." },
          {
            id: "spread_generators",
            description: "Place generators in separate zones to avoid the concentration derate.",
          },
        ],
        evidence: { formulaId: "F-M4", inputs: { nominal }, threshold: supply, value: demand[c] },
      });
      break;
    }
  }
  if (demand.HARBOUR > supply && !findings.some((f) => f.id === "POWER_SHORTFALL")) {
    findings.push({
      id: "POWER_SHORTFALL",
      severity: "WARNING",
      what: "Harbour electrical demand exceeds generation.",
      why: `${fmt(demand.HARBOUR)} kW vs ${fmt(supply)} kW.`,
      consequence: "The ship cannot hotel itself without shore power.",
      remedies: [
        { id: "add_generator", description: "Add a small harbour generator." },
        { id: "drop_consumers", description: "Reduce standing loads." },
      ],
      evidence: { formulaId: "F-M4", inputs: {}, threshold: supply, value: demand.HARBOUR },
    });
  }

  const coolingDemand = i.items.reduce((a, it) => a + it.coolingKw, 0);
  const coolingShortfallBp =
    coolingDemand <= i.coolingSupplyKw || coolingDemand === 0
      ? 0
      : toSafe("cool", (BigInt(coolingDemand - i.coolingSupplyKw) * BP) / BigInt(coolingDemand));
  const reliabilityPenaltyBp = toSafe(
    "relpen",
    (BigInt(coolingShortfallBp) * BigInt(b.coolingReliabilityPerPercentBp)) / 100n,
  );
  if (coolingShortfallBp > 0) {
    findings.push({
      id: "COOLING_SHORTFALL",
      severity: "WARNING",
      what: "Cooling capacity is below demand.",
      why: `${fmt(coolingDemand)} kW of heat vs ${fmt(i.coolingSupplyKw)} kW of cooling (${coolingShortfallBp} bp short).`,
      consequence: `Machinery and electronics overheat; reliability falls by ${reliabilityPenaltyBp} bp.`,
      remedies: [
        { id: "add_cooling", description: "Add ventilation or cooling plant." },
        { id: "fewer_consumers", description: "Remove heat-producing equipment." },
        { id: "accept", description: "Accept the reliability loss." },
      ],
      evidence: {
        formulaId: "F-M5",
        inputs: { coolingDemand },
        threshold: i.coolingSupplyKw,
        value: coolingDemand,
      },
    });
  }

  // Crew and accommodation
  const hullCrew = toSafe(
    "hullCrew",
    (BigInt(i.displacementKg) * BigInt(b.hullCrewPerTonneX1000) + 999_999n) / 1_000_000n,
  );
  const crewRequired = hullCrew + i.items.reduce((a, it) => a + it.crew, 0);
  const perHead = b.litrePerHead[i.accommodationStandard];
  const crewCapacity = Math.floor(i.accommodationVolumeLitre / perHead);
  const crowdingBp =
    crewCapacity <= 0
      ? crewRequired > 0
        ? 100_000
        : 0
      : toSafe("crowd", (BigInt(crewRequired) * BP) / BigInt(crewCapacity));
  if (crewRequired > crewCapacity) {
    findings.push({
      id: "ACCOMMODATION_SHORT",
      severity: "CRITICAL",
      what: "The crew cannot be accommodated.",
      why: `${fmt(crewRequired)} crew required vs space for ${fmt(crewCapacity)} at ${i.accommodationStandard} standard (${perHead} L each).`,
      consequence: "Overcrowding wrecks health, morale and endurance on long cruises.",
      remedies: [
        {
          id: "more_space",
          description: `Add about ${fmt((crewRequired - crewCapacity) * perHead)} L of accommodation.`,
        },
        {
          id: "spartan",
          description: "Lower the accommodation standard (costs morale and endurance).",
        },
        {
          id: "fewer_crew",
          description: "Cut crew-intensive systems or choose automated equipment.",
        },
      ],
      evidence: {
        formulaId: "F-CREW",
        inputs: { crewRequired },
        threshold: crewCapacity,
        value: crewRequired,
      },
    });
  }

  // Fire control
  const directors = [...i.directors].sort(byId);
  const remaining = new Map(directors.map((d) => [d.instanceId, d.capacity]));
  const control: GunControl[] = [];
  const smokedDirectors = new Set<string>();
  for (const g of [...i.guns].sort((x, y) =>
    x.instanceId < y.instanceId ? -1 : x.instanceId > y.instanceId ? 1 : 0,
  )) {
    const candidates = directors
      .filter(
        (d) => d.supportedClasses.includes(g.fcClass) && (remaining.get(d.instanceId) ?? 0) > 0,
      )
      .sort(
        (x, y) => y.accuracyBonusBp - x.accuracyBonusBp || (x.instanceId < y.instanceId ? -1 : 1),
      );
    const d = candidates[0];
    let acc = b.baseAccuracyBp;
    if (d) {
      remaining.set(d.instanceId, remaining.get(d.instanceId)! - 1);
      acc += d.accuracyBonusBp;
      const smoked = i.funnelStationsPermille.some(
        (f) => Math.abs(f - d.stationPermille) <= b.smokeInterferencePermille,
      );
      if (smoked) acc -= b.smokeInterferencePenaltyBp;
      if (smoked && !smokedDirectors.has(d.instanceId)) {
        smokedDirectors.add(d.instanceId);
        findings.push({
          id: "DIRECTOR_INTERFERENCE",
          severity: "WARNING",
          what: `Director ${d.instanceId} is engulfed in funnel smoke.`,
          why: `It is within ${b.smokeInterferencePermille}‰ of a funnel; accuracy -${b.smokeInterferencePenaltyBp} bp.`,
          consequence: "Ranging and spotting degrade whenever the ship is steaming hard.",
          remedies: [
            { id: "move_director", description: "Move the director away from the funnel." },
            { id: "move_funnel", description: "Relocate or trunk the funnel." },
            { id: "raise_director", description: "Raise the director (more topweight)." },
          ],
          evidence: {
            formulaId: "F-FC",
            inputs: {},
            threshold: b.smokeInterferencePermille,
            value: Math.abs(i.funnelStationsPermille[0]! - d.stationPermille),
          },
          subject: { targets: [placementTarget(d.instanceId)] },
        });
      }
    } else {
      acc -= b.localControlPenaltyBp;
    }
    control.push({
      gunId: g.instanceId,
      directorId: d?.instanceId ?? null,
      accuracyBp: Math.max(0, acc),
    });
  }
  const uncontrolled = control.filter((c) => c.directorId === null);
  if (uncontrolled.length > 0 && i.guns.length > 0) {
    findings.push({
      id: "FC_INCOMPATIBLE",
      severity: "WARNING",
      what: `${uncontrolled.length} gun(s) have no compatible fire-control director.`,
      why: `No director with free capacity supports: ${[...new Set(i.guns.filter((g) => uncontrolled.some((u) => u.gunId === g.instanceId)).map((g) => g.fcClass))].sort((a, b2) => (a < b2 ? -1 : 1)).join(", ")}.`,
      consequence: `They fire under local control at -${b.localControlPenaltyBp} bp accuracy.`,
      remedies: [
        { id: "add_director", description: "Fit a director that supports these guns." },
        { id: "more_capacity", description: "Fit a director with greater capacity." },
        { id: "change_guns", description: "Choose guns compatible with the available directors." },
      ],
      evidence: {
        formulaId: "F-FC",
        inputs: { guns: i.guns.length },
        threshold: 0,
        value: uncontrolled.length,
      },
      subject: { targets: uncontrolled.map((u) => placementTarget(u.gunId)) },
    });
  }

  const positions = i.fireControlPositions ?? 0;
  if (!Number.isSafeInteger(positions) || positions < 0)
    throw new Error(`fireControlPositions must be a non-negative integer, got ${positions}`);
  if (positions === 0 && directors.length > 0 && i.guns.length > 0) {
    findings.push({
      id: "FIRE_CONTROL_NO_POSITIONS",
      severity: "WARNING",
      what: "Directors are fitted but there are no fire-control positions.",
      why: `${directors.length} director(s) and ${i.guns.length} gun(s), 0 positions.`,
      consequence:
        "Central fire control has no redundancy: one hit on the director or its position leaves the guns under local control.",
      remedies: [
        { id: "add_positions", description: "Build in fire-control positions for redundancy." },
        { id: "accept_risk", description: "Accept the single point of failure." },
      ],
      evidence: {
        formulaId: "F-FC",
        inputs: { directors: directors.length },
        threshold: 1,
        value: 0,
      },
    });
  }
  const fireControlRedundancyBp = Math.min(
    10_000,
    toSafe("fcRedundancy", BigInt(positions) * BigInt(b.fireControlPositionRedundancyBp ?? 0)),
  );

  return {
    demandKw: demand,
    supplyKw: supply,
    coolingDemandKw: coolingDemand,
    coolingShortfallBp,
    reliabilityPenaltyBp,
    crewRequired,
    crewCapacity,
    crowdingBp,
    gunControl: control,
    fireControlRedundancyBp,
    findings: sortFindings(findings),
  };
}
