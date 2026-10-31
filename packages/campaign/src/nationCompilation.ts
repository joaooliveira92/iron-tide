import { compareCodePoints } from "@bluewave/deterministic";
import type {
  CampaignConstruction,
  CampaignDivision,
  CampaignEconomy,
  CampaignFleet,
  CampaignResearch,
  ContentPack,
  Nation,
} from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { Option, Result } from "effect";
import { buildSeededDivisions } from "./divisions.js";
import {
  incomeFitsEconomicBase,
  START_APPROPRIATION_RATE_BP,
  deriveEconomicBase,
  monthlyNetBeforeConstruction,
  monthlyResearchSpend,
  monthlyRevenue,
  researchCap,
  runwayMonths,
} from "./economy.js";
import { nationMonthlyMaintenance } from "./maintenance.js";
import { buildOfficerRoster } from "./officers.js";
import {
  PRESTIGE_COMPILE_CODES,
  resolveNationPrestige,
  type PrestigeValueSet,
} from "./prestige.js";
import { resolveShipReadinessSeed } from "./readiness.js";
import type {
  CampaignSlot,
  ConstructionProject,
  FleetState,
  NationState,
  ResearchState,
  Ship,
  TechnologyProgress,
} from "./state.js";

function readNationPrestige(
  nationId: string,
  authored: unknown,
  prestigeRules: PrestigeValueSet,
  collector: DiagnosticCollector,
): Option.Option<SafeInt> {
  const resolved = resolveNationPrestige(authored, prestigeRules);
  if (Result.isSuccess(resolved)) return Option.some(resolved.success);
  const error = resolved.failure;
  const raise = (
    code: (typeof PRESTIGE_COMPILE_CODES)[keyof typeof PRESTIGE_COMPILE_CODES],
    message: string,
  ) => {
    collector.addError(code, message, { stage: "campaign-compile", entityId: nationId });
  };
  switch (error._tag) {
    case "PrestigeMissing":
      raise(
        PRESTIGE_COMPILE_CODES.missing,
        `Nation '${nationId}' has no authored prestige; it is required and has no default`,
      );
      break;
    case "PrestigeNotInteger":
      raise(PRESTIGE_COMPILE_CODES.notInteger, `Nation '${nationId}' prestige must be an integer`);
      break;
    case "PrestigeUnsafeInteger":
      raise(
        PRESTIGE_COMPILE_CODES.unsafeInteger,
        `Nation '${nationId}' prestige must be a safe integer`,
      );
      break;
    case "PrestigeOutOfRange":
      raise(
        PRESTIGE_COMPILE_CODES.outOfRange,
        `Nation '${nationId}' prestige ${String(error.value)} is outside the ruleset bounds ${String(error.lowerBound)} to ${String(error.upperBound)}`,
      );
      break;
    default: {
      const unhandled: never = error;
      return unhandled;
    }
  }
  return Option.none();
}

interface EconomyRow {
  valid: boolean;
  treasury: SafeInt;
  income: SafeInt;
  expenses: SafeInt;
}

function readEconomyRow(
  economiesData: readonly CampaignEconomy[],
  nationId: string,
  collector: DiagnosticCollector,
): EconomyRow {
  const row = economiesData.find((e) => e.nationId === nationId);
  const none = { treasury: SafeInt(0), income: SafeInt(0), expenses: SafeInt(0), valid: false };
  if (row === undefined) {
    collector.addError("ECONOMY_ROW_MISSING", `Nation '${nationId}' has no economy row`, {
      stage: "campaign-compile",
      entityId: nationId,
    });
    return none;
  }
  const valid = (v: number, min: number): boolean => Number.isSafeInteger(v) && v >= min;
  if (!(valid(row.treasury, 0) && valid(row.income, 1) && valid(row.expenses, 0))) {
    collector.addError(
      "ECONOMY_VALUE_INVALID",
      `Nation '${nationId}' economy needs integer treasury >= 0, income > 0 and expenses >= 0`,
      { stage: "campaign-compile", entityId: nationId },
    );
    return none;
  }
  return {
    treasury: SafeInt(row.treasury),
    income: SafeInt(row.income),
    expenses: SafeInt(row.expenses),
    valid: true,
  };
}

