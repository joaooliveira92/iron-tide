// packages/campaign/src/nationCompilation.ts
// Campaign-compile stage: materialize nation aggregates (identity, economy,
// fleets/ships, research, construction projects, officer roster) plus the
// playable/AI slot list, from the content pack + authored campaign files.
import type { ContentPack } from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { toSafeIntOpt, toStr } from "./campaignInput.js";
import { buildOfficerRoster } from "./officers.js";
import type {
  CampaignSlot,
  ConstructionProject,
  FleetState,
  NationState,
  ResearchState,
  Ship,
  TechnologyProgress,
} from "./state.js";

function isNationPlayable(
  id: string,
  countryRec: Record<string, unknown>,
  collector: DiagnosticCollector,
): boolean {
  const flag = countryRec["isPlayable"];
  if (typeof flag !== "boolean") {
    collector.addError(
      "CAMPAIGN-ISPLAYABLE",
      `Nation '${id}' is missing the required isPlayable flag`,
      { stage: "campaign-compile", entityId: id },
    );
    return false;
  }
  return flag;
}

function buildShips(fleet: Record<string, unknown>): Ship[] {
  const shipsRaw = fleet["ships"];
  if (!Array.isArray(shipsRaw)) return [];
  const nationId = toStr(fleet["nationId"], "");
  const locationAreaId = toStr(fleet["locationAreaId"], "");

  return shipsRaw
    .map((s: Record<string, unknown>) => ({
      id: toStr(s["id"], ""),
      name: toStr(s["name"], ""),
      classId: toStr(s["classId"], ""),
      nationId,
      locationAreaId,
      designVersionId: toStr(s["designVersionId"], ""),
      hitPoints: toSafeIntOpt(s["hitPoints"], SafeInt(100)),
      maxHitPoints: toSafeIntOpt(s["maxHitPoints"], SafeInt(100)),
      speed: toSafeIntOpt(s["speed"], SafeInt(10)),
      firepower: toSafeIntOpt(s["firepower"], SafeInt(10)),
      armor: toSafeIntOpt(s["armor"], SafeInt(10)),
      isUnderConstruction: s["isUnderConstruction"] === true,
      constructionProgress: toSafeIntOpt(s["constructionProgress"], SafeInt(0)),
      constructionTotalWork: toSafeIntOpt(s["constructionTotalWork"], SafeInt(0)),
      inBattleId: typeof s["inBattleId"] === "string" ? s["inBattleId"] : undefined,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildFleets(fleetsData: unknown[], nationId: string): FleetState[] {
  return fleetsData
    .filter((f) => (f as Record<string, unknown>)["nationId"] === nationId)
    .map((f) => {
      const fRec = f as Record<string, unknown>;
      return {
        id: toStr(fRec["id"], ""),
        nationId: toStr(fRec["nationId"], ""),
        name: toStr(fRec["name"], ""),
        locationAreaId: toStr(fRec["locationAreaId"], ""),
        ships: buildShips(fRec),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function buildResearch(researchData: unknown[], nationId: string): ResearchState {
  const nationResearch = researchData.find(
    (r) => (r as Record<string, unknown>)["nationId"] === nationId,
  ) as Record<string, unknown> | undefined;

  if (!nationResearch)
    return {
      nationId,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    };

  const techs: TechnologyProgress[] = [];
  const techsRaw = nationResearch["technologies"];
  if (Array.isArray(techsRaw)) {
    for (const t of techsRaw) {
      const tRec = t as Record<string, unknown>;
      techs.push({
        techId: toStr(tRec["techId"], ""),
        investedPoints: toSafeIntOpt(tRec["investedPoints"], SafeInt(0)),
        completed: tRec["completed"] === true,
      });
    }
  }

  const fieldPriorities: Record<string, SafeInt> = {};
  const fieldPrioritiesRaw = nationResearch["fieldPriorities"];
  if (fieldPrioritiesRaw && typeof fieldPrioritiesRaw === "object") {
    for (const [key, val] of Object.entries(fieldPrioritiesRaw as Record<string, unknown>)) {
      fieldPriorities[key] = toSafeIntOpt(val, SafeInt(1));
    }
  }

  const activeCandidatesRaw = nationResearch["activeCandidates"];
  const activeCandidates = new Map<string, string>();
  if (activeCandidatesRaw && typeof activeCandidatesRaw === "object") {
    for (const [key, val] of Object.entries(activeCandidatesRaw as Record<string, unknown>)) {
      if (typeof val === "string") {
        activeCandidates.set(key, val);
      }
    }
  }

  const discoveredTechsRaw = nationResearch["discoveredTechs"];
  const discoveredTechs: string[] = [];
  if (Array.isArray(discoveredTechsRaw)) {
    for (const t of discoveredTechsRaw) {
      discoveredTechs.push(toStr(t));
    }
  }

  return {
    nationId,
    technologies: techs,
    currentProjectTechId:
      typeof nationResearch["currentProjectTechId"] === "string"
        ? nationResearch["currentProjectTechId"]
        : undefined,
    fieldPriorities,
    researchBudget: toSafeIntOpt(nationResearch["researchBudget"], SafeInt(0)),
    activeCandidates,
    discoveredTechs,
  };
}

function buildConstructions(constructionsData: unknown[], nationId: string): ConstructionProject[] {
  return constructionsData
    .filter((c) => (c as Record<string, unknown>)["nationId"] === nationId)
    .map((c) => {
      const cRec = c as Record<string, unknown>;
      return {
        id: toStr(cRec["id"], ""),
        type: (cRec["type"] as "ship" | "building" | "technology") ?? "ship",
        projectType: "NEW_CONSTRUCTION" as const,
        targetId: toStr(cRec["targetId"], ""),
        designVersionId: toStr(cRec["designVersionId"], ""),
        totalWork: toSafeIntOpt(cRec["totalWork"], SafeInt(100)),
        completedWork: toSafeIntOpt(cRec["completedWork"], SafeInt(0)),
        paidWork: toSafeIntOpt(cRec["paidWork"], SafeInt(0)),
        status: (cRec["status"] as "PLANNED" | "AUTHORIZED" | "ACTIVE" | "COMPLETED") ?? "PLANNED",
        startedAt: toStr(cRec["startedAt"], "1880-01"),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function buildNationStates(
  pack: ContentPack,
  fleetsData: unknown[],
  economiesData: unknown[],
  constructionsData: unknown[],
  researchData: unknown[],
  collector: DiagnosticCollector,
): Map<string, NationState> | undefined {
  const nations = new Map<string, NationState>();

  // sort nations by canonical id for deterministic Map insertion / rawHash
  const sortedNations = [...(pack.nations ?? [])].sort((a, b) => {
    const aId = toStr((a as Record<string, unknown>)["id"], "");
    const bId = toStr((b as Record<string, unknown>)["id"], "");
    return aId.localeCompare(bId);
  });

  for (const nation of sortedNations) {
    const countryRec = nation as Record<string, unknown>;
    const id = toStr(countryRec["id"], "");

    const isPlayable = isNationPlayable(id, countryRec, collector);

    const fleets = buildFleets(fleetsData, id);
    const research = buildResearch(researchData, id);
    const constructions = buildConstructions(constructionsData, id);

    let treasury = SafeInt(500);
    let income = SafeInt(100);
    let expenses = SafeInt(50);

    for (const eco of economiesData) {
      const ecoRec = eco as Record<string, unknown>;
      if (ecoRec["nationId"] === id) {
        treasury = toSafeIntOpt(ecoRec["treasury"], SafeInt(500));
        income = toSafeIntOpt(ecoRec["income"], SafeInt(100));
        expenses = toSafeIntOpt(ecoRec["expenses"], SafeInt(50));
      }
    }

    nations.set(id, {
      id,
      name: toStr(countryRec["name"], ""),
      tag: toStr(countryRec["tag"], ""),
      treasury,
      income,
      expenses,
      baseResources: SafeInt(0),
      navalAppropriationRateBp: SafeInt(2000),
      maintenanceCost: SafeInt(0),
      fleets,
      divisions: [],
      officers: buildOfficerRoster(id),
      research,
      constructionProjects: constructions,
      isPlayable,
      isAI: !isPlayable,
    });
  }

  if (nations.size === 0) {
    collector.addError("CAMPAIGN", "No nations found in content pack", {
      stage: "campaign-compile",
    });
    return undefined;
  }

  return nations;
}

export function buildSlots(nations: Map<string, NationState>): CampaignSlot[] {
  const slots: CampaignSlot[] = [];
  for (const [id, nation] of nations) {
    slots.push({ nationId: id, type: nation.isPlayable ? "playable" : "ai" });
  }
  // deterministic: alphabetical nationId order regardless of file insertion order
  slots.sort((a, b) => a.nationId.localeCompare(b.nationId));
  return slots;
}
