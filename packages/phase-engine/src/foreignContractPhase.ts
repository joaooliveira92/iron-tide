import type {
  CampaignSnapshot,
  ConstructionProject,
  ForeignConstructionContract,
  ResearchState,
} from "@bluewave/campaign";
import { canTransitionConstructionProject } from "@bluewave/campaign";
import { SafeInt } from "@bluewave/contracts";
import type { ShipBuildingContent } from "@bluewave/ship-design";
import { constructionResumeTarget } from "./constructionHaltResume.js";
import {
  FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
  FOREIGN_CONTRACT_HASH_MISMATCH,
  advanceForeignContractMonth,
  applyForeignPaymentOutcome,
  builderDockRecord,
  capabilityFailureCode,
  compareForeignConstructionContracts,
  foreignBuilderCommittedMassKg,
  foreignContractReservedMassKg,
  foreignPaymentLedgerEntries,
  foreignPostingLedgerEntries,
  foreignUnlockedWork,
  isForeignPaymentDefaultProject,
  verifyForeignContractHash,
  type ForeignBuilderCapabilityConditions,
} from "./foreignConstruction.js";
import {
  applyForeignInsightMilestone,
  foreignInsightMilestonesDue,
  isForeignInsightContract,
  makeRemainingRequirementFor,
  mergeForeignInsightAwardRecord,
} from "./foreignInsight.js";
import { researchCostLookup } from "./research.js";
import { relationAndTension } from "./foreignTerms.js";
import { nationalConstructionCapacity } from "./newConstructionCapacity.js";
import type { PhaseContext } from "./pipeline.js";
import type { RandomEngine, RandomLedger } from "@bluewave/random";
import {
  authorizeForeignImpoundment,
  foreignWarSettlementPostings,
  isDeliveryGuaranteeActive,
  resolveForeignWarPolicy,
  type ForeignWarPolicyResolution,
} from "./foreignWarEffects.js";

const FOREIGN_BUILDER_CONDITIONS_SATISFIED: ForeignBuilderCapabilityConditions = {
  requiredTechnologySatisfied: true,
  shipyardCapabilitySatisfied: true,
  governmentPermissionSatisfied: true,
  componentSourcingSatisfied: true,
  physicallyCapable: true,
};

const byContractThenId = (
  contracts: ReadonlyMap<string, ForeignConstructionContract>,
  a: ConstructionProject,
  b: ConstructionProject,
): number => {
  const ca = contracts.get(a["foreignContractId"]!);
  const cb = contracts.get(b["foreignContractId"]!);
  const byContract =
    ca !== undefined && cb !== undefined ? compareForeignConstructionContracts(ca, cb) : 0;
  if (byContract !== 0) return byContract;
  return a["id"] < b["id"] ? -1 : a["id"] > b["id"] ? 1 : 0;
};

export interface ForeignContractPhaseResult {
  readonly zeroWork: ReadonlyMap<string, ReadonlySet<string>>;
  readonly capabilityDelayed: ReadonlySet<string>;
}

