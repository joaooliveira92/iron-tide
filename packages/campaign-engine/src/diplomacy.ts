import type { CampaignState } from "@bluewave/campaign";
import type { PlayerProjectionMonth } from "./projection.js";

/**
 * Diplomacy & War screen projection (desktop-diplomacy-war INC-1). Every
 * field is a pure, deterministic derivation over the compiled
 * `CampaignSnapshot`'s `politics.relations`, `wars.wars`/`wars.blockadeState`
 * and `world.areas` for the player nation (spec D4 — one-to-one, nothing
 * fabricated, no session state, no I/O, no randomness), so the desktop bridge
 * can rebuild the same `DiplomacyScreenProjection` from the exact same
 * immutable snapshot on every `inspectDiplomacyScreen` call.
 *
 * - `knownNations` — every OTHER nation (id + name), sorted by id.
 * - `relations`    — every `DiplomaticRelation` pair that involves the player,
 *   with the derived player-facing view (`partnerNationId`/`partnerName`),
 *   sorted by partner id for deterministic rendering.
 * - `wars`         — every `WarDeclaration` the player is a member of on
 *   either side, tagged with `playerSide`, sorted by `warId`.
 * - `blockades`    — every `BlockadeState` entry where the player is the
 *   blockader or the blockaded nation.
 * - `areas`        — the world's strategic areas (id + name) so the screen can
 *   offer a real `DeclareBlockade` area picker (the engine requires a
 *   non-empty `areaId`); nothing fabricated, derived from `world.areas`.
 *
 * Returns `undefined` when `playerSlotId` doesn't resolve to a nation — the
 * same convention as `buildPlayerProjection`/`buildResearchScreenProjection`;
 * the desktop handler turns that into a stable `UNKNOWN_PLAYER_SLOT` error
 * result.
 */
export type DiplomacyRelationKind = "neutral" | "allied" | "at_war" | "trade_agreement";

export type DiplomacyWarStatus = "DECLARED_NOT_ACTIVE" | "ACTIVE" | "ENDED";

/**
 * Qualitative tension taxonomy (DESIGN/first-month charting, ticket 11).
 * The engine's real tension is a 0..10 integer (campaign compiler validates
 * the authored range as 0..10; `@bluewave/campaign` exports `TENSION_PEACE =
 * 5` and `TENSION_WAR = 10`). This ticket owns the ONE engine-side mapping
 * from that numeric tension to a qualitative label and the ONE "high tension"
 * threshold, so the Foreign Relations page and the Immediate Priorities
 * engine share a single interpretation instead of each re-deriving it
 * (the diagnosis doc §7.4/§13.3 explicitly forbids renderer-invented
 * thresholds). Pure, deterministic, no React/Electron dependency.
 */
export type TensionLabel = "cordial" | "neutral" | "strained" | "hostile" | "war_imminent";

export const TENSION_LABELS: readonly TensionLabel[] = [
  "cordial",
  "neutral",
  "strained",
  "hostile",
  "war_imminent",
] as const;

/** Entering `hostile` (>= 8) counts as "high foreign tension" for the
 * priority engine's `high_foreign_tension` trigger and for Foreign Relations'
 * warning treatment. Well short of `TENSION_WAR` (10), so it flags a
 * deteriorating relationship before war-imminent. */
export const HIGH_TENSION_THRESHOLD = 8;

/** Band lower bounds, checked high-to-low, over the real 0..10 tension scale:
 * 10+ war_imminent, 8+ hostile, 6+ strained, 3+ neutral, <3 cordial. */
export const TENSION_LABEL_BANDS: readonly {
  readonly label: TensionLabel;
  readonly min: number;
}[] = [
  { label: "war_imminent", min: 10 },
  { label: "hostile", min: 8 },
  { label: "strained", min: 6 },
  { label: "neutral", min: 3 },
  { label: "cordial", min: 0 },
];

/** The qualitative label for a numeric tension score (0..10). */
export function tensionLabel(tension: number): TensionLabel {
  for (const band of TENSION_LABEL_BANDS) {
    if (tension >= band.min) return band.label;
  }
  return "cordial";
}

/** True when a tension score reaches the "high foreign tension" threshold. */
export function isHighTension(tension: number): boolean {
  return tension >= HIGH_TENSION_THRESHOLD;
}

export interface DiplomacyKnownNation {
  readonly nationId: string;
  readonly name: string;
}

/** One `DiplomaticRelation` pair involving the player, with the player-facing
 * view derived: `partnerNationId`/`partnerName` are the OTHER side. */
export interface DiplomacyRelationRow {
  readonly nationAId: string;
  readonly nationBId: string;
  readonly relation: DiplomacyRelationKind;
  readonly tension: number;
  readonly nap: boolean;
  readonly since: string;
  readonly partnerNationId: string;
  readonly partnerName: string;
}

