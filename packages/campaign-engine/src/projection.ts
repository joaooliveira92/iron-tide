import type { CampaignState } from "@bluewave/campaign";
import {
  isPresenceExempt,
  measurePresence,
  monthId,
  type EconomyOutlookOptions,
  type EconomyStatus,
  type PresenceMeasurementRules,
  type PrestigeLastChange,
  type ResearchUnfundedReason,
} from "@bluewave/campaign";
import type { ExplanationTree } from "@bluewave/events";
import { derivePlayerFacts } from "./player-facts.js";
import { compareCodePoints } from "@bluewave/deterministic";
import {
  explainAppropriation,
  explainEconomyMonthEnd,
  explainEconomyNet,
  explainEconomyRunway,
} from "./economy-explanations.js";
import { explainPresenceShortfall } from "./fleet-explanations.js";
import { explainPrestigeChange } from "./prestige-explanations.js";

export type { EconomyStatus, ResearchUnfundedReason } from "@bluewave/campaign";

const KILOGRAMS_PER_TON = 1_000;

export interface PlayerProjectionEconomy {
  readonly treasury: number;
  readonly monthlyAppropriation: number;
  readonly shipyardCapacity: number;
  readonly constructionSpend: number;
  readonly researchSpend: number;
  readonly maintenanceCost: number;
  readonly obligations: number;
  readonly researchRequested: number;
  readonly researchCap: number;
  readonly researchUnfundedReason?: ResearchUnfundedReason;
  readonly plannedConstruction: number;
  readonly projectedNet: number;
  readonly shortfall: number;
  readonly status: EconomyStatus;
  readonly monthEndTreasury: number;
  readonly runwayMonths?: number;
  readonly netExplanation?: ExplanationTree;
  readonly monthEndExplanation?: ExplanationTree;
  readonly runwayExplanation?: ExplanationTree;
  readonly appropriationExplanation?: ExplanationTree;
}

export interface PlayerProjectionPort {
  readonly id: string;
  readonly name: string;
  readonly areaId: string;
  readonly capacity: number;
}

export interface PlayerProjectionShip {
  readonly name: string;
  readonly designId: string;
  readonly readiness: string;
  readonly crewQuality: number;
  readonly stationAssignment?: "FOREIGN_STATION" | "EXERCISE";
  readonly colonialServiceFitted?: true;
  readonly overBase?: true;
  readonly displacementTons?: number;
}

export interface PlayerProjectionDivision {
  readonly name: string;
  readonly areaId: string;
  readonly ships: readonly PlayerProjectionShip[];
}

export interface PlayerProjectionFleet {
  readonly name: string;
  readonly divisions: readonly PlayerProjectionDivision[];
}

export interface PlayerProjectionStrategicArea {
  readonly id: string;
  readonly name: string;
}

export interface PlayerProjectionPresenceArea {
  readonly areaId: string;
  readonly requiredTons: number;
  readonly presentTons: number;
  readonly shortfallTons: number;
  readonly shortfallExplanation?: ExplanationTree;
}

export type PlayerProjectionPresence =
  | { readonly configured: false }
  | {
      readonly configured: true;
      readonly exempt: boolean;
      readonly areas: readonly PlayerProjectionPresenceArea[];
    };

export interface PlayerProjectionMonth {
  readonly month: number;
  readonly year: number;
}

export interface PlayerProjectionCommandWorkspace {
  readonly commands: readonly unknown[];
  readonly movementCommands: readonly unknown[];
}

export interface PlayerProjectionPrestige {
  readonly current: number;
  readonly sackingThreshold: number;
  readonly dismissalRisk: boolean;
  readonly lastChange?: {
    readonly reasonCode: string;
    readonly before: number;
    readonly after: number;
    readonly delta: number;
    readonly month: string;
  };
  readonly changeExplanation?: ExplanationTree;
}

export interface PlayerProjectionCareer {
  readonly reason: "SACKED" | "CAMPAIGN_END";
  readonly score: number;
  readonly month: PlayerProjectionMonth;
}

export interface PlayerProjection {
  readonly campaignIdentity: string;
  readonly snapshotHash: string;
  readonly revision: number;
  readonly month: PlayerProjectionMonth;
  readonly playerNationId: string;
  readonly nationName: string;
  readonly projectedSurplusDeficit: number;
  readonly economy: PlayerProjectionEconomy;
  readonly prestige: PlayerProjectionPrestige;
  readonly career?: PlayerProjectionCareer;
  readonly fleet: readonly PlayerProjectionFleet[];
  readonly ports: readonly PlayerProjectionPort[];
  readonly knownTechnologyIds: readonly string[];
  readonly strategicAreas: readonly PlayerProjectionStrategicArea[];
  readonly knownEnemyNations: readonly string[];
  readonly presence?: PlayerProjectionPresence;
  readonly commandWorkspace: PlayerProjectionCommandWorkspace;
}

export function buildPresenceReadout(
  snapshot: Parameters<typeof measurePresence>[0] & Parameters<typeof isPresenceExempt>[0],
  nationId: string,
  month: PlayerProjectionMonth,
  presenceRules?: PresenceMeasurementRules,
): PlayerProjectionPresence {
  if (presenceRules === undefined) return { configured: false };
  const exempt = isPresenceExempt(snapshot, nationId, monthId(month.year, month.month));
  return {
    configured: true,
    exempt,
    areas: measurePresence(snapshot, presenceRules)
      .filter((row) => row.nationId === nationId)
      .map(({ areaId, requiredTons, presentTons, shortfallTons }) => ({
        areaId,
        requiredTons,
        presentTons,
        shortfallTons: exempt ? 0 : shortfallTons,
        shortfallExplanation: explainPresenceShortfall(
          requiredTons,
          presentTons,
          exempt,
          exempt ? 0 : shortfallTons,
        ),
      })),
  };
}

