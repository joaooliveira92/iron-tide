import {
  TENSION_LABEL_BANDS,
  isHighTension,
  tensionLabel,
  type OpeningBriefingArea,
  type OpeningBriefingProjection,
  type OpeningBriefingRelationsRow,
  type TensionLabel,
} from "@bluewave/campaign-engine";

/**
 * World Situation Briefing view-model (Opening Strategic Briefing, Foreign
 * Intelligence page). Pure and deterministic: it folds the engine's
 * `OpeningBriefingProjection` plus an injected, already-decoded presentation
 * source into the grouped, interpreted shape the screen renders. It reads no
 * global, mutates no input, and never branches on a nation's name — placement
 * comes from who controls which world area and how areas group into theatres.
 *
 * Four distinct concepts are kept apart on every power and are never derived
 * from one another's display strings:
 *  - `status`   — the formal diplomatic standing (the engine's relation kind);
 *  - `attitude` — the bilateral disposition, the engine's tension band;
 *  - `tension`  — the 0..10 score behind the attitude (higher = closer to war);
 *  - `outlook`  — whether the pairing is likely to turn into a flashpoint,
 *                 which also weighs whether the two powers share a theatre;
 *  - `confidence` — how well the intelligence is known; `null` when the
 *                 campaign carries no grading (nothing is invented).
 */

export type RelationKind = OpeningBriefingRelationsRow["relation"];

/** Every formal status, in the order the posture summary lists them. */
export const RELATION_KINDS: readonly RelationKind[] = [
  "allied",
  "trade_agreement",
  "neutral",
  "at_war",
];

/** How much a power matters to the player's opening position, most relevant first. */
export type RelevanceTier = "immediate" | "wide_reach" | "distant";

export const RELEVANCE_TIERS: readonly RelevanceTier[] = ["immediate", "wide_reach", "distant"];

/** Why a power sits in its tier. Copy is chosen per code, never assembled from fragments. */
export type RelevanceReason =
  | "at_war"
  | "high_tension"
  | "shares_theater"
  | "overseas_reach"
  | "no_contact";

/** Whether the pairing is stable, uncertain, or a likely flashpoint. Worst first. */
export type PowerOutlook = "flashpoint" | "uncertain" | "stable";

export const POWER_OUTLOOKS: readonly PowerOutlook[] = ["flashpoint", "uncertain", "stable"];

/** Reserved for intelligence grading; the opening campaign carries none yet. */
export type IntelligenceConfidenceLevel = "confirmed" | "estimated" | "uncertain";

/**
 * A power holding areas in at least this many distinct theatres has reach across
 * the wider world rather than a single region.
 */
export const OVERSEAS_REACH_MIN_THEATERS = 3;

/** The tension band from which a shared theatre turns a strained relation into a flashpoint. */
const FLASHPOINT_BAND: TensionLabel = "strained";

/** The lowest tension at which a shared theatre makes an otherwise calm pairing uncertain. */
const UNCERTAIN_MIN_TENSION = lowerBound("neutral");

function lowerBound(label: TensionLabel): number {
  return TENSION_LABEL_BANDS.find((band) => band.label === label)?.min ?? 0;
}

function bandAtLeast(band: TensionLabel, floor: TensionLabel): boolean {
  return lowerBound(band) >= lowerBound(floor);
}

export interface TheaterRef {
  readonly id: string;
  readonly label: string;
}

/** The authored, decoded presentation facts about one nation (any may be absent). */
export interface NationProfileSource {
  readonly officialName: string;
  readonly diplomacy: string;
  readonly military: string;
  readonly economy: string;
  readonly strategicRegions: string;
  readonly doctrine: string;
  readonly budgetCategory: string;
  readonly shipbuildingCapacity: string;
  readonly likelyRivals: readonly string[];
}

/** Everything the view-model needs beyond the engine projection, injected by the caller. */
export interface WorldSituationSource {
  readonly projection: OpeningBriefingProjection;
  /** Display regions (theatres), in display order. */
  readonly theaters: readonly TheaterRef[];
  /** World area id → theatre id. */
  readonly areaTheater: Readonly<Record<string, string>>;
  /** The player's home-waters area id, or null when unknown. */
  readonly homeAreaId: string | null;
  /** Authored profile for a campaign nation id, or null when none exists. */
  readonly profileFor: (nationId: string) => NationProfileSource | null;
}

export interface TheaterHolding {
  readonly areaId: string;
  readonly name: string;
  readonly theaterId: string;
  readonly theaterLabel: string;
}

export interface PowerBrief {
  readonly nationId: string;
  readonly name: string;
  readonly tier: RelevanceTier;
  readonly reason: RelevanceReason;
  readonly status: RelationKind;
  readonly nonAggressionPact: boolean;
  readonly tension: number;
  readonly attitude: TensionLabel;
  readonly outlook: PowerOutlook;
  /** Holdings inside the player's own theatres. */
  readonly sharedHoldings: readonly TheaterHolding[];
  /** How many distinct theatres the power holds areas in (0 when none are known). */
  readonly theaterCount: number;
  /** `null` — the opening campaign carries no intelligence grading. */
  readonly confidence: IntelligenceConfidenceLevel | null;
  readonly profile: NationProfileSource | null;
  /** True when the power's authored rivals name the player's nation. */
  readonly regardsPlayerAsRival: boolean;
}

