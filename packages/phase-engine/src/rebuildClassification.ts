import type { CompiledDesignVersion } from "@bluewave/campaign";
import {
  CLASSIFICATION_REJECTION_IDS,
  compileDesign,
  type DesignDraft,
  type ShipBuildingContent,
} from "@bluewave/ship-design";

export interface RebuildClassificationCheck {
  readonly ok: boolean;
  readonly reasons: readonly string[];
}

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
