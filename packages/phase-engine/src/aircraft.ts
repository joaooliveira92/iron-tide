import type { CampaignSnapshot, NationState } from "@bluewave/campaign";
import type { AircraftNationState } from "@bluewave/combat";
import {
  advanceAircraftDevelopment,
  computeDevelopmentProjectHash,
  expirePrivateProposals,
  resolvePrivateVenture,
  compareDevelopmentProjects,
  compareProposals,
  compareSquadrons,
  compareBasingSlots,
  createAircraftRecord,
  type AircraftRecord,
} from "@bluewave/combat";
import type { RandomStream } from "@bluewave/random";
import type { PhaseDescriptor } from "./registry.js";
import { PhaseResource } from "./phase-resource.js";

export interface AircraftDevelopmentPhaseInput {
  snapshot: CampaignSnapshot;
  campaignMonth: string;
  rngStream: RandomStream;
}

export interface AircraftDevelopmentPhaseOutput {
  snapshot: CampaignSnapshot;
  records: AircraftRecord[];
}

function getAircraft(nation: NationState): AircraftNationState {
  const stored = (nation["aircraft"] ?? {}) as unknown;
  if (typeof stored === "object" && stored !== null) {
    return stored as AircraftNationState;
  }
  return {
    models: {},
    inventory: {},
    developmentProjects: [],
    proposals: [],
    privateProposals: [],
    squadrons: [],
    basingAllocations: [],
    rulesetVersion: "aircraft_ruleset_v1",
    stateHash: "",
  };
}

function hasAviationTech(nation: NationState): boolean {
  const r = nation["research"];
  return (
    r["discoveredTechs"]?.some(
      (t: string) =>
        t === "early_aviation" || t === "aviation" || t === "flight" || t === "basic_aviation",
    ) ?? false
  );
}

function processAircraftNation(
  nation: NationState,
  nationId: string,
  campaignMonth: string,
  rngStream: RandomStream,
): { updatedNation: NationState; records: AircraftRecord[] } {
  const records: AircraftRecord[] = [];
  const aircraft = getAircraft(nation);

  if (!hasAviationTech(nation) && !aircraft.models && !aircraft.developmentProjects?.length) {
    return { updatedNation: nation, records };
  }

  let updatedProjects = [...(aircraft.developmentProjects ?? [])];
  let updatedProposals = [...(aircraft.proposals ?? [])];

  const hasAviation = hasAviationTech(nation);
  const currentIncome = nation["treasury"];

  if (hasAviation && aircraft.developmentProjects?.length) {
    updatedProjects = aircraft.developmentProjects.map((project) => {
      const canPay = currentIncome >= project.monthlyCost;
      const advanced = advanceAircraftDevelopment(project, canPay);
      return { ...advanced, projectHash: computeDevelopmentProjectHash(advanced) };
    });
  }

  for (const project of updatedProjects.filter((p) => p.status === "READY_FOR_REVIEW")) {
    records.push(
      createAircraftRecord({
        recordId: `aircraft_dev_${project.developmentProjectId}_${campaignMonth}`,
        nationId,
        kind: "DEVELOPMENT_COMPLETE",
        entityId: project.developmentProjectId,
        operation: "development_complete",
        inputHash: project.projectHash,
        outputHash: project.projectHash,
        campaignMonth,
        reasonCode: "DEVELOPMENT_COMPLETE",
        rulesetVersion: "aircraft_ruleset_v1",
      }),
    );
  }

  const expired = expirePrivateProposals(aircraft.privateProposals ?? [], campaignMonth);
  let updatedPrivateProposals = [...expired];

  if (hasAviation) {
    const pvResult = resolvePrivateVenture({
      nationId,
      currentMonth: campaignMonth,
      hasPrivateAviationIndustry: true,
      permittedRoles: [
        "FIGHTER",
        "TORPEDO_BOMBER",
        "DIVE_BOMBER",
        "MEDIUM_BOMBER",
        "PATROL_AIRCRAFT",
        "FLOATPLANE_SCOUT",
      ] as const,
      hasNationalProhibition: false,
      lastVentureMonth: null,
      privateProposals: updatedPrivateProposals,
      rngStream,
    });
    if (pvResult.newProposal) {
      updatedPrivateProposals = [...updatedPrivateProposals, pvResult.newProposal];
    }
  }

  updatedProjects = [...updatedProjects].sort(compareDevelopmentProjects);
  updatedProposals = [...updatedProposals].sort(compareProposals);
  updatedPrivateProposals = [...updatedPrivateProposals].sort(compareProposals);

  const sortedSquadrons = [...(aircraft.squadrons ?? [])].sort(compareSquadrons);
  const sortedBasing = [...(aircraft.basingAllocations ?? [])].sort(compareBasingSlots);

  const updatedAircraft: AircraftNationState = {
    ...aircraft,
    developmentProjects: updatedProjects,
    proposals: updatedProposals,
    privateProposals: updatedPrivateProposals,
    squadrons: sortedSquadrons,
    basingAllocations: sortedBasing,
  };

  const updatedNation: NationState = {
    ...nation,
    aircraft: updatedAircraft as unknown as Record<string, unknown>,
  } as NationState;

  return { updatedNation, records };
}

export function resolveAircraftDevelopment(
  input: AircraftDevelopmentPhaseInput,
): AircraftDevelopmentPhaseOutput {
  const { snapshot, campaignMonth, rngStream } = input;
  const records: AircraftRecord[] = [];
  const updatedNations = new Map<string, NationState>();

  const hasAnyAviation = [...snapshot["nations"].values()].some((n) => hasAviationTech(n));
  if (!hasAnyAviation) {
    return { snapshot, records: [] };
  }

  for (const [nationId, nation] of snapshot["nations"]) {
    if (!nation["isPlayable"] && !nation["isAI"]) {
      updatedNations.set(nationId, nation);
      continue;
    }
    const result = processAircraftNation(nation, nationId, campaignMonth, rngStream);
    updatedNations.set(nationId, result.updatedNation);
    records.push(...result.records);
  }

  return {
    snapshot: { ...snapshot, nations: updatedNations },
    records,
  };
}

export const aircraftDevelopmentPhase: PhaseDescriptor = {
  id: "resolve_aircraft_development",
  name: "Aircraft Development Resolution",
  order: 72,
  readPermissions: ["nations", "treasury", "research"],
  writePermissions: ["nations"],
  rngAllowed: true,
  footprint: {
    reads: [PhaseResource.NATIONS, PhaseResource.TREASURY, PhaseResource.RESEARCH],
    writes: [PhaseResource.NATIONS],
    usesRng: true,
  },
  run: (ctx) => {
    const aircraftRng = ctx.phaseGuard.rng("resolve_aircraft_development", ctx.randomSeed);
    if (aircraftRng) {
      const result = resolveAircraftDevelopment({
        snapshot: ctx.currentSnapshot,
        campaignMonth: ctx.campaignMonth,
        rngStream: aircraftRng.stream("aircraft/development"),
      });
      ctx.currentSnapshot = result.snapshot;
    }
    return { status: "continue" };
  },
};
