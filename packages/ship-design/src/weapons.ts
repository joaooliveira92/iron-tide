import type { Finding } from "./findings.js";
import { placementTarget, sortFindings } from "./findings.js";
import { evaluate, type LookupTable } from "./formula/eval.js";
import { parseFormula } from "./formula/parse.js";
import { toSafe } from "./units.js";

export type MountSide = "CENTRE" | "PORT" | "STBD";

/** A weapon mount resolved from a gun-class ComponentDef plus the player's chosen parameters. */
export interface GunMount {
  readonly instanceId: string;
  readonly stationPermille: number;
  readonly side: MountSide;
  readonly barrels: number;
  readonly roundsPerBarrel: number;
  /** Projectile mass in grams (machine-gun bullets and 3-pdr shells are not whole kilograms). */
  readonly shellMassG: number;
  /** Propellant charge as bp of shell mass. */
  readonly chargeBp: number;
  /** Stowed volume of one round in millilitres. */
  readonly roundVolumeMl: number;
  /** Base rate of fire, hundredths of rounds per barrel per minute. */
  readonly rofBaseX100: number;
  /** Degrees that can bear on the beam on one side before obstruction. */
  readonly beamArcDeg: number;
  /** Magazine distance in permille of length (from the arrangement model). */
  readonly feedDistancePermille: number;
}

/** Superstructure / funnel / mast block that can shadow nearby mounts. */
export interface ArcObstacle {
  readonly id: string;
  readonly fromPermille: number;
  readonly toPermille: number;
  /** A mount within this many permille of the block is shadowed. */
  readonly reachPermille: number;
  readonly blockedDeg: number;
}

export interface WeaponBalance {
  /** Feed factor (bp) versus magazine distance (permille). */
  readonly feedFactor: LookupTable;
  /** Stowage overhead on round volume, bp (10_000 = none). */
  readonly stowageBp: number;
  /** Blast load per kg of shell mass, bp. */
  readonly blastLoadBp: number;
  /** A mount counts toward the broadside only if its effective beam arc is at least this. */
  readonly minBeamArcDeg: number;
  /** Arc loss (deg) above which a warning is raised. */
  readonly arcWarnLossDeg: number;
}

export interface MountResult {
  readonly instanceId: string;
  readonly ammoMassKg: number;
  readonly ammoVolumeLitre: number;
  /** Rounds per minute x100 for the whole mount. */
  readonly rofX100: number;
  readonly effectiveBeamArcDeg: number;
  readonly countsToBroadside: boolean;
}

export interface WeaponsResult {
  readonly mounts: readonly MountResult[];
  readonly ammoMassKg: number;
  readonly ammoVolumeLitre: number;
  /** Shell mass of one simultaneous salvo, per side (kg). */
  readonly broadsidePortKg: number;
  readonly broadsideStbdKg: number;
  /** Sustained shell mass per minute, weaker side (kg/min, x100). */
  readonly sustainedPerMinX100: number;
  readonly blastLoadKg: number;
  readonly findings: readonly Finding[];
}

const BP = 10_000n;

export function compileWeapons(
  mounts: readonly GunMount[],
  obstacles: readonly ArcObstacle[],
  crewQualityBp: number,
  balance: WeaponBalance,
): WeaponsResult {
  const findings: Finding[] = [];
  const results: MountResult[] = [];
  const sorted = [...mounts].sort((a, b) =>
    a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0,
  );
  const feed = parseFormula("lookup(feed, d)");
  let port = 0n;
  let stbd = 0n;
  let sustPort = 0n;
  let sustStbd = 0n;
  let ammoMass = 0n;
  let ammoVol = 0n;
  let blast = 0n;

  for (const m of sorted) {
    if (m.barrels < 1 || m.roundsPerBarrel < 0)
      throw new Error(`mount ${m.instanceId}: invalid barrels/rounds`);
    const rounds = BigInt(m.barrels) * BigInt(m.roundsPerBarrel);
    const massG = rounds * BigInt(m.shellMassG) * (BP + BigInt(m.chargeBp));
    const mass = (massG + BP * 1000n - 1n) / (BP * 1000n);
    const vol =
      (rounds * BigInt(m.roundVolumeMl) * BigInt(balance.stowageBp) + BP * 1000n - 1n) /
      (BP * 1000n);
    const feedBp = evaluate(feed, {
      vars: { d: m.feedDistancePermille },
      tables: { feed: balance.feedFactor },
    });
    const rof =
      (BigInt(m.barrels) * BigInt(m.rofBaseX100) * BigInt(crewQualityBp) * BigInt(feedBp)) /
      (BP * BP);

    let lost = 0;
    for (const o of obstacles) {
      if (
        m.stationPermille >= o.fromPermille - o.reachPermille &&
        m.stationPermille <= o.toPermille + o.reachPermille
      ) {
        lost += o.blockedDeg;
      }
    }
    const effArc = Math.max(0, m.beamArcDeg - lost);
    const counts = effArc >= balance.minBeamArcDeg;
    if (lost >= balance.arcWarnLossDeg && m.beamArcDeg > 0) {
      findings.push({
        id: "ARC_OBSTRUCTED",
        severity: "WARNING",
        what: `${m.instanceId} loses ${lost}° of its beam arc to the superstructure.`,
        why: `Effective beam arc ${effArc}° of ${m.beamArcDeg}°${counts ? "" : `; below the ${balance.minBeamArcDeg}° needed to count in the broadside`}.`,
        consequence: counts
          ? "The mount fires on fewer bearings, so it is usable less often."
          : "The mount cannot fire on the beam and adds nothing to the broadside.",
        remedies: [
          { id: "move_mount", description: "Move the mount away from the obstruction." },
          { id: "lower_structure", description: "Shorten or relocate the superstructure/funnel." },
          { id: "different_side", description: "Mount on the opposite end of the ship." },
        ],
        evidence: {
          formulaId: "F-G4",
          inputs: { lost, beamArcDeg: m.beamArcDeg },
          threshold: balance.arcWarnLossDeg,
          value: lost,
        },
        subject: { targets: [placementTarget(m.instanceId)] },
      });
    }

    const shellPerSalvo = BigInt(m.barrels) * BigInt(m.shellMassG); // grams
    const sustained = BigInt(m.shellMassG) * rof; // grams x rounds/min x100
    if (counts) {
      if (m.side !== "STBD") {
        port += shellPerSalvo;
        sustPort += sustained;
      }
      if (m.side !== "PORT") {
        stbd += shellPerSalvo;
        sustStbd += sustained;
      }
    }
    ammoMass += mass;
    ammoVol += vol;
    blast +=
      (BigInt(m.barrels) * BigInt(m.shellMassG) * BigInt(balance.blastLoadBp)) / (BP * 1000n);
    results.push({
      instanceId: m.instanceId,
      ammoMassKg: toSafe("ammoMass", mass),
      ammoVolumeLitre: toSafe("ammoVol", vol),
      rofX100: toSafe("rof", rof),
      effectiveBeamArcDeg: effArc,
      countsToBroadside: counts,
    });
  }

  return {
    mounts: results,
    ammoMassKg: toSafe("ammoMass", ammoMass),
    ammoVolumeLitre: toSafe("ammoVol", ammoVol),
    broadsidePortKg: toSafe("port", (port + 500n) / 1000n),
    broadsideStbdKg: toSafe("stbd", (stbd + 500n) / 1000n),
    sustainedPerMinX100: toSafe("sust", (sustPort < sustStbd ? sustPort : sustStbd) / 1000n),
    blastLoadKg: toSafe("blast", blast),
    findings: sortFindings(findings),
  };
}
