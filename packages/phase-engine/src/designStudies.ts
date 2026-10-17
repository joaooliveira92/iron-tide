import type {
  CampaignSnapshot,
  CompiledDesignVersion,
  DesignFamily,
  DesignStudy,
  NationState,
} from "@bluewave/campaign";
import { SafeInt, bp, money } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";
import {
  assessSimilarity,
  compileDesign,
  similarityProfile,
  studyTerms,
  type CompiledDesign,
  type DesignDraft,
  type ShipBuildingContent,
} from "@bluewave/ship-design";
import { budgetChangedEvent, makeLedgerEntry } from "./events.js";
import type { MonthContext } from "./monthContext.js";

/** Ledger category of study payments (treasury screens group spending by category). */
export const DESIGN_STUDY_CATEGORY = "DESIGN_STUDY";

/**
 * The baseline a candidate in `designFamilyId` is derived from (DESIGN-21 section 8): the family's newest member that still
 * has its source draft, so it can be compared under today's rules. Null for a new family, or one with no comparable member.
 */
function baselineOf(
  snapshot: CampaignSnapshot,
  designFamilyId: string,
  nationId: string,
): CompiledDesignVersion | null {
  const family = snapshot["designFamilies"].get(designFamilyId);
  if (!family || family.nationId !== nationId) return null;
  for (const id of [...family.memberDesignVersionIds].reverse()) {
    const d = snapshot["designs"].get(id);
    if (d?.sourceDraft !== undefined) return d;
  }
  return null;
}

/**
 * The study that would approve `design` (ADR-0085), without opening it: the Drawing Board shows these terms before the
 * player submits, and `startDesignStudy` opens exactly this study. A design in an existing family is compared with the
 * family's newest member: similar earns the derived-design discount and stays in the family; not similar becomes a new
 * family (section 17) named after the design. Pure.
 */
export function planDesignStudy(
  snapshot: CampaignSnapshot,
  nationId: string,
  design: CompiledDesignVersion,
  candidate: { readonly compiled: CompiledDesign; readonly draft: DesignDraft },
  content: ShipBuildingContent,
  month: string,
): DesignStudy {
  const study = content.study!;
  const env = content.environmentFor(month);
  const baseline = baselineOf(snapshot, design.designFamilyId, nationId);
  let derived = false;
  let failed: string[] = [];
  if (baseline !== null) {
    const baseDraft = baseline.sourceDraft as unknown as DesignDraft;
    const a = assessSimilarity(
      similarityProfile(compileDesign(baseDraft, env.ctx), baseDraft, content.plants),
      similarityProfile(candidate.compiled, candidate.draft, content.plants),
    );
    derived = a.derived;
    failed = [...a.failed];
  }
  const existingFamily = snapshot["designFamilies"].has(design.designFamilyId);
  // Section 17: a design that is not similar to its family's baseline starts a new family.
  const designFamilyId =
    existingFamily && !derived
      ? `fam_${design.designVersionId.replace(/^des_/, "")}`.slice(0, 64)
      : design.designFamilyId;
  const terms = studyTerms(Number(design.constructionCostUnits ?? 0), derived, study);
  const identity = {
    designStudyId: `study_${design.designVersionId}`,
    nationId,
    baselineDesignVersionId: derived && baseline ? baseline.designVersionId : "NONE",
    designFamilyId,
    baseStudyWork: terms.baseStudyWork,
    baseStudyCost: money(terms.baseStudyCost),
    discountBp: bp(terms.discountBp),
    finalStudyWork: terms.finalStudyWork,
    finalStudyCost: money(terms.finalStudyCost),
    startMonth: month,
    rulesetVersion: snapshot["rulesetVersion"],
    formulaVersion: "design_study_v1" as const,
  };
  const entry: DesignStudy = {
    ...identity,
    builderContext: "NATIONAL",
    newFamily: !(existingFamily && derived),
    derived,
    failedCriteria: failed,
    workDone: 0,
    costPaid: money(0),
    status: "IN_PROGRESS",
    completionMonth: null,
    projectHash: sha256Hex(canonicalSerialize(identity)),
    design: { ...design, designFamilyId },
  };
  return entry;
}

