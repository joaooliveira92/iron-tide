import type { OutflowSettlement } from "@bluewave/campaign";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

/**
 * A shortfall is a legal, recorded, non-carried state (spec #138 deficit policy): the unpaid remainder of an outflow is
 * reported as a warning for every outflow kind — obligation, maintenance and research alike — never silently clamped.
 */
export function reportOutflowShortfall(
  collector: DiagnosticCollector,
  nationId: string,
  kind: "obligation" | "maintenance" | "research",
  settlement: OutflowSettlement,
  stage: string,
): void {
  if ((settlement.shortfall as number) <= 0) return;
  collector.addWarning(
    "OUTFLOW_SHORTFALL",
    `Nation ${nationId} could not pay ${kind}: requested ${String(settlement.requested)}, paid ${String(settlement.paid)}, shortfall ${String(settlement.shortfall)}`,
    { stage, entityId: nationId },
  );
}
