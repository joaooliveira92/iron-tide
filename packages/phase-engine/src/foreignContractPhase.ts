// packages/phase-engine/src/foreignContractPhase.ts
// The monthly foreign-contract step (DESIGN-16 section 13.2/13.4; spec SB3-R20/R22). It is called from the appropriation
// phase, which already holds the treasury/constructions/nations read-write permissions it needs. For every project that
// carries a `foreignContractId` it:
//   - resolves the contract and verifies its stored hash (a tampered contract is refused, never consumed);
//   - revalidates the builder's capability against the current snapshot;
//   - resolves the month's instalments, paying every due instalment the ordering treasury covers, and posts the balanced
//     ordering-OUTFLOW / builder-INFLOW ledger pair so the builder is credited;
//   - applies the payment outcome: an unpaid instalment after the shipped one-month grace holds the project in
//     `DELAYED` with `PAYMENT_DEFAULT_DELAYED`; a paid instalment clears that default and resumes it;
//   - unlocks the paid instalments' `workShareBp` share of the project's work (INC-9d) while the builder is capable,
//     and holds a builder-capability failure in `DELAYED`.
// Unpaid work receives zero progress: every foreign project is returned in the appropriation skip set, so the ordinary
// appropriation never funds or charges it. Deterministic: integer arithmetic only, no wall clock, no randomness.
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
import { researchCostOf } from "./research.js";
import { relationAndTension } from "./foreignTerms.js";
import { nationalConstructionCapacity } from "./newConstructionCapacity.js";
import type { MonthContext } from "./monthContext.js";
import type { RandomEngine } from "@bluewave/random";
import {
  authorizeForeignImpoundment,
  foreignWarSettlementPostings,
  isDeliveryGuaranteeActive,
  resolveForeignWarPolicy,
  type ForeignWarPolicyResolution,
} from "./foreignWarEffects.js";

/**
 * The volatile builder predicates INC-9 does not model yet. Occupation/destruction and war effects arrive with INC-10;
 * until then every predicate is satisfied and capability can only fail on the dock or free capacity resolved from the
 * snapshot (the §13.2 checks that are already authoritative).
 */
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

/**
 * The result of one monthly foreign-contract pass.
 */
export interface ForeignContractPhaseResult {
  /**
   * Per ordering-nation id, the foreign project ids the ordinary appropriation must skip this month. A foreign project
   * is always skipped: its work is unlocked solely by its paid instalments (INC-9d), so an unpaid month receives zero
   * progress and a paid month is never charged an ordinary construction charge on top of its instalment.
   */
  readonly zeroWork: ReadonlyMap<string, ReadonlySet<string>>;
  /**
   * Project ids the step moved into — or held in — a builder-capability `DELAYED` this month. The appropriation's
   * ordinary one-month auto-resume must exclude them exactly like `delayedByPressure`, or the same-month resume would
   * unwind the capability delay immediately (MAJOR-1).
   */
  readonly capabilityDelayed: ReadonlySet<string>;
}

/**
 * Run the monthly foreign-contract step over the whole snapshot, committing treasury, project status/reason, unlocked
 * schedule work and payment records. Returns the per-nation zero-work skip set and the capability-delayed project ids.
 * Pure except for the ledgers and collector on the context.
 */
