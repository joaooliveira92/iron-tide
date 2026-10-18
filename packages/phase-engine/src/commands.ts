import type {
  CampaignSnapshot,
  ConstructionProject,
  DesignFamily,
  NationState,
} from "@bluewave/campaign";
import {
  applyCommanderChange,
  ConstructionProjectTransitionError,
  DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE,
  fleetMoveProblem,
  isTerminalConstructionProjectStatus,
  monthlyRevenue,
  researchCap,
  transitionConstructionProject,
  VACANT,
} from "@bluewave/campaign";
import type {
  AssignOfficerCommand,
  AuthorizeDockExpansionCommand,
  BudgetProjectCommand,
  HaltConstructionCommand,
  MoveFleetCommand,
  OrderConstructionCommand,
  OrderForeignConstructionCommand,
  RelieveOfficerCommand,
  ResumeConstructionCommand,
  SetAccelerationCommand,
  SetBudgetAllocationCommand,
  SubmitDesignCommand,
} from "@bluewave/commands";
import {
  compileDesign,
  HULL_TYPE_FOR_SHIP_TYPE,
  type DesignDraft,
  type ShipBuildingContent,
} from "@bluewave/ship-design";
import { SafeInt } from "@bluewave/contracts";
import type { DiagnosticCollector } from "@bluewave/diagnostics";
import { buildDesignVersion, pricingFor } from "./designVersion.js";
import { startDesignStudy, studyExists } from "./designStudies.js";
import { fundConstructionProject } from "./constructionFunding.js";
import {
  constructionResumeTarget,
  type ConstructionResumeTarget,
} from "./constructionHaltResume.js";
import {
  ACCELERATION_NOT_ALLOWED,
  applyAccelerationPremium,
  constructionAccelerationAllowed,
  constructionWorkStatus,
} from "./constructionAcceleration.js";
import {
  FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE,
  FOREIGN_PAYMENT_DEFAULT_DELAYED,
  FOREIGN_PAYMENT_DEFAULT_RESUME_BLOCKED,
} from "./foreignConstruction.js";
import { EventLedger } from "@bluewave/events";
import type { FinancialLedger } from "./financial-ledger.js";
import { budgetChangedEvent, makeLedgerEntry } from "./events.js";
import {
  CONSTRUCTION_BATCH_MAX_QUANTITY,
  CONSTRUCTION_BATCH_MIN_QUANTITY,
  placeConstructionBatch,
  resolveOrderTargets,
} from "./constructionOrder.js";
import { authorizeDockExpansion } from "./dockExpansion.js";
import { builderDockRecord, placeForeignConstructionOrder } from "./foreignConstruction.js";
import {
  FOREIGN_CONSTRUCTION_QUANTITY_INVALID,
  FOREIGN_CONTRACT_TERMS_NOT_ACCEPTED,
  deriveForeignContractTerms,
  resolveBuilderConstructionSupply,
  resolveForeignBuilderCapability,
} from "./foreignTerms.js";

export { applyDivisionCommandMonth } from "./divisionCommands.js";

/**
 * Shared canonical application of a SetResearchPriority command. Used by both
 * the human command_collection path and the AI_PLANNING path so behavior is
 * byte-identical.
 */
export function applySetResearchPriority(
  currentSnapshot: CampaignSnapshot,
  nationId: string,
  fieldPriorities: Record<string, SafeInt>,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const nation = currentSnapshot["nations"].get(nationId);
  if (!nation) {
    collector.addError("NATION_NOT_FOUND", `Nation ${nationId} not found`, {
      stage: "command_collection",
    });
    return currentSnapshot;
  }
  const updatedNation: NationState = {
    ...nation,
    research: {
      ...nation["research"],
      fieldPriorities,
    },
  };
  const updatedNations = new Map(currentSnapshot["nations"]);
  updatedNations.set(nationId, updatedNation);
  return { ...currentSnapshot, nations: updatedNations };
}

/**
 * Canonical application of AssignOfficer / RelieveOfficer (ADR-0065): sets the
 * division's commander. Re-checks the rules against the snapshot it applies to.
 */