function buildPrestige(
  sackingThreshold: number,
  nation: { readonly prestige: number; readonly prestigeLastChange?: PrestigeLastChange },
): PlayerProjectionPrestige {
  const last = nation.prestigeLastChange;
  const changeExplanation = last === undefined ? undefined : explainPrestigeChange(last);
  return {
    current: Number(nation.prestige),
    sackingThreshold: Number(sackingThreshold),
    dismissalRisk: Number(nation.prestige) <= Number(sackingThreshold),
    ...(last === undefined
      ? {}
      : {
          lastChange: {
            reasonCode: last.reasonCode,
            before: Number(last.before),
            after: Number(last.after),
            delta: Number(last.delta),
            month: last.month,
          },
        }),
    ...(changeExplanation === undefined ? {} : { changeExplanation }),
  };
}

export function buildPlayerProjection(
  state: CampaignState,
  playerSlotId: string,
  month: PlayerProjectionMonth,
  presenceRules?: PresenceMeasurementRules,
  economy?: EconomyOutlookOptions,
): PlayerProjection | undefined {
  const snapshot = state.snapshot;
  const facts = derivePlayerFacts(snapshot, playerSlotId, economy);
  if (facts === undefined) return undefined;
  const { nation, outlook, ports, shipyardCapacity, constructionCommitted } = facts;

  const fleet: PlayerProjectionFleet[] = facts.fleets.map(({ fleet: f, ships }) => ({
    name: f.name,
    divisions: [
      {
        name: f.name,
        areaId: f.locationAreaId,
        ships: ships.map(({ ship, design }) => {
          return {
            name: ship.name,
            designId: ship.designVersionId,
            readiness: ship.readiness,
            crewQuality: Number(ship.crewQuality),
            ...(ship.stationAssignment === undefined
              ? {}
              : { stationAssignment: ship.stationAssignment }),
            ...(ship.colonialServiceFitted === true
              ? { colonialServiceFitted: true as const }
              : {}),
            ...(ship.overBase === undefined ? {} : { overBase: true as const }),
            ...(design === undefined
              ? {}
              : {
                  displacementTons: Math.round(
                    Number(design.normalizedDisplacementKg) / KILOGRAMS_PER_TON,
                  ),
                }),
          };
        }),
      },
    ],
  }));

  const strategicAreas: PlayerProjectionStrategicArea[] = snapshot.world.areas
    .filter((area) => area.controller === playerSlotId)
    .map((area) => ({ id: area.id, name: area.name }))
    .sort((a, b) => compareCodePoints(a.id, b.id));

  const knownEnemyNations = [
    ...new Set(
      snapshot.politics.relations
        .filter(
          (relation) =>
            relation.relation === "at_war" &&
            (relation.nationA === playerSlotId || relation.nationB === playerSlotId),
        )
        .map((relation) =>
          relation.nationA === playerSlotId ? relation.nationB : relation.nationA,
        ),
    ),
  ].sort((a, b) => compareCodePoints(a, b));

  return {
    campaignIdentity: snapshot.campaignId,
    snapshotHash: state.rawHash,
    revision: Number(snapshot.turnNumber),
    month,
    playerNationId: playerSlotId,
    nationName: nation.name,
    projectedSurplusDeficit: outlook.projectedNet,
    economy: {
      treasury: Number(nation.treasury),
      monthlyAppropriation: outlook.revenue,
      shipyardCapacity,
      constructionSpend: constructionCommitted,
      researchSpend: outlook.plannedResearch,
      maintenanceCost: outlook.maintenance,
      obligations: outlook.obligations,
      researchRequested: outlook.researchRequested,
      researchCap: outlook.researchCap,
      ...(outlook.researchUnfundedReason === undefined
        ? {}
        : { researchUnfundedReason: outlook.researchUnfundedReason }),
      plannedConstruction: outlook.plannedConstruction,
      projectedNet: outlook.projectedNet,
      shortfall: outlook.shortfall,
      status: outlook.status,
      monthEndTreasury: outlook.monthEndTreasury,
      ...(outlook.runwayMonths === undefined ? {} : { runwayMonths: outlook.runwayMonths }),
      netExplanation: explainEconomyNet(outlook),
      monthEndExplanation: explainEconomyMonthEnd(outlook, Number(nation.treasury)),
      ...(outlook.runwayMonths === undefined
        ? {}
        : { runwayExplanation: explainEconomyRunway(outlook, Number(nation.treasury)) }),
      appropriationExplanation: explainAppropriation(
        Number(nation.baseResources),
        Number(nation.navalAppropriationRateBp),
        outlook.revenue,
      ),
    },
    prestige: buildPrestige(snapshot.prestigeRules.sackingThreshold, nation),
    ...(snapshot.careerResult === undefined
      ? {}
      : {
          career: {
            reason: snapshot.careerResult.reason,
            score: Number(snapshot.careerResult.score),
            month: {
              year: Number(snapshot.careerResult.month.year),
              month: Number(snapshot.careerResult.month.month),
            },
          },
        }),
    fleet,
    ports,
    knownTechnologyIds: [...nation.research.discoveredTechs].sort((a, b) =>
      compareCodePoints(a, b),
    ),
    strategicAreas,
    knownEnemyNations,
    presence: buildPresenceReadout(snapshot, playerSlotId, month, presenceRules),
    commandWorkspace: { commands: [], movementCommands: [] },
  };
}
