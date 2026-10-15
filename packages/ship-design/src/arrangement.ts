import type { ComponentCategory } from "./component.js";
import type { Finding } from "./findings.js";
import { placementTarget, sortFindings, zoneTarget, type FindingTarget } from "./findings.js";
import { toSafe } from "./units.js";

/** The nine longitudinal zones (spec §8.1); order is bow to stern, MISSION overlays the upper decks. */
export const ZONE_IDS = [
  "FORECASTLE",
  "FWD_MAGAZINE",
  "FWD_SERVICE",
  "CENTRAL_MACHINERY",
  "SUPERSTRUCTURE",
  "AFT_SERVICE",
  "AFT_MAGAZINE",
  "QUARTERDECK",
  "MISSION",
] as const;
export type ZoneId = (typeof ZONE_IDS)[number];

/** Zone record from the hull form (data). Station range in permille of waterline length (0 = bow). */
export interface ZoneDef {
  readonly id: ZoneId;
  readonly startPermille: number;
  readonly endPermille: number;
  /** Share of total internal volume, bp; all zones sum to 10_000. */
  readonly volumeBp: number;
  /** Share of total usable deck area, bp; all zones sum to 10_000. */
  readonly deckAreaBp: number;
}

export interface HullEnvelope {
  readonly lengthMm: number;
  readonly beamMm: number;
  readonly depthMm: number;
  /** Internal-volume fullness: fraction of L*B*D that is usable, bp. */
  readonly volumeFullnessBp: number;
  /** Usable deck area as fraction of L*B, bp. */
  readonly deckFullnessBp: number;
}

/** A catalogue component resolved for one placement (computed upstream from ComponentDef + parameters). */
export interface ResolvedPlacement {
  readonly instanceId: string;
  readonly componentId: string;
  readonly category: ComponentCategory;
  readonly zoneId: ZoneId;
  readonly stationPermille: number;
  readonly weightKg: number;
  readonly volumeLitre: number;
  readonly deckFootprintMm2: number;
  readonly heightMm: number;
  /** Vertical centre of gravity above keel, mm. */
  readonly zCgMm: number;
  readonly allowedZones: readonly ZoneId[];
  /** Categories that may not share a zone with this component (e.g. barbette trunk vs machinery). */
  readonly forbidsCoLocation: readonly ComponentCategory[];
  readonly critical: boolean;
  /** Magazine capacity supplied (litres), for MAGAZINE components. */
  readonly magazineLitre?: number;
  /** Ammunition stowage demanded (litres) and the magazine instance feeding it. */
  readonly ammoVolumeLitre?: number;
  readonly magazineRef?: string;
  readonly maxFeedPermille?: number;
}

export interface ArrangementBalance {
  /** Share of critical systems (by count) in one zone above which concentration is flagged, bp. */
  readonly concentrationAdvisoryBp: number;
  readonly concentrationWarningBp: number;
}

export interface ZoneSummary {
  readonly zoneId: ZoneId;
  readonly weightKg: number;
  readonly volumeUsedLitre: number;
  readonly volumeCapacityLitre: number;
  readonly deckUsedMm2: number;
  readonly deckCapacityMm2: number;
}

export interface ArrangementResult {
  readonly zones: readonly ZoneSummary[];
  readonly totalWeightKg: number;
  /** Longitudinal centre of gravity of placed components, permille from the bow (null if nothing placed). */
  readonly lcgPermille: number | null;
  /** Sum of weight*z for the vertical-centre calculation (kg*mm). */
  readonly verticalMomentKgMm: number;
  readonly findings: readonly Finding[];
}

const BP = 10_000n;
const fmt = (n: number) => n.toLocaleString("en-US");

/** Structural checks on a zone set; returns problems (empty = valid). */
export function checkZoneSet(zones: readonly ZoneDef[]): string[] {
  const problems: string[] = [];
  if (zones.length !== ZONE_IDS.length || ZONE_IDS.some((z, i) => zones[i]?.id !== z)) {
    problems.push("zones must be exactly the nine canonical zones in order");
    return problems;
  }
  if (zones.reduce((s, z) => s + z.volumeBp, 0) !== 10_000)
    problems.push("volumeBp must sum to 10000");
  if (zones.reduce((s, z) => s + z.deckAreaBp, 0) !== 10_000)
    problems.push("deckAreaBp must sum to 10000");
  for (const z of zones) {
    if (z.startPermille < 0 || z.endPermille > 1000 || z.startPermille >= z.endPermille) {
      problems.push(`zone ${z.id} has an invalid station range`);
    }
  }
  return problems;
}

