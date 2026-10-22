import type { CampaignSlot, CampaignSnapshot } from "@bluewave/campaign";
import { buildConstructionDesignCatalog } from "@bluewave/campaign-engine";
import {
  CommandIdempotencyMap,
  CommandLifecycle,
  type CommandBody,
  type CommandEnvelope,
} from "@bluewave/commands";
import {
  CANONICAL_RESEARCH_FIELD_IDS,
  RESEARCH_FIELD_PRIORITY_WEIGHTS,
} from "@bluewave/content-schema";
import { SafeInt } from "@bluewave/contracts";
import { canonicalSerialize, sha256Hex } from "@bluewave/deterministic";

export type DecisionFamily = "construction" | "design" | "research";

export interface DecisionProbeResult {
  readonly year: number;
  readonly family: DecisionFamily;
  readonly accepted: boolean;
  readonly commandType: string;
  readonly targetId: string;
  readonly reasonCode: string | null;
}

export interface ProbeReferenceDesign {
  readonly id: string;
  readonly month?: string;
  readonly draft?: {
    readonly nationId?: string;
  } & Readonly<Record<string, unknown>>;
}

export class DecisionProbeError extends Error {
  readonly _tag = "DecisionProbeError" as const;
  readonly year: number;
  readonly family: DecisionFamily;
  readonly reasonCode: string;

  constructor(year: number, family: DecisionFamily, reasonCode: string, message: string) {
    super(`${String(year)} ${family}: ${message}`);
    this.name = "DecisionProbeError";
    this.year = year;
    this.family = family;
    this.reasonCode = reasonCode;
  }
}

function envelope(
  commandId: string,
  snapshot: CampaignSnapshot,
  body: CommandBody,
): CommandEnvelope<CommandBody> {
  return {
    commandId,
    version: "0.1.0",
    expectedSnapshotHash: sha256Hex(canonicalSerialize(snapshot)),
    idempotencyKey: `ik-${commandId}`,
    timestamp: "n3-decision-probe",
    body,
  };
}

function outcomeOf(
  snapshot: CampaignSnapshot,
  slot: CampaignSlot,
  command: CommandEnvelope<CommandBody>,
): { readonly accepted: boolean; readonly reasonCode: string | null } {
  const outcome = new CommandLifecycle().process(
    command,
    snapshot,
    slot,
    new CommandIdempotencyMap(),
  );
  if (outcome.type === "success") return { accepted: true, reasonCode: null };
  if (outcome.type === "rejected") {
    return { accepted: false, reasonCode: outcome.diagnostic.code };
  }
  return { accepted: false, reasonCode: outcome.type.toUpperCase() };
}

function researchProbe(
  snapshot: CampaignSnapshot,
  slot: CampaignSlot,
  year: number,
): DecisionProbeResult {
  const fieldPriorities: Record<string, SafeInt> = {};
  CANONICAL_RESEARCH_FIELD_IDS.forEach((field, index) => {
    fieldPriorities[field] = SafeInt(
      index === 0 ? RESEARCH_FIELD_PRIORITY_WEIGHTS.HIGH : RESEARCH_FIELD_PRIORITY_WEIGHTS.LOW,
    );
  });
  const targetId = CANONICAL_RESEARCH_FIELD_IDS[0];
  const outcome = outcomeOf(
    snapshot,
    slot,
    envelope(`n3-probe-research-${String(year)}`, snapshot, {
      type: "SetResearchPriority",
      nationId: slot.nationId,
      fieldPriorities,
    }),
  );
  return {
    year,
    family: "research",
    accepted: outcome.accepted,
    commandType: "SetResearchPriority",
    targetId,
    reasonCode: outcome.reasonCode,
  };
}