export function applyOfficerCommand(
  currentSnapshot: CampaignSnapshot,
  body: AssignOfficerCommand | RelieveOfficerCommand,
  campaignMonth: string,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const nation = currentSnapshot["nations"].get(body["nationId"]);
  const idx = nation?.["divisions"].findIndex((d) => d["divisionId"] === body["divisionId"]) ?? -1;
  if (!nation || idx === -1) {
    collector.addError(
      DIVISION_MEMBERSHIP_CHANGE_INELIGIBLE,
      `Division ${body["divisionId"]} not found`,
      { stage: "command_collection" },
    );
    return currentSnapshot;
  }
  let commanderId = VACANT;
  if (body["type"] === "AssignOfficer") {
    const known = (nation["officers"] ?? []).some((o) => o["id"] === body["officerId"]);
    const elsewhere = nation["divisions"].some(
      (d) =>
        d["commanderOfficerId"] === body["officerId"] && d["divisionId"] !== body["divisionId"],
    );
    if (!known || elsewhere) {
      collector.addError(
        "INVALID_COMMAND_PAYLOAD",
        `Officer ${body["officerId"]} cannot be assigned to ${body["divisionId"]}`,
        { stage: "command_collection" },
      );
      return currentSnapshot;
    }
    commanderId = body["officerId"];
  }
  const divisions = [...nation["divisions"]];
  divisions[idx] = applyCommanderChange(divisions[idx]!, commanderId, campaignMonth).division;
  const nations = new Map(currentSnapshot["nations"]);
  nations.set(body["nationId"], { ...nation, divisions });
  return { ...currentSnapshot, nations };
}

/**
 * Canonical application of a MoveFleet command (ADR-0062): the fleet, its ships and
 * any division founded on one of its ships relocate to the destination area. The
 * move is re-checked against the snapshot it applies to, so a stale order is skipped
 * with a diagnostic rather than teleporting a fleet.
 */
export function applyMoveFleet(
  currentSnapshot: CampaignSnapshot,
  body: MoveFleetCommand,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const problem = fleetMoveProblem(
    currentSnapshot,
    body["nationId"],
    body["fleetId"],
    body["toAreaId"],
  );
  if (problem !== null) {
    collector.addError(problem.code, problem.message, { stage: "command_collection" });
    return currentSnapshot;
  }
  const nation = currentSnapshot["nations"].get(body["nationId"])!;
  const moved = nation["fleets"].find((f) => f["id"] === body["fleetId"])!;
  const movedShipIds = new Set(moved["ships"].map((s) => s["id"]));
  const updatedNation: NationState = {
    ...nation,
    fleets: nation["fleets"].map((fleet) =>
      fleet["id"] === body["fleetId"]
        ? {
            ...fleet,
            locationAreaId: body["toAreaId"],
            ships: fleet["ships"].map((s) => ({ ...s, locationAreaId: body["toAreaId"] })),
          }
        : fleet,
    ),
    divisions: nation["divisions"].map((d) =>
      movedShipIds.has(d["flagshipShipId"]) ? { ...d, locationAreaId: body["toAreaId"] } : d,
    ),
  };
  const updatedNations = new Map(currentSnapshot["nations"]);
  updatedNations.set(body["nationId"], updatedNation);
  return { ...currentSnapshot, nations: updatedNations };
}

/**
 * Canonical application of a SetBudgetAllocation command (ADR-0060): sets the
 * naval appropriation rate and the standing monthly research budget.
 */