/** Opens the study `planDesignStudy` describes, on the nation's study list. Pure. */
export function startDesignStudy(
  snapshot: CampaignSnapshot,
  nationId: string,
  design: CompiledDesignVersion,
  candidate: { readonly compiled: CompiledDesign; readonly draft: DesignDraft },
  content: ShipBuildingContent,
  month: string,
): CampaignSnapshot {
  const entry = planDesignStudy(snapshot, nationId, design, candidate, content, month);
  const nation = snapshot["nations"].get(nationId)!;
  const nations = new Map(snapshot["nations"]);
  nations.set(nationId, { ...nation, designStudies: [...(nation.designStudies ?? []), entry] });
  return { ...snapshot, nations };
}

/** True when some nation already has a study (in progress or done) for this design version id. */
export function studyExists(snapshot: CampaignSnapshot, designVersionId: string): boolean {
  for (const n of snapshot["nations"].values())
    if ((n.designStudies ?? []).some((s) => s.design.designVersionId === designVersionId))
      return true;
  return false;
}

/** The approved design and its family enter the snapshot (the same shape `SubmitDesign` produced before studies). */
function approve(snapshot: CampaignSnapshot, s: DesignStudy, month: string): CampaignSnapshot {
  const design = s.design;
  const existing = snapshot["designFamilies"].get(s.designFamilyId);
  const family: DesignFamily = existing
    ? {
        ...existing,
        memberDesignVersionIds: [...existing.memberDesignVersionIds, design.designVersionId],
      }
    : {
        designFamilyId: s.designFamilyId,
        nationId: s.nationId,
        rootDesignVersionId: design.designVersionId,
        memberDesignVersionIds: [design.designVersionId],
        familyCreationMonth: month,
      };
  return {
    ...snapshot,
    designs: new Map([...snapshot["designs"], [design.designVersionId, design]]),
    designFamilies: new Map([...snapshot["designFamilies"], [family.designFamilyId, family]]),
  };
}

/**
 * Pays this month's study work, nation by nation and study by study (id order), before construction is funded. A study
 * advances one month of work when `ceil(remaining cost / remaining months)` is affordable from the treasury above its
 * expense reserve; otherwise it makes no progress this month (DESIGN-21 section 3). A study finishing approves its design.
 */
export function fundDesignStudies(ctx: MonthContext): void {
  const { campaignMonth, eventLedger, financialLedger, nextSeq } = ctx;
  for (const [nationId, start] of ctx.currentSnapshot["nations"]) {
    const open = (start.designStudies ?? []).filter((s) => s.status === "IN_PROGRESS");
    if (open.length === 0) continue;
    let nation: NationState = start;
    for (const s of [...open].sort((a, b) => (a.designStudyId < b.designStudyId ? -1 : 1))) {
      const remainingWork = s.finalStudyWork - s.workDone;
      const remainingCost = s.finalStudyCost - s.costPaid;
      const cost = Math.ceil(remainingCost / remainingWork);
      const available = Number(nation.treasury) - Number(nation.expenses);
      if (cost > available) continue;
      const previousTreasury = nation.treasury;
      const newTreasury = SafeInt.sub(previousTreasury, SafeInt(cost));
      const done = s.workDone + 1 === s.finalStudyWork;
      const next: DesignStudy = {
        ...s,
        workDone: s.workDone + 1,
        costPaid: money(s.costPaid + cost),
        ...(done ? { status: "COMPLETED" as const, completionMonth: campaignMonth } : {}),
      };
      nation = {
        ...nation,
        treasury: newTreasury,
        designStudies: (nation.designStudies ?? []).map((x) =>
          x.designStudyId === s.designStudyId ? next : x,
        ),
      };
      const nations = new Map(ctx.currentSnapshot["nations"]);
      nations.set(nationId, nation);
      ctx.currentSnapshot = { ...ctx.currentSnapshot, nations };
      if (done) ctx.currentSnapshot = approve(ctx.currentSnapshot, next, campaignMonth);
      if (cost > 0) {
        const reason = `Design study for ${s.design.className}${done ? " (completed)" : ""}`;
        financialLedger.append(
          makeLedgerEntry(
            nationId,
            "appropriation",
            DESIGN_STUDY_CATEGORY,
            SafeInt(cost),
            SafeInt(cost),
            previousTreasury,
            newTreasury,
            reason,
            campaignMonth,
          ),
        );
        eventLedger.append(
          budgetChangedEvent(
            nationId,
            previousTreasury,
            newTreasury,
            SafeInt(-cost),
            reason,
            nextSeq(),
            campaignMonth,
          ),
        );
      }
    }
  }
}