export function runForeignContractPhase(
  ctx: MonthContext,
  warRng: RandomEngine | null = null,
): ForeignContractPhaseResult {
  const shipBuilding = ctx.engineOptions?.shipBuilding;
  const campaignMonth = ctx.campaignMonth;
  const nations = new Map(ctx.currentSnapshot["nations"]);
  const skip = new Map<string, ReadonlySet<string>>();
  const capabilityDelayed = new Set<string>();
  let changed = false;

  for (const [nationId, nation0] of ctx.currentSnapshot["nations"]) {
    // INC-9e MINOR-6: mirror every other economy phase — a non-participating (neither playable nor AI) nation is never
    // debited. Foreign settlement is for the nations the war/economy actually run.
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
    // DESIGN-16 section 13.5: the award record per contract and the research model the month's insight posts into.
    const insightRecords = new Map(
      (nation0["foreignInsightAwards"] ?? []).map((r) => [r["contractId"], r] as const),
    );
    let insightResearch: ResearchState = nation0["research"];
    const updatedById = new Map<string, ConstructionProject>();
    const skipIds = new Set<string>();
    const snapshotNow = (): typeof ctx.currentSnapshot => ({ ...ctx.currentSnapshot, nations });

    for (const project0 of [...foreignProjects].sort((a, b) => byContractThenId(contracts, a, b))) {
      const contractId = project0["foreignContractId"]!;
      const contract = contracts.get(contractId);
      // A foreign project that has reached a terminal outcome has no month left to resolve. `IMPOUNDED` is terminal
      // for the monthly step (DESIGN-16 section 13.7: custody has transferred and future delivery is not eligible), so
      // it is never re-resolved — which also keeps a once-only settlement from being posted again every month. It must
      // still be excluded from the ordinary appropriation (a skip entry), or the work phase would fund and reactivate a
      // hull in another nation's custody.
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

      // INC-9e MINOR-2: the holder nation must be the contract's ordering nation. A contract relocated into another
      // nation's array (array order is not hashed) would debit one nation and ledger another; skip it with a diagnostic.
      if (contract.orderingNationId !== nationId) {
        ctx.collector.addError(
          FOREIGN_CONSTRUCTION_CONTRACT_REQUIRED,
          `Foreign contract ${contractId} is held by ${nationId} but orders for ${contract.orderingNationId}; it is refused this month`,
          { stage: "appropriation", entityId: project0["id"] },
        );
        skipIds.add(project0["id"]);
        continue;
      }

      // DESIGN-16 sections 13.6-13.7 (SB3-R23): evaluate the war policy. Physical impossibility, an embargo, or a
      // hostile ordering/builder relation resolves the contract to a declared outcome; a `CONTINUE` outcome leaves the
      // ordinary payment/capability/work path untouched. The discretionary-impoundment draw is keyed and recorded.
      const war = foreignWarResolution(ctx, nationId, contract, campaignMonth, warRng);
      if (war.outcome !== "CONTINUE") {
        const paidAmountUnits = paidAmountOf(contract, records.get(contractId) ?? []);
        // DESIGN-16 sections 13.6-13.7 (SB3-R23): the settlement money the outcome declares. For a refund effect
        // (`SETTLEMENT` / `FORFEIT_OR_COMPENSATION`) the BUILDER returns the cumulative paid amount to the ORDERING
        // nation; a zero-paid forfeiture moves nothing (see `foreignWarSettlementPostings`).
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
            // A war-held DELAYED project must not be unwound by the same-month auto-resume (like a capability delay).
            if (target === "DELAYED") capabilityDelayed.add(project0["id"]);
            appliedStatus = target;
          }
        }
        // Money moves only when the outcome's effect actually applied (the impoundment took custody, or the refund
        // outcome reached its state): a refused/illegal impoundment posts nothing. It can never post twice, because an
        // `IMPOUNDED`/`CANCELLED` project is terminal and skipped on later months.
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
            // The compensation is limited by the builder's means: the transfer is clamped to its available treasury so
            // the ledger never records a balance the obligation phase would later floor (DECISION 2026-10-12).
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
        // A war-resolved contract is always excluded from ordinary appropriation this month.
        skipIds.add(project0["id"]);
        continue;
      }

      // Settle every due instalment the ordering treasury covers, oldest first. A partial settlement still leaves the
      // project on zero progress (unpaid work); the ledger pair credits the builder for each instalment paid.
      const paidDueMonths = [...(records.get(contractId) ?? [])];
      // INC-9e NIT: build the monthly-step input once (only `paidDueMonths` differs between the probe and the settled
      // resolution) instead of repeating the same argument object twice.
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
        // INC-9e MINOR-3: a missing builder nation would debit the ordering treasury and post an INFLOW without
        // crediting anyone (destroying money). Refuse the instalment with a stable diagnostic instead.
        if (builder === undefined) {
          ctx.collector.addError(
            "FOREIGN_CONTRACT_BUILDER_NATION_MISSING",
            `Builder ${contract["builderNationId"]} for contract ${contractId} is not in the campaign; the instalment is not paid`,
            { stage: "appropriation", entityId: project0["id"] },
          );
          break;
        }
        // INC-9e MINOR-4: a zero-amount due instalment is auto-satisfied (nothing to pay), so it can never leave the
        // contract permanently in default.
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

      // Resolve the month's outcome against the now-settled schedule (no `paidThisMonth`: postings were already posted).
      const settled = advanceForeignContractMonth(monthInput(paidDueMonths));

      const resumeStatus = constructionResumeTarget(
        ctx.currentSnapshot["designs"].get(contract["designVersionId"]),
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
        // MAJOR-1: move the project into DELAYED only when the transition is legal, and never write a reason unless
        // it ends DELAYED. A project already delayed for another reason (e.g. an acceleration-pressure delay) is held
        // too; either way it is recorded so the appropriation's ordinary auto-resume cannot unwind it this month.
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
        // INC-9d (MEDIUM-3): work is unlocked solely by the paid instalments' `workShareBp`, applied while the builder
        // is capable. The ordinary appropriation never funds or charges the work again.
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
      // DESIGN-16 section 13.5 (SB3-R24): post the construction-observation insight once half the work is paid and
      // the delivery insight once the project is complete. Each milestone is awarded at most once per contract; the
      // award posts micro-points into the ordering nation's research and never grants a technology.
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
            remainingRequirementFor: makeRemainingRequirementFor(insightResearch, researchCostOf),
          });
          if (application.awards.length === 0) continue;
          insightResearch = application.research;
          if (application.record !== undefined) insightRecords.set(contractId, application.record);
        }
      }

      // A foreign project is always excluded from ordinary appropriation: its progress comes from the schedule alone.
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

    // Keep the field absent until the first instalment is actually paid, so a foreign run that never pays does not
    // add hash-perturbing state.
    const payments =
      mergedRecords.length > 0 ? mergedRecords : finalNation["foreignContractPayments"];

    // DESIGN-16 section 13.5: merge this month's insight records, keeping the field absent until the first award so
    // a foreign run that transfers no insight does not add hash-perturbing state.
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

  if (changed) ctx.currentSnapshot = { ...ctx.currentSnapshot, nations };
  return { zeroWork: skip, capabilityDelayed };
}