function mk(
  id: string,
  severity: Finding["severity"],
  what: string,
  why: string,
  consequence: string,
  remedies: [string, string][],
  evidence: Finding["evidence"],
  targets: readonly FindingTarget[],
): Finding {
  return {
    id,
    severity,
    what,
    why,
    consequence,
    remedies: remedies.map(([rid, description]) => ({ id: rid, description })),
    evidence,
    subject: { targets },
  };
}

/**
 * Checks the arrangement rules of spec §8.3 (the volume/footprint, co-location, zone-compatibility, magazine and
 * concentration rules). Arc, flight-deck, power, cooling and crew rules land with their owning models.
 */
export function analyseArrangement(
  placements: readonly ResolvedPlacement[],
  zones: readonly ZoneDef[],
  hull: HullEnvelope,
  balance: ArrangementBalance,
): ArrangementResult {
  const problems = checkZoneSet(zones);
  if (problems.length > 0) throw new Error(`invalid zone set: ${problems.join("; ")}`);
  const findings: Finding[] = [];

  const totalVol =
    (BigInt(hull.lengthMm) *
      BigInt(hull.beamMm) *
      BigInt(hull.depthMm) *
      BigInt(hull.volumeFullnessBp)) /
    BP /
    1_000_000n; // litres (mm3 / 1e6)
  const totalDeck =
    (BigInt(hull.lengthMm) * BigInt(hull.beamMm) * BigInt(hull.deckFullnessBp)) / BP;
  const zoneMap = new Map(zones.map((z) => [z.id, z]));
  const sorted = [...placements].sort((a, b) =>
    a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0,
  );

  const seen = new Set<string>();
  for (const p of sorted) {
    if (seen.has(p.instanceId)) {
      findings.push(
        mk(
          "ARR-DUPLICATE-INSTANCE",
          "BLOCKING",
          `Instance id ${p.instanceId} is used twice.`,
          "Placements must be unique.",
          "The design is ambiguous.",
          [
            ["rename", "Give each placement a unique id."],
            ["remove", "Remove the duplicate."],
            ["merge", "Merge into one placement with a higher count."],
          ],
          { formulaId: "ARR", inputs: {}, threshold: 1, value: 2 },
          [placementTarget(p.instanceId)],
        ),
      );
    }
    seen.add(p.instanceId);
    const z = zoneMap.get(p.zoneId)!;
    if (p.stationPermille < z.startPermille || p.stationPermille > z.endPermille) {
      findings.push(
        mk(
          "ARR-STATION-OUT-OF-ZONE",
          "BLOCKING",
          `${p.instanceId} is positioned outside zone ${p.zoneId}.`,
          `Station ${p.stationPermille} is outside ${z.startPermille}-${z.endPermille}.`,
          "Position and zone disagree; weights and arcs would be wrong.",
          [
            ["move_station", `Move to a station within ${z.startPermille}-${z.endPermille}.`],
            ["change_zone", "Assign the zone containing this station."],
            ["remove", "Remove the component."],
          ],
          {
            formulaId: "ARR",
            inputs: { station: p.stationPermille },
            threshold: z.startPermille,
            value: p.stationPermille,
          },
          [placementTarget(p.instanceId), zoneTarget(p.zoneId)],
        ),
      );
    }
    if (!p.allowedZones.includes(p.zoneId)) {
      findings.push(
        mk(
          "ARR-ZONE-NOT-ALLOWED",
          "BLOCKING",
          `${p.componentId} may not be placed in ${p.zoneId}.`,
          `Allowed zones: ${p.allowedZones.join(", ")}.`,
          "The component cannot function there.",
          [
            ["move_zone", `Move it to ${p.allowedZones[0] ?? "an allowed zone"}.`],
            ["swap_component", "Choose a component that fits this zone."],
            ["remove", "Remove it."],
          ],
          { formulaId: "ARR", inputs: {}, threshold: 0, value: 1 },
          [placementTarget(p.instanceId)],
        ),
      );
    }
  }

  const summaries: ZoneSummary[] = zones.map((z) => {
    const inZone = sorted.filter((p) => p.zoneId === z.id);
    const volumeCap = toSafe("vol", (totalVol * BigInt(z.volumeBp)) / BP);
    const deckCap = toSafe("deck", (totalDeck * BigInt(z.deckAreaBp)) / BP);
    const s: ZoneSummary = {
      zoneId: z.id,
      weightKg: inZone.reduce((a, p) => a + p.weightKg, 0),
      volumeUsedLitre: inZone.reduce((a, p) => a + p.volumeLitre, 0),
      volumeCapacityLitre: volumeCap,
      deckUsedMm2: inZone.reduce((a, p) => a + p.deckFootprintMm2, 0),
      deckCapacityMm2: deckCap,
    };
    if (s.volumeUsedLitre > volumeCap) {
      findings.push(
        mk(
          "ARR-OVERLAP",
          "BLOCKING",
          `Zone ${z.id} is over-full by volume.`,
          `${fmt(s.volumeUsedLitre)} L placed in ${fmt(volumeCap)} L.`,
          "Components would physically overlap; the arrangement is impossible.",
          [
            ["move_component", "Move a component to a zone with spare volume."],
            ["smaller_component", "Choose lighter/more compact components."],
            ["bigger_hull", "Enlarge the hull."],
          ],
          {
            formulaId: "ARR-VOL",
            inputs: { zone: z.volumeBp },
            threshold: volumeCap,
            value: s.volumeUsedLitre,
          },
          [zoneTarget(z.id)],
        ),
      );
    }
    if (s.deckUsedMm2 > deckCap) {
      findings.push(
        mk(
          "ARR-OVERLAP",
          "BLOCKING",
          `Zone ${z.id} is over-full by deck area.`,
          `${fmt(s.deckUsedMm2)} mm² placed in ${fmt(deckCap)} mm².`,
          "Mounts and fittings would overlap on deck.",
          [
            ["move_component", "Move a component to a zone with spare deck."],
            ["fewer_mounts", "Reduce the number of mounts here."],
            ["wider_hull", "Increase length or beam."],
          ],
          {
            formulaId: "ARR-DECK",
            inputs: { zone: z.deckAreaBp },
            threshold: deckCap,
            value: s.deckUsedMm2,
          },
          [zoneTarget(z.id)],
        ),
      );
    }
    return s;
  });

  // Co-location (e.g. barbette over machinery).
  for (const p of sorted) {
    for (const q of sorted) {
      if (p === q || p.zoneId !== q.zoneId) continue;
      if (p.forbidsCoLocation.includes(q.category)) {
        findings.push(
          mk(
            "ARR-TURRET-ON-MACHINERY",
            "BLOCKING",
            `${p.instanceId} shares ${p.zoneId} with ${q.instanceId} (${q.category}).`,
            `${p.componentId} forbids co-location with ${q.category}.`,
            "Its trunk or structure would cut through that space.",
            [
              ["move_a", `Move ${p.instanceId} to another zone.`],
              ["move_b", `Move ${q.instanceId} to another zone.`],
              ["swap_component", "Use a component that tolerates co-location."],
            ],
            { formulaId: "ARR", inputs: {}, threshold: 0, value: 1 },
            [placementTarget(p.instanceId), placementTarget(q.instanceId)],
          ),
        );
      }
    }
  }

  // Magazine capacity and feed distance.
  const byId = new Map(sorted.map((p) => [p.instanceId, p]));
  const demand = new Map<string, number>();
  for (const p of sorted) {
    if (p.ammoVolumeLitre === undefined || p.ammoVolumeLitre <= 0) continue;
    const mag = p.magazineRef ? byId.get(p.magazineRef) : undefined;
    if (!mag || mag.magazineLitre === undefined) {
      findings.push(
        mk(
          "ARR-MAG-VOLUME",
          "BLOCKING",
          `${p.instanceId} has no magazine.`,
          `${fmt(p.ammoVolumeLitre)} L of ammunition has nowhere to be stowed.`,
          "The weapon cannot be supplied.",
          [
            ["add_magazine", "Add a magazine and link it."],
            ["link_magazine", "Link an existing magazine."],
            ["remove_weapon", "Remove the weapon."],
          ],
          { formulaId: "F-G2", inputs: {}, threshold: p.ammoVolumeLitre, value: 0 },
          [placementTarget(p.instanceId)],
        ),
      );
      continue;
    }
    demand.set(mag.instanceId, (demand.get(mag.instanceId) ?? 0) + p.ammoVolumeLitre);
    const dist = Math.abs(p.stationPermille - mag.stationPermille);
    if (p.maxFeedPermille !== undefined && dist > p.maxFeedPermille) {
      findings.push(
        mk(
          "ARR-MAG-DIST",
          "CRITICAL",
          `${p.instanceId} is too far from magazine ${mag.instanceId}.`,
          `${dist} permille apart; limit ${p.maxFeedPermille}.`,
          "Ammunition supply is slow: rate of fire collapses in sustained action.",
          [
            ["move_mag", "Move the magazine closer."],
            ["add_mag", "Add a magazine near the mount."],
            ["relocate_mount", "Relocate the mount."],
          ],
          { formulaId: "F-G3", inputs: { dist }, threshold: p.maxFeedPermille, value: dist },
          [placementTarget(p.instanceId), placementTarget(mag.instanceId)],
        ),
      );
    }
  }
  for (const [magId, need] of [...demand.entries()].sort((x, y) =>
    x[0] < y[0] ? -1 : x[0] > y[0] ? 1 : 0,
  )) {
    const mag = byId.get(magId)!;
    if (need > (mag.magazineLitre ?? 0)) {
      findings.push(
        mk(
          "ARR-MAG-VOLUME",
          "BLOCKING",
          `Magazine ${magId} is too small.`,
          `${fmt(need)} L of ammunition vs ${fmt(mag.magazineLitre ?? 0)} L capacity.`,
          "The stated ammunition load cannot be carried.",
          [
            ["bigger_magazine", "Use a larger magazine."],
            ["fewer_rounds", "Reduce rounds per gun."],
            ["split_magazine", "Add a second magazine and re-link guns."],
          ],
          { formulaId: "F-G2", inputs: {}, threshold: mag.magazineLitre ?? 0, value: need },
          [placementTarget(magId)],
        ),
      );
    }
  }

  // Critical-system concentration, by number of critical systems per zone (one engine room is not "concentration").
  const crit = sorted.filter((p) => p.critical);
  if (crit.length > 1) {
    for (const s of summaries) {
      const n = crit.filter((p) => p.zoneId === s.zoneId).length;
      const share = toSafe("share", (BigInt(n) * BP) / BigInt(crit.length));
      if (share > balance.concentrationAdvisoryBp) {
        const warn = share > balance.concentrationWarningBp;
        findings.push(
          mk(
            "ARR-CRITICAL-CONC",
            warn ? "WARNING" : "ADVISORY",
            `Critical systems are concentrated in ${s.zoneId}.`,
            `${n} of ${crit.length} critical systems (${share} bp) sit in one zone (limit ${warn ? balance.concentrationWarningBp : balance.concentrationAdvisoryBp} bp).`,
            "One hit or flood can disable propulsion, power or magazines together.",
            [
              ["spread", "Spread machinery or magazines across zones."],
              ["split_plant", "Use separate engine rooms."],
              ["accept", "Accept the risk for a cheaper, more compact ship."],
            ],
            {
              formulaId: "F-A9",
              inputs: { share },
              threshold: warn ? balance.concentrationWarningBp : balance.concentrationAdvisoryBp,
              value: share,
            },
            [zoneTarget(s.zoneId)],
          ),
        );
      }
    }
  }

  const totalWeightKg = sorted.reduce((a, p) => a + p.weightKg, 0);
  let lcg: number | null = null;
  let vmom = 0;
  if (totalWeightKg > 0) {
    lcg = toSafe(
      "lcg",
      sorted.reduce((a, p) => a + BigInt(p.weightKg) * BigInt(p.stationPermille), 0n) /
        BigInt(totalWeightKg),
    );
    vmom = toSafe(
      "vmom",
      sorted.reduce((a, p) => a + BigInt(p.weightKg) * BigInt(p.zCgMm), 0n),
    );
  }
  return {
    zones: summaries,
    totalWeightKg,
    lcgPermille: lcg,
    verticalMomentKgMm: vmom,
    findings: sortFindings(findings),
  };
}