export function runForeignContractPhase(
  ctx: PhaseContext,
  warRng: RandomEngine,
): ForeignContractPhaseResult {
  const shipBuilding = ctx.engineOptions?.shipBuilding;
  const campaignMonth = ctx.campaignMonth;
  const nations = new Map(ctx.snapshot.read("nations"));
  const skip = new Map<string, ReadonlySet<string>>();
  const capabilityDelayed = new Set<string>();
  let changed = false;

  for (const [nationId, nation0] of ctx.snapshot.read("nations")) {
    if (!nation0["isPlayable"] && !nation0["isAI"]) continue;
    const foreignProjects = nation0["constructionProjects"].filter(
      (p) => p["foreignContractId"] !== undefined,
    );
    if (foreignProjects.length === 0) continue;

    const contracts = new Map(
      (nation0["foreignContracts"] ?? []).map((c) => [c["contractId"], c] as const),
    );
    const records = new Map(
      (nation0["foreignContractPayments"] ?? []).map(
        (r) => [r["contractId"], r["paidDueMonths"]] as const,
      ),
    );
    const insightRecords = new Map(
      (nation0["foreignInsightAwards"] ?? []).map((r) => [r["contractId"], r] as const),
    );
    let insightResearch: ResearchState = nation0["research"];
    const updatedById = new Map<string, ConstructionProject>();
    const skipIds = new Set<string>();
    const snapshotNow = (): CampaignSnapshot => ctx.snapshot.view({ nations });

    for (const project0 of [...foreignProjects].sort((a, b) => byContractThenId(contracts, a, b))) {
      const contractId = project0["foreignContractId"]!;
      const contract = contracts.get(contractId);
      if (
        project0["status"] === "COMPLETED" ||
        project0["status"] === "CANCELLED" ||
        project0["status"] === "IMPOUNDED"
      ) {
        skipIds.add(project0["id"]);
        continue;
      }

      if (contract === undefined) {
        ctx.collector.addError(
          FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
          `Project ${project0["id"]} carries foreign contract ${contractId} but the ordering nation has no such contract`,
          { stage: "appropriation", entityId: project0["id"] },
        );
        skipIds.add(project0["id"]);
        continue;
      }
      if (!verifyForeignContractHash(contract)) {
        ctx.collector.addError(
          FOREIGN_CONTRACT_HASH_MISMATCH,
          `Foreign contract ${contractId} does not match its stored hash; it is refused this month`,
          { stage: "appropriation", entityId: project0["id"] },
        );
        skipIds.add(project0["id"]);
        continue;
      }

      if (contract.orderingNationId !== nationId) {
        ctx.collector.addError(
          FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
          `Foreign contract ${contractId} is held by ${nationId} but orders for ${contract.orderingNationId}; it is refused this month`,
          { stage: "appropriation", entityId: project0["id"] },
        );
        skipIds.add(project0["id"]);
        continue;
      }

      const war = foreignWarResolution(
        snapshotNow(),
        nationId,
        contract,
        campaignMonth,
        warRng,
        ctx.randomLedger,
      );
      if (war.outcome !== "CONTINUE") {
        const paidAmountUnits = paidAmountOf(contract, records.get(contractId) ?? []);
        const settlement = foreignWarSettlementPostings(contract, war.outcome, paidAmountUnits);
        const currentNation = nations.get(nationId)!;
        const impound =
          war.outcome === "IMPOUND"
            ? authorizeForeignImpoundment({
                nation: currentNation,
                projectId: project0["id"],
                contract,
                resolution: war,
                campaignMonth,
                paidAmountUnits,
                custodyNationId: contract["builderNationId"],
              })
            : null;
        let appliedStatus: "IMPOUNDED" | "CANCELLED" | "DELAYED" | null = null;
        if (impound !== null && impound.ok) {
          nations.set(nationId, impound.nation);
          updatedById.set(
            project0["id"],
            impound.nation["constructionProjects"].find((p) => p["id"] === project0["id"])!,
          );
          capabilityDelayed.add(project0["id"]);
          appliedStatus = "IMPOUNDED";
        } else {
          const target = war.outcome === "CANCEL_WITH_SETTLEMENT" ? "CANCELLED" : "DELAYED";
          if (canTransitionConstructionProject(project0["status"], target)) {
            nations.set(nationId, currentNation);
            updatedById.set(project0["id"], {
              ...project0,
              status: target,
              ...(target === "DELAYED" ? { delayReasonCode: war.reasonCode } : {}),
            });
            if (target === "DELAYED") capabilityDelayed.add(project0["id"]);
            appliedStatus = target;
          }
        }
        const settledByOutcome =
          impound !== null ? impound.ok : settlement.length > 0 && appliedStatus !== null;
        if (settledByOutcome) {
          const builder = nations.get(contract["builderNationId"]);
          const orderingNow = nations.get(nationId)!;
          if (builder === undefined) {
            ctx.collector.addError(
              "FOREIGN_CONTRACT_BUILDER_NATION_MISSING",
              `Builder ${contract["builderNationId"]} for contract ${contractId} is not in the campaign; the war settlement is not posted`,
              { stage: "appropriation", entityId: project0["id"] },
            );
          } else {
            const owed = settlement.reduce(
              (sum, p) => sum + (p.direction === "OUTFLOW" ? p.amountUnits : 0),
              0,
            );
            const affordable = Math.min(owed, Math.max(0, Number(builder["treasury"])));
            if (affordable > 0) {
              const clamped = settlement.map((p) => ({ ...p, amountUnits: affordable }));
              for (const entry of foreignPostingLedgerEntries(clamped, {
                campaignMonth,
                phaseId: "appropriation",
                balances: {
                  [nationId]: Number(orderingNow["treasury"]),
                  [contract["builderNationId"]]: Number(builder["treasury"]),
                },
              }))
                ctx.financialLedger.append(entry);
              const deltas = new Map<string, number>();
              for (const p of clamped)
                deltas.set(
                  p.nationId,
                  (deltas.get(p.nationId) ?? 0) +
                    (p.direction === "OUTFLOW" ? -p.amountUnits : p.amountUnits),
                );
              for (const [id, delta] of deltas) {
                const nation = nations.get(id)!;
                nations.set(id, {
                  ...nation,
                  treasury: SafeInt(Number(nation["treasury"]) + delta),
                });
              }
            }
          }
        }
        if (settledByOutcome || appliedStatus !== null) changed = true;
        skipIds.add(project0["id"]);
        continue;
      }

      const paidDueMonths = [...(records.get(contractId) ?? [])];
      const monthInput = (paid: readonly string[]) => ({
        contract,
        campaignMonth,
        demand: demandFor(snapshotNow(), contract),
        dock:
          builderDockRecord(
            snapshotNow(),
            contract["builderNationId"],
            shipBuilding,
            campaignMonth,
          ) ?? {},
        conditions: FOREIGN_BUILDER_CONDITIONS_SATISFIED,
        reservedMassKg: foreignContractReservedMassKg(contract),
        availableNewConstructionCapacityKg: availableBuilderCapacityKg(
          snapshotNow(),
          contract,
          shipBuilding,
          campaignMonth,
        ),
        paidDueMonths: paid,
        alreadyDefaulted: isForeignPaymentDefaultProject(project0),
      });
      const probe = advanceForeignContractMonth(monthInput(paidDueMonths));
      for (const installment of probe.payment["unpaidInstallments"]) {
        const amount = installment["amountUnits"];
        if (!Number.isSafeInteger(amount)) continue;
        const builder = nations.get(contract["builderNationId"]);
        if (builder === undefined) {
          ctx.collector.addError(
            "FOREIGN_CONTRACT_BUILDER_NATION_MISSING",
            `Builder ${contract["builderNationId"]} for contract ${contractId} is not in the campaign; the instalment is not paid`,
            { stage: "appropriation", entityId: project0["id"] },
          );
          break;
        }
        if (amount <= 0) {
          paidDueMonths.push(installment["dueMonth"]);
          changed = true;
          continue;
        }
        const ordering = nations.get(nationId)!;
        const orderingBalance = Number(ordering["treasury"]);
        if (orderingBalance < amount) break;
        const builderBalance = Number(builder["treasury"]);
        for (const entry of foreignPaymentLedgerEntries(contract, installment, {
          campaignMonth,
          phaseId: "appropriation",
          balances: {
            [nationId]: orderingBalance,
            [contract["builderNationId"]]: builderBalance,
          },
        }))
          ctx.financialLedger.append(entry);
        nations.set(nationId, {
          ...ordering,
          treasury: SafeInt.sub(ordering["treasury"], SafeInt(amount)),
        });
        nations.set(contract["builderNationId"], {
          ...builder,
          treasury: SafeInt.add(builder["treasury"], SafeInt(amount)),
        });
        paidDueMonths.push(installment["dueMonth"]);
        changed = true;
      }
      records.set(contractId, paidDueMonths);

      const settled = advanceForeignContractMonth(monthInput(paidDueMonths));

      const resumeStatus = constructionResumeTarget(
        ctx.snapshot.read("designs").get(contract["designVersionId"]),
      ).status;
      let updated = applyForeignPaymentOutcome(project0, settled.payment, resumeStatus);

      if (!settled.capability["satisfied"]) {
        const capabilityCode = capabilityFailureCode(settled.capability);
        ctx.collector.addWarning(
          capabilityCode,
          `Builder ${contract["builderNationId"]} fails capacity revalidation for contract ${contractId}: ${settled.capability[
            "reasons"
          ]
            .map((r) => r["field"])
            .join(", ")}`,
          { stage: "appropriation", entityId: project0["id"] },
        );
        if (!isForeignPaymentDefaultProject(updated)) {
          if (canTransitionConstructionProject(updated["status"], "DELAYED"))
            updated = {
              ...updated,
              status: "DELAYED",
              delayReasonCode: capabilityCode,
            };
          if (updated["status"] === "DELAYED") capabilityDelayed.add(project0["id"]);
        }
      } else {
        const unlocked = foreignUnlockedWork(
          Number(project0["totalWork"]),
          contract,
          paidDueMonths,
        );
        if (unlocked > Number(updated["completedWork"]))
          updated = {
            ...updated,
            completedWork: SafeInt(unlocked),
            paidWork: SafeInt(Math.max(unlocked, Number(updated["paidWork"]))),
          };
      }
      if (isForeignInsightContract(contract)) {
        const dueMilestones = foreignInsightMilestonesDue({
          paidWork: Number(updated["paidWork"]),
          completedWork: Number(updated["completedWork"]),
          totalWork: Number(project0["totalWork"]),
          completed: updated["status"] === "COMPLETED",
          record: insightRecords.get(contractId),
        });
        for (const milestone of dueMilestones) {
          const application = applyForeignInsightMilestone({
            contract,
            milestone,
            record: insightRecords.get(contractId),
            research: insightResearch,
            remainingRequirementFor: makeRemainingRequirementFor(
              insightResearch,
              researchCostLookup(snapshotNow()),
            ),
          });
          if (application.awards.length === 0) continue;
          insightResearch = application.research;
          if (application.record !== undefined) insightRecords.set(contractId, application.record);
        }
      }

      skipIds.add(project0["id"]);
      updatedById.set(project0["id"], updated);
    }

    if (updatedById.size === 0) {
      if (skipIds.size > 0) skip.set(nationId, skipIds);
      continue;
    }

    const finalNation = nations.get(nationId)!;
    const existingRecords = finalNation["foreignContractPayments"] ?? [];
    const mergedRecords = existingRecords.map((r) => ({
      ...r,
      paidDueMonths: [...r.paidDueMonths],
    }));
    for (const [cid, paid] of records)
      if (paid.length > 0) {
        const at = mergedRecords.findIndex((r) => r["contractId"] === cid);
        if (at >= 0) mergedRecords[at] = { contractId: cid, paidDueMonths: [...paid].sort() };
        else mergedRecords.push({ contractId: cid, paidDueMonths: [...paid].sort() });
      }
    mergedRecords.sort((a, b) =>
      a["contractId"] < b["contractId"] ? -1 : a["contractId"] > b["contractId"] ? 1 : 0,
    );

    const payments =
      mergedRecords.length > 0 ? mergedRecords : finalNation["foreignContractPayments"];

    let insightAwards = finalNation["foreignInsightAwards"];
    for (const record of insightRecords.values())
      insightAwards = mergeForeignInsightAwardRecord(insightAwards, record);

    nations.set(nationId, {
      ...finalNation,
      research: insightResearch,
      constructionProjects: finalNation["constructionProjects"].map(
        (p) => updatedById.get(p["id"]) ?? p,
      ),
      ...(payments === undefined ? {} : { foreignContractPayments: payments }),
      ...(insightAwards === undefined ? {} : { foreignInsightAwards: insightAwards }),
    });
    changed = true;
    if (skipIds.size > 0) skip.set(nationId, skipIds);
  }

  if (changed) ctx.snapshot.write("nations", nations);
  return { zeroWork: skip, capabilityDelayed };
}

