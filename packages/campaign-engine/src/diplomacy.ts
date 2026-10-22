import type { CampaignState } from "@bluewave/campaign";
import type { PlayerProjectionMonth } from "./projection.js";

export type DiplomacyRelationKind = "neutral" | "allied" | "at_war" | "trade_agreement";

export type DiplomacyWarStatus = "DECLARED_NOT_ACTIVE" | "ACTIVE" | "ENDED";

export type TensionLabel = "cordial" | "neutral" | "strained" | "hostile" | "war_imminent";

export const TENSION_LABELS: readonly TensionLabel[] = [
  "cordial",
  "neutral",
  "strained",
  "hostile",
  "war_imminent",
] as const;

export const HIGH_TENSION_THRESHOLD = 8;

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

export function tensionLabel(tension: number): TensionLabel {
  for (const band of TENSION_LABEL_BANDS) {
    if (tension >= band.min) return band.label;
  }
  return "cordial";
}

export function isHighTension(tension: number): boolean {
  return tension >= HIGH_TENSION_THRESHOLD;
}

export interface DiplomacyKnownNation {
  readonly nationId: string;
  readonly name: string;
}

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