export function checkStartRevenue(
  nationId: string,
  base: SafeInt,
  startRate: SafeInt,
  collector: DiagnosticCollector,
): void {
  if (monthlyRevenue(base, startRate) > 0) return;
  collector.addError(
    "ZERO_MONTHLY_REVENUE",
    `Nation '${nationId}' derives zero monthly revenue (base ${String(base)}, start rate ${String(startRate)} bp)`,
    {
      stage: "campaign-compile",
      entityId: nationId,
      remediation:
        "Raise the authored income or the start appropriation rate so revenue is at least 1 treasury unit.",
    },
  );
}

function buildShips(fleet: CampaignFleet, collector: DiagnosticCollector): Ship[] {
  const ships: Ship[] = [];
  for (const record of fleet.ships) {
    const seed = resolveShipReadinessSeed(record, record.id);
    if (Result.isFailure(seed)) {
      collector.add(seed.failure.toDiagnostic());
      continue;
    }
    ships.push({
      id: record.id,
      name: record.name,
      classId: record.classId,
      nationId: fleet.nationId,
      locationAreaId: fleet.locationAreaId,
      designVersionId: record.designVersionId ?? "",
      hitPoints: SafeInt(record.hitPoints),
      maxHitPoints: SafeInt(record.maxHitPoints),
      speed: SafeInt(record.speed),
      firepower: SafeInt(record.firepower),
      armor: SafeInt(record.armor),
      isUnderConstruction: record.isUnderConstruction,
      constructionProgress: SafeInt(record.constructionProgress),
      constructionTotalWork: SafeInt(record.constructionTotalWork),
      readiness: seed.success.readiness,
      crewQuality: seed.success.crewQuality,
      repairMonthsRemaining: seed.success.repairMonthsRemaining,
      inBattleId: record.inBattleId,
    });
  }
  return ships.sort((a, b) => compareCodePoints(a.id, b.id));
}