/** One `WarDeclaration` the player is a member of on either side. */
export interface DiplomacyWarRow {
  readonly warId: string;
  readonly attackerSideId: string;
  readonly defenderSideId: string;
  readonly attackerSideMembers: readonly string[];
  readonly defenderSideMembers: readonly string[];
  readonly attackerWarScore: number;
  readonly defenderWarScore: number;
  readonly attackerId: string;
  readonly defenderId: string;
  readonly startDate: string;
  readonly status: DiplomacyWarStatus;
  readonly endDate?: string;
  readonly playerSide: "attacker" | "defender";
}

/** One `BlockadeState` entry involving the player. */
export interface DiplomacyBlockadeRow {
  readonly blockaderId: string;
  readonly blockadedNationId: string;
  readonly areaId: string;
  readonly establishedMonth: string;
}

export interface DiplomacyAreaRow {
  readonly areaId: string;
  readonly name: string;
}

/** The Diplomacy & War screen's slice of the compiled snapshot. */
export interface DiplomacyScreenProjection {
  readonly playerNationId: string;
  readonly knownNations: readonly DiplomacyKnownNation[];
  readonly relations: readonly DiplomacyRelationRow[];
  readonly wars: readonly DiplomacyWarRow[];
  readonly blockades: readonly DiplomacyBlockadeRow[];
  readonly areas: readonly DiplomacyAreaRow[];
}

export function buildDiplomacyScreenProjection(
  state: CampaignState,
  playerSlotId: string,
  _month: PlayerProjectionMonth,
): DiplomacyScreenProjection | undefined {
  const nation = state.snapshot.nations.get(playerSlotId);
  if (nation === undefined) return undefined;

  const snapshot = state.snapshot;
  const nameFor = (nationId: string): string => snapshot.nations.get(nationId)?.name ?? nationId;

  const knownNations: DiplomacyKnownNation[] = [...snapshot.nations.keys()]
    .filter((nationId) => nationId !== playerSlotId)
    .sort((a, b) => a.localeCompare(b))
    .map((nationId) => ({ nationId, name: nameFor(nationId) }));

  const relations: DiplomacyRelationRow[] = snapshot.politics.relations
    .filter((r) => r.nationA === playerSlotId || r.nationB === playerSlotId)
    .map((r) => {
      const partnerNationId = r.nationA === playerSlotId ? r.nationB : r.nationA;
      return {
        nationAId: r.nationA,
        nationBId: r.nationB,
        relation: r.relation,
        tension: r.tension,
        nap: r.nap,
        since: r.since,
        partnerNationId,
        partnerName: nameFor(partnerNationId),
      };
    })
    .sort((a, b) => a.partnerNationId.localeCompare(b.partnerNationId));

  const wars: DiplomacyWarRow[] = snapshot.wars.wars
    .filter(
      (w) =>
        w.attackerSideMembers.includes(playerSlotId) ||
        w.defenderSideMembers.includes(playerSlotId),
    )
    .map((w) => ({
      warId: w.id,
      attackerSideId: w.attackerSideId,
      defenderSideId: w.defenderSideId,
      attackerSideMembers: [...w.attackerSideMembers],
      defenderSideMembers: [...w.defenderSideMembers],
      attackerWarScore: w.attackerWarScore,
      defenderWarScore: w.defenderWarScore,
      attackerId: w.attackerId,
      defenderId: w.defenderId,
      startDate: w.startDate,
      status: w.status,
      ...(w.endDate !== undefined ? { endDate: w.endDate } : {}),
      playerSide: w.attackerSideMembers.includes(playerSlotId)
        ? ("attacker" as const)
        : ("defender" as const),
    }))
    .sort((a, b) => a.warId.localeCompare(b.warId));

  const blockades: DiplomacyBlockadeRow[] = snapshot.wars.blockadeState
    .filter((b) => b.blockaderId === playerSlotId || b.blockadedNationId === playerSlotId)
    .map((b) => ({
      blockaderId: b.blockaderId,
      blockadedNationId: b.blockadedNationId,
      areaId: b.areaId,
      establishedMonth: b.establishedMonth,
    }))
    .sort((a, b) =>
      `${a.blockaderId}\u0000${a.blockadedNationId}\u0000${a.areaId}`.localeCompare(
        `${b.blockaderId}\u0000${b.blockadedNationId}\u0000${b.areaId}`,
      ),
    );

  const areas: DiplomacyAreaRow[] = [...snapshot.world.areas]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((area) => ({ areaId: area.id, name: area.name }));

  return {
    playerNationId: playerSlotId,
    knownNations,
    relations,
    wars,
    blockades,
    areas,
  };
}