/** The compiled displacement demand the builder-capability dock check reads. */
function demandFor(
  snapshot: CampaignSnapshot,
  contract: ForeignConstructionContract,
): { lengthMm: number; beamMm: number; displacementKg: number; heaviestKg: number } {
  const design = snapshot["designs"].get(contract["designVersionId"]);
  // INC-16: the compiled design carries no length/beam, so the monthly builder-capability dock revalidation judges only
  // the mass ceiling. Recorded deferral owned by ship-design/campaign content.
  return {
    lengthMm: 0,
    beamMm: 0,
    displacementKg: design === undefined ? 0 : Number(design["normalizedDisplacementKg"]),
    heaviestKg: 0,
  };
}

/**
 * The builder's free `NEW_CONSTRUCTION` capacity for THIS contract: its cap minus every other commitment, with the
 * contract's own reservation added back (so revalidating a live contract does not count it against itself).
 */
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

/** Re-exported for tests: the volatile-capability default the INC-9 monthly step applies. */
export { FOREIGN_BUILDER_CONDITIONS_SATISFIED };

/**
 * DESIGN-16 section 13.6: resolve a contract's war policy from the current snapshot. Occupation/destruction, embargo
 * and co-belligerence predicates are not yet modelled (they default to their non-triggering values and are a recorded
 * deferral); the ordering↔builder relation and tension are authoritative and drive the discretionary-impoundment draw.
 */
function foreignWarResolution(
  ctx: MonthContext,
  orderingNationId: string,
  contract: ForeignConstructionContract,
  campaignMonth: string,
  warRng: RandomEngine | null,
): ForeignWarPolicyResolution {
  const rel = relationAndTension(
    ctx.currentSnapshot,
    orderingNationId,
    contract["builderNationId"],
  );
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
    ...(warRng === null ? {} : { randomEngine: warRng }),
    randomLedger: ctx.randomLedger,
  });
}

/** The cumulative amount already paid on a contract, summed from its paid instalments (treasury units). */
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