function buildFleets(
  fleetsData: readonly CampaignFleet[],
  nationId: string,
  collector: DiagnosticCollector,
): FleetState[] {
  return fleetsData
    .filter((f) => f.nationId === nationId)
    .map((f) => ({
      id: f.id,
      nationId: f.nationId,
      name: f.name,
      locationAreaId: f.locationAreaId,
      ships: buildShips(f, collector),
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id));
}

function buildResearch(researchData: readonly CampaignResearch[], nationId: string): ResearchState {
  const nationResearch = researchData.find((r) => r.nationId === nationId);

  if (nationResearch === undefined)
    return {
      nationId,
      technologies: [],
      fieldPriorities: {},
      researchBudget: SafeInt(0),
      activeCandidates: new Map(),
      discoveredTechs: [],
    };

  const techs: TechnologyProgress[] = nationResearch.technologies.map((t) => ({
    techId: t.techId,
    investedPoints: SafeInt(t.investedPoints),
    completed: t.completed,
  }));

  const fieldPriorities: Record<string, SafeInt> = {};
  for (const [key, val] of Object.entries(nationResearch.fieldPriorities ?? {})) {
    fieldPriorities[key] = SafeInt(val ?? 1);
  }

  const activeCandidates = new Map(Object.entries(nationResearch.activeCandidates ?? {}));
  const discoveredTechs = [...(nationResearch.discoveredTechs ?? [])];

  return {
    nationId,
    technologies: techs,
    currentProjectTechId: nationResearch.currentProjectTechId,
    fieldPriorities,
    researchBudget: SafeInt(nationResearch.researchBudget),
    activeCandidates,
    discoveredTechs,
  };
}

function buildConstructions(
  constructionsData: readonly CampaignConstruction[],
  nationId: string,
): ConstructionProject[] {
  return constructionsData
    .filter((c) => c.nationId === nationId)
    .map((c) => ({
      id: c.id,
      type: c.type,
      projectType: "NEW_CONSTRUCTION" as const,
      targetId: c.targetId,
      designVersionId: c.designVersionId ?? "",
      totalWork: SafeInt(c.totalWork),
      completedWork: SafeInt(c.completedWork),
      paidWork: SafeInt(c.paidWork),
      status: c.status,
      startedAt: c.startedAt,
    }))
    .sort((a, b) => compareCodePoints(a.id, b.id));
}

export function buildNationStates(
  pack: ContentPack,
  fleetsData: readonly CampaignFleet[],
  economiesData: readonly CampaignEconomy[],
  constructionsData: readonly CampaignConstruction[],
  researchData: readonly CampaignResearch[],
  divisionsData: readonly CampaignDivision[],
  rulesetVersion: string,
  creationMonth: string,
  prestigeRules: PrestigeValueSet,
  collector: DiagnosticCollector,
): Map<string, NationState> | undefined {
  const nations = new Map<string, NationState>();
  let structuralDeficits = 0;

  const sortedNations: readonly Nation[] = [...pack.nations].sort((a, b) =>
    compareCodePoints(a.id, b.id),
  );

  for (const nation of sortedNations) {
    const id = nation.id;

    const isPlayable = nation.isPlayable;
    const prestige = readNationPrestige(id, nation.prestige, prestigeRules, collector);
    if (Option.isNone(prestige)) continue;

    const fleets = buildFleets(fleetsData, id, collector);
    const research = buildResearch(researchData, id);
    const constructions = buildConstructions(constructionsData, id);
    const officers = buildOfficerRoster(id);
    const divisions = buildSeededDivisions(
      divisionsData.filter((d) => d.nationId === id),
      { nationId: id, fleets, officers, rulesetVersion, creationMonth },
      collector,
    );

    const economy = readEconomyRow(economiesData, id, collector);
    const { treasury, income, expenses, valid: economyValid } = economy;
    const startRate = SafeInt(START_APPROPRIATION_RATE_BP);
    const baseFits = incomeFitsEconomicBase(income);
    if (income > 0 && !baseFits) {
      collector.addError(
        "ECONOMY_BASE_OVERFLOW",
        `Nation '${id}' income ${String(income)} overflows the derived economic base`,
        { stage: "campaign-compile", entityId: id },
      );
    }
    const baseResources =
      income > 0 && baseFits ? deriveEconomicBase(income, startRate) : SafeInt(0);
    if (economyValid && baseFits) checkStartRevenue(id, baseResources, startRate, collector);
    const revenue = monthlyRevenue(baseResources, startRate);
    const cap = researchCap(revenue);
    const annualResearch = research.researchBudget;
    const monthlyResearch = monthlyResearchSpend(annualResearch);
    if (economyValid && monthlyResearch > cap) {
      collector.addError(
        "RESEARCH_ABOVE_CAP",
        `Nation '${id}' monthly research ${String(monthlyResearch)} exceeds the 12% cap ${String(cap)}`,
        { stage: "campaign-compile", entityId: id },
      );
    }
    if (annualResearch > 0 && monthlyResearch === 0) {
      collector.addInfo(
        "RESEARCH_BELOW_RESOLUTION",
        `Nation '${id}' annual research ${String(annualResearch)} is below one treasury unit a month`,
        { stage: "campaign-compile", entityId: id },
      );
    }
    const seededResearch: ResearchState = {
      ...research,
      researchBudget: monthlyResearch,
      standingResearchBudget: monthlyResearch,
      annualResearchAllocation: annualResearch,
    };

    const maintenance = nationMonthlyMaintenance(fleets, false);
    const net = monthlyNetBeforeConstruction({
      revenue,
      obligations: expenses,
      maintenance,
      research: monthlyResearch,
    });
    const runway = runwayMonths(treasury, net);
    if (economyValid && runway !== undefined) {
      structuralDeficits += 1;
      collector.addWarning(
        "STRUCTURAL_DEFICIT",
        `Nation '${id}' runs a structural deficit of ${String(Math.abs(net as number))} a month; the treasury lasts ${String(runway)} months`,
        { stage: "campaign-compile", entityId: id },
      );
    }

    nations.set(id, {
      id,
      name: nation.name,
      tag: nation.tag,
      governmentType: nation.regime.governmentType,
      traits: [...nation.traits],
      eventHistory: { fired: [], flags: [] },
      treasury,
      income,
      expenses,
      baseResources,
      navalAppropriationRateBp: startRate,
      maintenanceCost: SafeInt(0),
      prestige: prestige.value,
      ...(nation.homeArea !== undefined ? { homeAreaId: nation.homeArea } : {}),
      fleets,
      divisions,
      officers,
      research: seededResearch,
      constructionProjects: constructions,
      isPlayable,
      isAI: !isPlayable,
    });
  }

  if (nations.size > 1 && structuralDeficits === nations.size) {
    collector.addError(
      "ECONOMY_UNIFORM_DEFICIT",
      "Every nation in the pack runs a structural deficit",
      { stage: "campaign-compile" },
    );
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
  slots.sort((a, b) => compareCodePoints(a.nationId, b.nationId));
  return slots;
}