export interface PowerGroup {
  readonly tier: RelevanceTier;
  readonly powers: readonly PowerBrief[];
}

export interface TheaterEntry {
  readonly theater: TheaterRef;
  readonly isPlayerTheater: boolean;
  readonly powers: readonly { readonly nationId: string; readonly name: string }[];
}

export interface WorldSituation {
  readonly player: {
    readonly nationId: string;
    readonly name: string;
    /** The authored diplomatic situation of the player's nation, when it exists. */
    readonly assessment: string | null;
    /** Theatres the player holds areas in; the first is the primary theatre. */
    readonly theaters: readonly TheaterRef[];
  };
  readonly month: OpeningBriefingProjection["month"];
  /** Non-empty tiers only, in relevance order. */
  readonly groups: readonly PowerGroup[];
  /** Every power in on-screen order; the keyboard order of the navigator. */
  readonly ordered: readonly PowerBrief[];
  readonly posture: {
    readonly byStatus: Readonly<Record<RelationKind, number>>;
    readonly byOutlook: Readonly<Record<PowerOutlook, number>>;
  };
  /** Theatres where at least one power is present, the player's own first. */
  readonly theaterBoard: readonly TheaterEntry[];
  /** The power selected before the player chooses one: the most pressing. */
  readonly defaultSelectionId: string | null;
}

const OUTLOOK_RANK: Readonly<Record<PowerOutlook, number>> = {
  flashpoint: 0,
  uncertain: 1,
  stable: 2,
};