export function applySetBudgetAllocation(
  currentSnapshot: CampaignSnapshot,
  body: SetBudgetAllocationCommand,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const nation = currentSnapshot["nations"].get(body["nationId"]);
  if (!nation) {
    collector.addError("NATION_NOT_FOUND", `Nation ${body["nationId"]} not found`, {
      stage: "command_collection",
    });
    return currentSnapshot;
  }
  // Spec #138 research cap: the standing monthly spend may not exceed 12% of the monthly revenue at the commanded rate.
  // The compiler enforces the same rule on authored research, so a runtime change cannot bypass it.
  const cap = researchCap(monthlyRevenue(nation["baseResources"], body["appropriationRateBp"]));
  if ((body["researchBudget"] as number) > (cap as number)) {
    collector.addError(
      "RESEARCH_ABOVE_CAP",
      `Nation ${body["nationId"]} research budget ${String(body["researchBudget"])} exceeds the cap of ${String(cap)} (12% of monthly revenue at ${String(body["appropriationRateBp"])} bp)`,
      { stage: "command_collection", entityId: body["nationId"] },
    );
    return currentSnapshot;
  }
  const updatedNation: NationState = {
    ...nation,
    navalAppropriationRateBp: body["appropriationRateBp"],
    research: {
      ...nation["research"],
      researchBudget: body["researchBudget"],
      standingResearchBudget: body["researchBudget"],
    },
  };
  const updatedNations = new Map(currentSnapshot["nations"]);
  updatedNations.set(body["nationId"], updatedNation);
  return { ...currentSnapshot, nations: updatedNations };
}

/**
 * Shared canonical application of a budget_project command. Used by both the
 * human command_collection path and the AI_PLANNING path so behavior is
 * byte-identical.
 */