function constructionProbe(
  snapshot: CampaignSnapshot,
  slot: CampaignSlot,
  year: number,
): DecisionProbeResult {
  const buildable = buildConstructionDesignCatalog(snapshot, slot.nationId, year).filter(
    (entry) => entry.available,
  );
  const design = buildable[0];
  if (design === undefined) {
    return {
      year,
      family: "construction",
      accepted: false,
      commandType: "OrderConstruction",
      targetId: "<none>",
      reasonCode: "NO_BUILDABLE_DESIGN",
    };
  }
  const outcome = outcomeOf(
    snapshot,
    slot,
    envelope(`n3-probe-construction-${String(year)}`, snapshot, {
      type: "OrderConstruction",
      nationId: slot.nationId,
      designVersionId: design.designId,
      quantity: 1,
    }),
  );
  return {
    year,
    family: "construction",
    accepted: outcome.accepted,
    commandType: "OrderConstruction",
    targetId: design.designId,
    reasonCode: outcome.reasonCode,
  };
}

function designProbe(
  snapshot: CampaignSnapshot,
  slot: CampaignSlot,
  year: number,
  referenceDesigns: readonly ProbeReferenceDesign[],
): DecisionProbeResult {
  const probeMonth = `${String(year)}-01`;
  const reference = [...referenceDesigns]
    .filter(
      (candidate) =>
        candidate.draft !== undefined &&
        candidate.draft.nationId === slot.nationId &&
        (candidate.month ?? "0000-00") <= probeMonth,
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  if (reference?.draft === undefined) {
    return {
      year,
      family: "design",
      accepted: false,
      commandType: "SubmitDesign",
      targetId: "<none>",
      reasonCode: "NO_REFERENCE_DESIGN",
    };
  }
  const buildable = buildConstructionDesignCatalog(snapshot, slot.nationId, year).find(
    (entry) => entry.available,
  );
  if (buildable === undefined) {
    return {
      year,
      family: "design",
      accepted: false,
      commandType: "SubmitDesign",
      targetId: reference.id,
      reasonCode: "NO_BUILDABLE_DESIGN",
    };
  }
  const { className, shipType: hullType, machineryType } = buildable;
  const outcome = outcomeOf(
    snapshot,
    slot,
    envelope(`n3-probe-design-${String(year)}`, snapshot, {
      type: "SubmitDesign",
      nationId: slot.nationId,
      designVersionId: `des_n3_probe_${String(year)}`,
      designFamilyId: `fam_n3_probe_${String(year)}`,
      className,
      hullType,
      machineryType,
      draft: { ...reference.draft, nationId: slot.nationId },
    }),
  );
  return {
    year,
    family: "design",
    accepted: outcome.accepted,
    commandType: "SubmitDesign",
    targetId: reference.id,
    reasonCode: outcome.reasonCode,
  };
}

export function probeDecisions(
  snapshot: CampaignSnapshot,
  slot: CampaignSlot,
  year: number,
  referenceDesigns: readonly ProbeReferenceDesign[],
): readonly DecisionProbeResult[] {
  const before = sha256Hex(canonicalSerialize(snapshot));
  const results = [
    researchProbe(snapshot, slot, year),
    constructionProbe(snapshot, slot, year),
    designProbe(snapshot, slot, year, referenceDesigns),
  ];
  const after = sha256Hex(canonicalSerialize(snapshot));
  if (before !== after) {
    throw new DecisionProbeError(
      year,
      "research",
      "SNAPSHOT_MUTATED",
      "probing a decision mutated the snapshot",
    );
  }
  return results;
}

export function assertDecisionProbes(year: number, results: readonly DecisionProbeResult[]): void {
  for (const family of ["research", "construction", "design"] as const) {
    const result = results.find((candidate) => candidate.family === family);
    if (result === undefined) {
      throw new DecisionProbeError(year, family, "MISSING_PROBE", "no probe was run");
    }
    if (!result.accepted) {
      throw new DecisionProbeError(
        year,
        family,
        result.reasonCode ?? "REJECTED",
        `${result.commandType} on ${result.targetId} was rejected (${result.reasonCode ?? "REJECTED"})`,
      );
    }
  }
}
