// Re-runs DESIGN-22 intended/natural classification on a finished rebuild's new design before the
// completion is committed (DESIGN-22 section 22, DESIGN-23 section 22).
import type { CompiledDesignVersion } from "@bluewave/campaign";
import {
  CLASSIFICATION_REJECTION_IDS,
  compileDesign,
  type DesignDraft,
  type ShipBuildingContent,
} from "@bluewave/ship-design";

/** The outcome of re-running classification on a rebuild's new design. */
export interface RebuildClassificationCheck {
  /** True when the rebuilt design may complete, or when there is nothing to re-run. */
  readonly ok: boolean;
  /** Stable ids explaining a failure: the blocking classification findings, or the reason none could run. */
  readonly reasons: readonly string[];
}

/**
 * Re-runs DESIGN-22 intended/natural classification on a rebuild's new design. The design version is immutable, so its
 * source draft is compiled again under the current content and campaign month: a ruleset, technology or content change
 * since the order is honoured, and an intended type that has become illegal or a natural type that no longer matches is
 * caught. A design with no source draft is an authored one (never a rebuild target, and legacy snapshots must still
 * complete), so there is nothing to re-run. Pure and deterministic; never throws.
 */
export function checkRebuildClassification(
  design: CompiledDesignVersion | undefined,
  content: ShipBuildingContent | undefined,
  month: string,
): RebuildClassificationCheck {
  const draft = design?.sourceDraft as DesignDraft | undefined;
  if (draft === undefined) return { ok: true, reasons: [] };
  if (content === undefined) return { ok: false, reasons: ["SHIP_BUILDING_CONTENT_MISSING"] };
  try {
    const compiled = compileDesign(draft, content.environmentFor(month).ctx);
    const reasons = compiled.findings
      .filter((f) => f.severity === "BLOCKING" && CLASSIFICATION_REJECTION_IDS.includes(f.id))
      .map((f) => f.id);
    return { ok: reasons.length === 0, reasons };
  } catch (error) {
    return { ok: false, reasons: [error instanceof Error ? error.message : String(error)] };
  }
}