export function applyBudgetProject(
  currentSnapshot: CampaignSnapshot,
  body: BudgetProjectCommand,
  campaignMonth: string,
  turnNumber: SafeInt,
  nextSeq: () => SafeInt,
  financialLedger: FinancialLedger,
  eventLedger: EventLedger,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const nation = currentSnapshot["nations"].get(body["nationId"]);
  if (!nation) {
    collector.addError("NATION_NOT_FOUND", `Nation ${body["nationId"]} not found`, {
      stage: "command_collection",
    });
    return currentSnapshot;
  }

  const project = nation["constructionProjects"].find((p) => p["id"] === body["projectId"]);
  if (!project) {
    collector.addError("PROJECT_NOT_FOUND", `Project ${body["projectId"]} not found`, {
      stage: "command_collection",
    });
    return currentSnapshot;
  }

  // DESIGN-23 section 7: a halted or delayed project receives exactly zero work and zero ordinary charge, so an explicit
  // budget for one is refused rather than silently spent. A terminal project cannot be funded at all.
  if (isTerminalConstructionProjectStatus(project["status"])) {
    collector.addError(
      "INVALID_DOCKYARD_PROJECT_TRANSITION",
      `Project ${body["projectId"]} is ${project["status"]} and cannot receive work`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return currentSnapshot;
  }
  if (project["status"] === "HALTED" || project["status"] === "DELAYED") {
    collector.addError(
      "PROJECT_NOT_ACTIVE",
      `Project ${body["projectId"]} is ${project["status"]} and receives no ordinary work charge`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return currentSnapshot;
  }

  // DESIGN-16 section 13.4: a foreign-contract project's work is driven by the contract instalment schedule resolved in
  // the appropriation phase, not by a domestic budget command. Refusing the direct budget keeps "no progress without
  // payment" true on the command path; an unpaid month stays at zero work.
  if (project["foreignContractId"] !== undefined) {
    collector.addError(
      FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE,
      `Project ${body["projectId"]} is a foreign contract order funded by its instalment schedule, not a domestic budget`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return currentSnapshot;
  }

  if (project["holdUntilMonth"] !== undefined && campaignMonth < project["holdUntilMonth"]) {
    collector.addError(
      "PROJECT_ON_HOLD",
      `Project ${body["projectId"]} is on hold after a revision until ${project["holdUntilMonth"]}`,
      { stage: "command_collection" },
    );
    return currentSnapshot;
  }

  const requested = body["budget"];
  let budget = requested;
  const previousTreasury = nation["treasury"];
  let fundedProject: ConstructionProject | undefined;
  if (project["packages"] !== undefined) {
    // Per-package construction (ADR-0077): only the work the yard can do this month is applied and charged.
    const capacity =
      project["capacityUnits"] ??
      currentSnapshot["designs"].get(project["designVersionId"])?.constructionPlan?.capacityUnits;
    const funded = fundConstructionProject(
      project,
      capacity === undefined
        ? undefined
        : Object.fromEntries(Object.entries(capacity).map(([line, v]) => [line, v as number])),
      requested as number,
      campaignMonth,
    );
    if (funded.applied <= 0) {
      collector.addWarning(
        "PROJECT_CAPACITY_EXHAUSTED",
        `Project ${body["projectId"]} could use none of the ${String(requested)} units offered this month: the yard's capacity or the package order leaves nothing to do`,
        { stage: "command_collection", entityId: body["projectId"] },
      );
      return currentSnapshot;
    }
    budget = SafeInt(funded.applied);
    fundedProject = funded.project;
  }
  const newTreasury = SafeInt.sub(previousTreasury, budget);
  const rawNewWork = SafeInt.add(project["completedWork"], budget);
  const clampedWork = rawNewWork > project["totalWork"] ? project["totalWork"] : rawNewWork;

  const updatedNation: NationState = {
    ...nation,
    treasury: newTreasury,
    constructionProjects: nation["constructionProjects"].map((p) =>
      p["id"] !== body["projectId"]
        ? p
        : (fundedProject ?? {
            ...transitionConstructionProject(p, constructionWorkStatus(p["status"])),
            completedWork: clampedWork,
            paidWork: SafeInt.add(p["paidWork"], budget),
          }),
    ),
  };
  const updatedNations = new Map(currentSnapshot["nations"]);
  updatedNations.set(body["nationId"], updatedNation);
  const next = { ...currentSnapshot, nations: updatedNations };

  financialLedger.append(
    makeLedgerEntry(
      body["nationId"],
      "command_collection",
      "CONSTRUCTION_BUDGET",
      budget,
      budget,
      previousTreasury,
      newTreasury,
      `Player budget for project ${body["projectId"]}`,
      campaignMonth,
    ),
  );

  eventLedger.append(
    budgetChangedEvent(
      body["nationId"],
      previousTreasury,
      newTreasury,
      SafeInt.mul(budget, SafeInt(-1)),
      `Player budget for project ${body["projectId"]}`,
      nextSeq(),
      campaignMonth,
    ),
  );

  return next;
}

/**
 * Canonical application of a SubmitDesign command (ADR-0066). The design is compiled here, with the ship-building
 * content supplied to the engine, never trusted from the caller. A rejected design leaves the snapshot untouched and
 * records a DESIGN_REJECTED diagnostic naming every blocking finding; an accepted one becomes an immutable
 * CompiledDesignVersion that the existing construction flow can order.
 */
export function applySubmitDesign(
  currentSnapshot: CampaignSnapshot,
  body: SubmitDesignCommand,
  content: ShipBuildingContent | undefined,
  month: string,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const fail = (code: string, message: string): CampaignSnapshot => {
    collector.addError(code, message, { stage: "command_collection" });
    return currentSnapshot;
  };
  if (!currentSnapshot["nations"].has(body["nationId"]))
    return fail("INVALID_NATION_ID", `Nation ${body["nationId"]} not found`);
  if (
    currentSnapshot["designs"].has(body["designVersionId"]) ||
    studyExists(currentSnapshot, body["designVersionId"])
  )
    return fail("DESIGN_REJECTED", `Design ${body["designVersionId"]} already exists`);
  if (content === undefined)
    return fail(
      "SHIP_BUILDING_CONTENT_MISSING",
      "The engine was not given ship-building content; design not compiled",
    );
  const draft = body["draft"] as DesignDraft;
  const env = content.environmentFor(month);
  const compiled = compileDesign(draft, env.ctx);
  if (!compiled.valid) {
    const blocking = compiled.findings.filter((f) => f.severity === "BLOCKING").map((f) => f.id);
    return fail(
      "DESIGN_REJECTED",
      `Design ${body["designVersionId"]} cannot be built: ${blocking.join(", ")}`,
    );
  }
  // The engine stores the hull type the command names; it must be the one the design's ship type maps to, or a
  // caller could file a corvette as a battleship (ADR-0088). Authored legacy labels stay valid for their types.
  const expectedHull = (HULL_TYPE_FOR_SHIP_TYPE as Readonly<Record<string, string | undefined>>)[
    draft.requirement.category
  ];
  if (expectedHull === undefined || body["hullType"] !== expectedHull)
    return fail(
      "DESIGN_REJECTED",
      `Design ${body["designVersionId"]}: hull type '${body["hullType"]}' does not match ship type '${draft.requirement.category}'`,
    );
  const design = buildDesignVersion(
    compiled,
    draft,
    {
      designVersionId: body["designVersionId"],
      designFamilyId: body["designFamilyId"],
      className: body["className"],
      hullType: body["hullType"],
      machineryType: body["machineryType"],
      contentVersion: currentSnapshot["rulesetVersion"],
      kgPerHitPoint: content.kgPerHitPoint,
    },
    pricingFor(content, month),
  );
  // DESIGN-21 section 3: with study rules in the content, the design is approved only when its study is done (ADR-0085).
  if (content.study !== null)
    return startDesignStudy(
      currentSnapshot,
      body["nationId"],
      design,
      { compiled, draft },
      content,
      month,
    );
  const existing = currentSnapshot["designFamilies"].get(body["designFamilyId"]);
  const family: DesignFamily = existing
    ? {
        ...existing,
        memberDesignVersionIds: [...existing.memberDesignVersionIds, design.designVersionId],
      }
    : {
        designFamilyId: body["designFamilyId"],
        nationId: body["nationId"],
        rootDesignVersionId: design.designVersionId,
        memberDesignVersionIds: [design.designVersionId],
        familyCreationMonth: month,
      };
  return {
    ...currentSnapshot,
    designs: new Map([...currentSnapshot["designs"], [design.designVersionId, design]]),
    designFamilies: new Map([
      ...currentSnapshot["designFamilies"],
      [family.designFamilyId, family],
    ]),
  };
}

/** The nation's project, or a diagnostic naming what was missing. */
function dockyardProject(
  currentSnapshot: CampaignSnapshot,
  nationId: string,
  projectId: string,
  collector: DiagnosticCollector,
): { nation: NationState; project: ConstructionProject } | undefined {
  const nation = currentSnapshot["nations"].get(nationId);
  if (!nation) {
    collector.addError("NATION_NOT_FOUND", `Nation ${nationId} not found`, {
      stage: "command_collection",
    });
    return undefined;
  }
  const project = nation["constructionProjects"].find((p) => p["id"] === projectId);
  if (!project) {
    collector.addError("INVALID_DOCKYARD_PROJECT", `Project ${projectId} is not ${nationId}'s`, {
      stage: "command_collection",
      entityId: projectId,
    });
    return undefined;
  }
  return { nation, project };
}

/**
 * Moves a project's status through the shared transition table. The single status write path for halt and resume, so no
 * engine site can invent a state DESIGN-23 section 2 does not allow; an illegal move fails closed with
 * `INVALID_DOCKYARD_PROJECT_TRANSITION` and changes nothing.
 */
function setProjectStatus(
  currentSnapshot: CampaignSnapshot,
  nation: NationState,
  project: ConstructionProject,
  to: ConstructionResumeTarget["status"] | "HALTED",
  collector: DiagnosticCollector,
  clearDelayReason = false,
): CampaignSnapshot {
  let updated: ConstructionProject;
  try {
    updated = transitionConstructionProject(project, to);
  } catch (error) {
    if (ConstructionProjectTransitionError.is(error)) {
      collector.addError("INVALID_DOCKYARD_PROJECT_TRANSITION", error.message, {
        stage: "command_collection",
        entityId: project["id"],
      });
      return currentSnapshot;
    }
    throw error;
  }
  if (updated === project) return currentSnapshot;
  if (clearDelayReason) {
    const cleared: ConstructionProject = { ...updated };
    delete cleared.delayReasonCode;
    updated = cleared;
  }
  const updatedNation: NationState = {
    ...nation,
    constructionProjects: nation["constructionProjects"].map((p) =>
      p["id"] === project["id"] ? updated : p,
    ),
  };
  const updatedNations = new Map(currentSnapshot["nations"]);
  updatedNations.set(nation["id"], updatedNation);
  return { ...currentSnapshot, nations: updatedNations };
}

/**
 * Canonical application of a `HaltConstruction` command (DESIGN-23 section 7): the project becomes `HALTED`, so it
 * receives no work and no ordinary charge and pays the preservation cost until it is resumed. A halt of an already
 * halted project is a no-op.
 */
export function applyHaltConstruction(
  currentSnapshot: CampaignSnapshot,
  body: HaltConstructionCommand,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const found = dockyardProject(currentSnapshot, body["nationId"], body["projectId"], collector);
  if (found === undefined) return currentSnapshot;
  return setProjectStatus(currentSnapshot, found.nation, found.project, "HALTED", collector);
}

/**
 * Canonical application of a `ResumeConstruction` command (DESIGN-23 section 7): the project returns to `ACTIVE`, or to
 * `AWAITING_CAPACITY` when the design records no usable construction capacity. The chosen reason is recorded as an info
 * diagnostic, so a resume is never silent.
 */
export function applyResumeConstruction(
  currentSnapshot: CampaignSnapshot,
  body: ResumeConstructionCommand,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const found = dockyardProject(currentSnapshot, body["nationId"], body["projectId"], collector);
  if (found === undefined) return currentSnapshot;
  // DESIGN-16 section 13.4 (M4, MINOR-6): a project held by a foreign payment default cannot be resumed by command.
  // The default clears only when the monthly step settles the arrears (or the contract is terminated); until then the
  // resume is refused with a specific reason and no state change. The guard keys on the persisted reason code, not the
  // current status: a halt in the default month (`DELAYED -> HALTED`) must not clear the hold by changing the status.
  if (found.project["delayReasonCode"] === FOREIGN_PAYMENT_DEFAULT_DELAYED) {
    collector.addError(
      FOREIGN_PAYMENT_DEFAULT_RESUME_BLOCKED,
      `Project ${body["projectId"]} is held by a foreign payment default and cannot resume until payment clears it`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return currentSnapshot;
  }
  const design = currentSnapshot["designs"].get(found.project["designVersionId"]);
  const target = constructionResumeTarget(design);
  // INC-9e MINOR-1: a successful non-payment resume clears any stale `delayReasonCode` (e.g. a builder-capability
  // delay), preserving the "reason only on a delayed month" invariant. The payment-default early return above keeps a
  // payment default held.
  const next = setProjectStatus(
    currentSnapshot,
    found.nation,
    found.project,
    target.status,
    collector,
    true,
  );
  if (next !== currentSnapshot)
    collector.addInfo(target.reason, `Project ${body["projectId"]} resumed as ${target.status}`, {
      stage: "command_collection",
      entityId: body["projectId"],
    });
  return next;
}

/**
 * Canonical application of a `SetAcceleration` command (DESIGN-23 section 8; DESIGN-13 section 11.3). Enabling
 * applies the one-time `10_500` bp remaining-work premium exactly once per remaining-work segment and moves the
 * project to `ACCELERATED`; disabling returns it to `ACTIVE`. Only `ACTIVE` <-> `ACCELERATED` is legal, so a
 * terminal, halted, delayed, awaiting-capacity or impounded project is refused. Repeating the current state is a
 * no-op, so no premium can be charged twice for the same segment. Pure except for the collector.
 */
export function applySetAcceleration(
  currentSnapshot: CampaignSnapshot,
  body: SetAccelerationCommand,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const found = dockyardProject(currentSnapshot, body["nationId"], body["projectId"], collector);
  if (found === undefined) return currentSnapshot;
  const { nation, project } = found;
  // INC-9e MINOR-5: a foreign-contract project's work is funded by its instalment schedule; the acceleration premium
  // would raise `totalWork` and unlock free progress for already-paid instalments, so acceleration is refused.
  if (project["foreignContractId"] !== undefined) {
    collector.addError(
      FOREIGN_CONTRACT_FUNDED_BY_SCHEDULE,
      `Project ${body["projectId"]} is a foreign contract order funded by its instalment schedule and cannot be accelerated`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return currentSnapshot;
  }
  if (body["accelerated"] && !constructionAccelerationAllowed(project["projectType"])) {
    collector.addError(
      ACCELERATION_NOT_ALLOWED,
      `Project ${body["projectId"]} is a ${project["projectType"]} project and cannot be accelerated`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return currentSnapshot;
  }
  if (project["status"] !== "ACTIVE" && project["status"] !== "ACCELERATED") {
    collector.addError(
      "INVALID_DOCKYARD_PROJECT_TRANSITION",
      `Project ${body["projectId"]} cannot change acceleration from ${project["status"]}`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
    return currentSnapshot;
  }
  if (body["accelerated"] === (project["status"] === "ACCELERATED")) return currentSnapshot;

  let updated: ConstructionProject;
  if (body["accelerated"]) {
    const premium = applyAccelerationPremium(project);
    updated = transitionConstructionProject(premium.project, "ACCELERATED");
    collector.addInfo(
      "CONSTRUCTION_ACCELERATED",
      `Project ${body["projectId"]} accelerated (premium ${String(premium.premiumWork)} work)`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
  } else {
    updated = transitionConstructionProject(project, "ACTIVE");
    collector.addInfo(
      "CONSTRUCTION_ACCELERATION_DISABLED",
      `Project ${body["projectId"]} acceleration disabled`,
      { stage: "command_collection", entityId: body["projectId"] },
    );
  }

  const updatedNation: NationState = {
    ...nation,
    constructionProjects: nation["constructionProjects"].map((p) =>
      p["id"] === project["id"] ? updated : p,
    ),
  };
  const updatedNations = new Map(currentSnapshot["nations"]);
  updatedNations.set(nation["id"], updatedNation);
  return { ...currentSnapshot, nations: updatedNations };
}

/** `YYYY-MM` to the month pair `constructionProjectFor`/`placeConstructionBatch` record on a new project. */
function monthPairOf(campaignMonth: string): { month: number; year: number } {
  return { year: Number(campaignMonth.slice(0, 4)), month: Number(campaignMonth.slice(5, 7)) };
}

/**
 * Canonical application of an `OrderConstruction` command (DESIGN-23 sections 3-5; SB3-R11..R14). The whole class
 * batch — one approved compiled design version, `1..12` ships — enters the snapshot through the single engine-side
 * `placeConstructionBatch` policy: revalidation, auxiliary limits, the dock ceiling and the national concurrency cap
 * reserve the batch BEFORE any project is added, and a failed gate creates no project and no reservation. A refused
 * batch records the engine's stable reason code and leaves the snapshot untouched. Pure except for the collector.
 */
export function applyOrderConstruction(
  currentSnapshot: CampaignSnapshot,
  body: OrderConstructionCommand,
  commandId: string,
  content: ShipBuildingContent | undefined,
  campaignMonth: string,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const placed = placeConstructionBatch(
    currentSnapshot,
    {
      nationId: body["nationId"],
      commandId,
      designVersionId: body["designVersionId"],
      quantity: body["quantity"],
      month: monthPairOf(campaignMonth),
    },
    content,
  );
  if (!placed.ok) {
    collector.addError(placed.reason, placed.diagnostics.join("; "), {
      stage: "command_collection",
    });
    return currentSnapshot;
  }
  return placed.snapshot;
}

/**
 * Canonical application of an `AuthorizeDockExpansion` command (DESIGN-16 sections 5-6; SB3-R16). The engine locks the
 * applicable era step at the current campaign month and creates a normal `INFRASTRUCTURE` project; it never raises the
 * dock immediately. A month with no era step or an invalid duration records the engine's stable reason and changes
 * nothing. Pure except for the collector.
 */
export function applyAuthorizeDockExpansion(
  currentSnapshot: CampaignSnapshot,
  body: AuthorizeDockExpansionCommand,
  campaignMonth: string,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  const authorized = authorizeDockExpansion(currentSnapshot, {
    nationId: body["nationId"],
    possessionId: body["possessionId"],
    campaignMonth,
  });
  if (!authorized.ok) {
    collector.addError(
      authorized.reason,
      `Dock expansion for ${body["possessionId"]} was refused`,
      {
        stage: "command_collection",
      },
    );
    return currentSnapshot;
  }
  return authorized.snapshot;
}

/**
 * Canonical application of an `OrderForeignConstruction` command (DESIGN-16 sections 13.1-13.4; SB3-R20..R22). The whole
 * contract enters the snapshot through the single engine-side `placeForeignConstructionOrder` policy: the immutable
 * contract is formed and its completeness checked, every builder-capability predicate is checked against the BUILDER's
 * dock and free `NEW_CONSTRUCTION` capacity, and the ordering nation's own concurrency pool is left untouched. A
 * refused order records the engine's stable reason code and changes nothing. Pure except for the collector.
 */
export function applyOrderForeignConstruction(
  currentSnapshot: CampaignSnapshot,
  body: OrderForeignConstructionCommand,
  commandId: string,
  content: ShipBuildingContent | undefined,
  campaignMonth: string,
  collector: DiagnosticCollector,
): CampaignSnapshot {
  // INC-17: the engine derives the contract; any runtime-excess `terms`/`capability` (a renderer that still sends the
  // old, untrusted shape) is refused outright. Nothing is written: a fabricated price, schedule or capability never
  // reaches `placeForeignConstructionOrder`.
  if (
    Object.prototype.hasOwnProperty.call(body, "terms") ||
    Object.prototype.hasOwnProperty.call(body, "capability")
  ) {
    collector.addError(
      FOREIGN_CONTRACT_TERMS_NOT_ACCEPTED,
      "The foreign order carries client-supplied terms/capability; the engine derives the contract server-side",
      { stage: "command_collection" },
    );
    return currentSnapshot;
  }
  const quantity = body["quantity"];
  if (
    !Number.isInteger(quantity) ||
    quantity < CONSTRUCTION_BATCH_MIN_QUANTITY ||
    quantity > CONSTRUCTION_BATCH_MAX_QUANTITY
  ) {
    collector.addError(
      FOREIGN_CONSTRUCTION_QUANTITY_INVALID,
      `A foreign order is ${String(CONSTRUCTION_BATCH_MIN_QUANTITY)}..${String(CONSTRUCTION_BATCH_MAX_QUANTITY)} ships; got ${String(quantity)}`,
      { stage: "command_collection" },
    );
    return currentSnapshot;
  }
  const targets = resolveOrderTargets(currentSnapshot, body["nationId"], body["designVersionId"]);
  if (!targets.ok) {
    collector.addError(targets.reason, targets.diagnostics.join("; "), {
      stage: "command_collection",
    });
    return currentSnapshot;
  }
  const { design } = targets;
  const builderNationId = body["builderNationId"];
  // The builder's dock and construction supply are the two volatile predicates the engine can resolve from content; the
  // DOCK and CAPACITY predicates are re-derived inside `placeForeignConstructionOrder` against the same snapshot.
  const dock = builderDockRecord(currentSnapshot, builderNationId, content, campaignMonth);
  const supply = resolveBuilderConstructionSupply(content, builderNationId, campaignMonth);
  const capability = resolveForeignBuilderCapability(currentSnapshot, content, {
    orderingNationId: body["nationId"],
    builderNationId,
    design,
    campaignMonth,
    constructionSupplyAvailable: supply.available,
    dock,
  });
  const terms = deriveForeignContractTerms({
    design,
    quantity,
    builderNationId,
    builderCostMultiplierBp: supply.costMultiplierBp,
    authorizationMonth: campaignMonth,
    ...(body["plannedDeliveryMonth"] === undefined
      ? {}
      : { plannedDeliveryMonth: body["plannedDeliveryMonth"] }),
  });
  const placed = placeForeignConstructionOrder(
    currentSnapshot,
    {
      nationId: body["nationId"],
      commandId,
      designVersionId: body["designVersionId"],
      builderNationId,
      month: monthPairOf(campaignMonth),
      terms,
      capability,
    },
    content,
  );
  if (!placed.ok) {
    collector.addError(placed.reason, placed.diagnostics.join("; "), {
      stage: "command_collection",
    });
    return currentSnapshot;
  }
  return placed.snapshot;
}
