import { SafeInt } from "@bluewave/contracts";
import type { ShipBuildingCatalogue } from "@bluewave/content-compiler";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import {
  resolveNationalConstruction,
  resolveNavalProfile,
  seededConstructionPlan,
  type ConstructionBalance,
  type NationNavalProfile,
} from "@bluewave/ship-design";
import type {
  CompiledDesignVersion,
  ConstructionPackage,
  ConstructionProject,
  NationState,
} from "./state.js";

function isNavalProfile(value: unknown): value is NationNavalProfile {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as {
    nationId?: unknown;
    activeFrom?: unknown;
    industrialProfile?: unknown;
  };
  return (
    typeof candidate.nationId === "string" &&
    typeof candidate.activeFrom === "string" &&
    typeof candidate.industrialProfile === "object"
  );
}

export const SEEDED_PROJECT_WITHOUT_CAPACITY = "SEEDED_PROJECT_WITHOUT_CAPACITY";

function isSeedable(project: ConstructionProject): boolean {
  return (
    project["projectType"] === "NEW_CONSTRUCTION" &&
    project["packages"] === undefined &&
    project["status"] !== "COMPLETED" &&
    project["status"] !== "CANCELLED" &&
    (project["totalWork"] as number) > 0
  );
}

function seedProject(
  project: ConstructionProject,
  nationId: string,
  design: CompiledDesignVersion | undefined,
  balance: ConstructionBalance,
  profiles: readonly NationNavalProfile[],
  creationMonth: string,
  collector: DiagnosticCollector,
): ConstructionProject {
  const fail = (why: string): ConstructionProject => {
    collector.addError(
      SEEDED_PROJECT_WITHOUT_CAPACITY,
      `Seeded project '${project["id"]}' of nation '${nationId}' has no construction capacity: ${why}`,
      { stage: "seeded-constructions", entityId: project["id"] },
    );
    return project;
  };
  if (design === undefined)
    return fail(`design '${project["designVersionId"]}' is not in the pack`);
  const displacementKg = design["normalizedDisplacementKg"] as number;
  if (!(displacementKg > 0)) return fail("its design has no displacement");

  let plan;
  try {
    plan = seededConstructionPlan({
      displacementKg,
      totalUnits: project["totalWork"] as number,
      completedUnits: project["completedWork"] as number,
      balance,
      month: project["startedAt"] === "" ? creationMonth : project["startedAt"],
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "the plan could not be derived");
  }

  const profile = resolveNavalProfile(profiles, nationId, creationMonth);
  let buildTimeMultiplierBp: number | undefined;
  if (profile !== null) {
    try {
      buildTimeMultiplierBp = resolveNationalConstruction(
        profile,
        creationMonth,
      ).buildTimeMultiplierBp;
    } catch {
      return fail(`nation '${nationId}' has no usable national build-time profile`);
    }
  }

  const packages: ConstructionPackage[] = plan.packages.map((p) => ({
    id: p.id,
    kind: p.kind,
    line: p.line,
    totalWork: SafeInt(p.totalWork),
    doneWork: SafeInt(p.doneWork),
    dependsOn: [...p.dependsOn],
  }));
  return {
    ...project,
    packages,
    completedWork: SafeInt(plan.packages.reduce((sum, p) => sum + p.doneWork, 0)),
    capacityUnits: Object.fromEntries(
      Object.entries(plan.capacityUnits).map(([line, units]) => [line, SafeInt(units)]),
    ),
    ...(buildTimeMultiplierBp === undefined
      ? {}
      : { nationalProfileId: profile!.nationId, buildTimeMultiplierBp }),
  };
}

export function materialiseSeededConstructions(
  nations: Map<string, NationState>,
  designs: Map<string, CompiledDesignVersion>,
  shipBuilding: ShipBuildingCatalogue | undefined,
  creationMonth: string,
  collector: DiagnosticCollector,
): Map<string, NationState> {
  const balance = (shipBuilding?.balance as { construction?: ConstructionBalance } | undefined)
    ?.construction;
  if (shipBuilding === undefined || balance === undefined) return nations;
  const profiles = shipBuilding.navalProfiles.filter(isNavalProfile);

  const seeded = new Map(nations);
  for (const [nationId, nation] of nations) {
    if (!nation["constructionProjects"].some(isSeedable)) continue;
    seeded.set(nationId, {
      ...nation,
      constructionProjects: nation["constructionProjects"].map((project) =>
        isSeedable(project)
          ? seedProject(
              project,
              nationId,
              designs.get(project["designVersionId"]),
              balance,
              profiles,
              creationMonth,
              collector,
            )
          : project,
      ),
    });
  }
  return seeded;
}