function demandFor(
  snapshot: CampaignSnapshot,
  contract: ForeignConstructionContract,
): { lengthMm: number; beamMm: number; displacementKg: number; heaviestKg: number } {
  const design = snapshot["designs"].get(contract["designVersionId"]);
  return {
    lengthMm: 0,
    beamMm: 0,
    displacementKg: design === undefined ? 0 : Number(design["normalizedDisplacementKg"]),
    heaviestKg: 0,
  };
}

function availableBuilderCapacityKg(
  snapshot: CampaignSnapshot,
  contract: ForeignConstructionContract,
  shipBuilding: ShipBuildingContent | undefined,
  campaignMonth: string,
): number {
  const builderNationId = contract["builderNationId"];
  const dock = builderDockRecord(snapshot, builderNationId, shipBuilding, campaignMonth);
  const balance = shipBuilding?.environmentFor(campaignMonth, builderNationId)[
    "constructionBalance"
  ];
  if (dock === null || balance === undefined) return 0;
  const capacity = nationalConstructionCapacity(balance, dock["maximumNewConstructionMassKg"] ?? 0);
  const committed = foreignBuilderCommittedMassKg(snapshot, builderNationId, capacity);
  return Math.max(
    0,
    capacity.maxConcurrentMassKg - committed + foreignContractReservedMassKg(contract),
  );
}

export { FOREIGN_BUILDER_CONDITIONS_SATISFIED };

function foreignWarResolution(
  snapshot: CampaignSnapshot,
  orderingNationId: string,
  contract: ForeignConstructionContract,
  campaignMonth: string,
  warRng: RandomEngine,
  randomLedger: RandomLedger,
): ForeignWarPolicyResolution {
  const rel = relationAndTension(snapshot, orderingNationId, contract["builderNationId"]);
  return resolveForeignWarPolicy({
    contract,
    campaignMonth,
    relation: rel.relation,
    tension: rel.tension,
    deliveryGuaranteeActive: isDeliveryGuaranteeActive(contract),
    physicallyImpossible: false,
    embargo: false,
    coBelligerent: false,
    builderControllerHostile: false,
    randomEngine: warRng,
    randomLedger,
  });
}

function paidAmountOf(
  contract: ForeignConstructionContract,
  paidDueMonths: readonly string[],
): number {
  const paid = new Set(paidDueMonths);
  let total = 0;
  for (const installment of contract.paymentSchedule)
    if (paid.has(installment["dueMonth"]) && Number.isSafeInteger(installment["amountUnits"]))
      total += installment["amountUnits"];
  return total;
}