/** Outlook for one pairing; exhaustive over status and band, deterministic. */
export function deriveOutlook(
  status: RelationKind,
  tension: number,
  sharesTheater: boolean,
): PowerOutlook {
  if (status === "at_war" || isHighTension(tension)) return "flashpoint";
  const band = tensionLabel(tension);
  if (sharesTheater && bandAtLeast(band, FLASHPOINT_BAND)) return "flashpoint";
  if (bandAtLeast(band, FLASHPOINT_BAND)) return "uncertain";
  if (sharesTheater && tension >= UNCERTAIN_MIN_TENSION && status !== "allied") return "uncertain";
  return "stable";
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function comparePowers(a: PowerBrief, b: PowerBrief): number {
  return (
    OUTLOOK_RANK[a.outlook] - OUTLOOK_RANK[b.outlook] ||
    b.tension - a.tension ||
    b.sharedHoldings.length - a.sharedHoldings.length ||
    b.theaterCount - a.theaterCount ||
    compareText(a.name, b.name) ||
    compareText(a.nationId, b.nationId)
  );
}

function tierAndReason(
  status: RelationKind,
  tension: number,
  sharedCount: number,
  theaterCount: number,
): { readonly tier: RelevanceTier; readonly reason: RelevanceReason } {
  if (status === "at_war") return { tier: "immediate", reason: "at_war" };
  if (isHighTension(tension)) return { tier: "immediate", reason: "high_tension" };
  if (sharedCount > 0) return { tier: "immediate", reason: "shares_theater" };
  if (theaterCount >= OVERSEAS_REACH_MIN_THEATERS) {
    return { tier: "wide_reach", reason: "overseas_reach" };
  }
  return { tier: "distant", reason: "no_contact" };
}

function playerIsNamedIn(rivals: readonly string[], playerNames: readonly string[]): boolean {
  const names = playerNames.map((name) => name.toLowerCase());
  return rivals.some((rival) => {
    const needle = rival.trim().toLowerCase();
    return needle.length > 0 && names.some((name) => name.includes(needle));
  });
}

/** Folds the engine projection and presentation source into the briefing view-model. */
export function buildWorldSituation(source: WorldSituationSource): WorldSituation {
  const { projection, theaters, areaTheater, profileFor } = source;
  const theaterById = new Map(theaters.map((theater) => [theater.id, theater] as const));
  const theaterOrder = new Map(theaters.map((theater, index) => [theater.id, index] as const));
  const theaterOf = (areaId: string): TheaterRef | null => {
    const id = areaTheater[areaId];
    return id === undefined ? null : (theaterById.get(id) ?? null);
  };

  // The player's theatres, the busiest first. The primary theatre anchors "shares
  // your waters": the one holding the player's home waters, else the busiest. A
  // far-flung power would otherwise share waters with everyone.
  const playerCounts = new Map<string, number>();
  for (const area of projection.foreignIntelligence.playerAreas) {
    const theater = theaterOf(area.areaId);
    if (theater !== null) playerCounts.set(theater.id, (playerCounts.get(theater.id) ?? 0) + 1);
  }
  const byWeight: TheaterRef[] = [...playerCounts.entries()]
    .sort(
      ([idA, a], [idB, b]) => b - a || (theaterOrder.get(idA) ?? 0) - (theaterOrder.get(idB) ?? 0),
    )
    .flatMap(([id]) => theaterById.get(id) ?? []);
  const homeTheater = source.homeAreaId === null ? null : theaterOf(source.homeAreaId);
  const primaryTheater =
    homeTheater !== null && playerCounts.has(homeTheater.id) ? homeTheater : (byWeight[0] ?? null);
  const playerTheaters: TheaterRef[] =
    primaryTheater === null
      ? []
      : [primaryTheater, ...byWeight.filter((theater) => theater.id !== primaryTheater.id)];
  const playerTheaterIds = new Set(primaryTheater === null ? [] : [primaryTheater.id]);

  const playerProfile = profileFor(projection.nationId);
  const playerNames = [projection.nationName, playerProfile?.officialName ?? ""];

  const powers: PowerBrief[] = projection.foreignIntelligence.relations.map((row) => {
    const holdings: readonly OpeningBriefingArea[] = row.controlledAreas;
    const placed = holdings.flatMap((area) => {
      const theater = theaterOf(area.areaId);
      return theater === null
        ? []
        : [
            {
              areaId: area.areaId,
              name: area.name,
              theaterId: theater.id,
              theaterLabel: theater.label,
            },
          ];
    });
    const shared = placed.filter((holding) => playerTheaterIds.has(holding.theaterId));
    const theaterCount = new Set(placed.map((holding) => holding.theaterId)).size;
    const profile = profileFor(row.nationId);
    const { tier, reason } = tierAndReason(row.relation, row.tension, shared.length, theaterCount);
    return {
      nationId: row.nationId,
      name: row.name,
      tier,
      reason,
      status: row.relation,
      nonAggressionPact: row.nap,
      tension: row.tension,
      attitude: tensionLabel(row.tension),
      outlook: deriveOutlook(row.relation, row.tension, shared.length > 0),
      sharedHoldings: shared,
      theaterCount,
      confidence: null,
      profile,
      regardsPlayerAsRival: profile !== null && playerIsNamedIn(profile.likelyRivals, playerNames),
    };
  });

  const groups: PowerGroup[] = RELEVANCE_TIERS.map((tier) => ({
    tier,
    powers: powers.filter((power) => power.tier === tier).sort(comparePowers),
  })).filter((group) => group.powers.length > 0);
  const ordered = groups.flatMap((group) => group.powers);

  const byStatus: Record<RelationKind, number> = {
    allied: 0,
    trade_agreement: 0,
    neutral: 0,
    at_war: 0,
  };
  const byOutlook: Record<PowerOutlook, number> = { flashpoint: 0, uncertain: 0, stable: 0 };
  for (const power of powers) {
    byStatus[power.status] += 1;
    byOutlook[power.outlook] += 1;
  }

  // Theatre board: every theatre where a known power holds an area, the player's own first.
  const presence = new Map<string, Map<string, string>>();
  for (const row of projection.foreignIntelligence.relations) {
    for (const area of row.controlledAreas) {
      const theater = theaterOf(area.areaId);
      if (theater === null) continue;
      const entry = presence.get(theater.id) ?? new Map<string, string>();
      entry.set(row.nationId, row.name);
      presence.set(theater.id, entry);
    }
  }
  const theaterBoard: TheaterEntry[] = [...new Set([...playerTheaterIds, ...presence.keys()])]
    .flatMap((id) => theaterById.get(id) ?? [])
    .map((theater) => ({
      theater,
      isPlayerTheater: playerTheaterIds.has(theater.id),
      powers: [...(presence.get(theater.id) ?? new Map<string, string>()).entries()]
        .map(([nationId, name]) => ({ nationId, name }))
        .sort((a, b) => compareText(a.name, b.name) || compareText(a.nationId, b.nationId)),
    }))
    .sort(
      (a, b) =>
        Number(b.isPlayerTheater) - Number(a.isPlayerTheater) ||
        (theaterOrder.get(a.theater.id) ?? 0) - (theaterOrder.get(b.theater.id) ?? 0),
    );

  return {
    player: {
      nationId: projection.nationId,
      name: projection.nationName,
      assessment: playerProfile === null ? null : playerProfile.diplomacy,
      theaters: playerTheaters,
    },
    month: projection.month,
    groups,
    ordered,
    posture: { byStatus, byOutlook },
    theaterBoard,
    defaultSelectionId: ordered[0]?.nationId ?? null,
  };
}

/** The ordered power list's neighbour in `step` direction, wrapping never (clamped). */
export function adjacentPowerId(
  ordered: readonly { readonly nationId: string }[],
  currentId: string | null,
  step: "next" | "previous" | "first" | "last",
): string | null {
  if (ordered.length === 0) return null;
  if (step === "first") return ordered[0]?.nationId ?? null;
  if (step === "last") return ordered[ordered.length - 1]?.nationId ?? null;
  const index = ordered.findIndex((power) => power.nationId === currentId);
  if (index < 0) return ordered[0]?.nationId ?? null;
  const target = Math.min(ordered.length - 1, Math.max(0, index + (step === "next" ? 1 : -1)));
  return ordered[target]?.nationId ?? null;
}
