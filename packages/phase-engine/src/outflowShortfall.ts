import type { OutflowSettlement } from "@bluewave/campaign";
import type { DiagnosticCollector } from "@bluewave/diagnostics";

export function reportOutflowShortfall(
  collector: DiagnosticCollector,
  nationId: string,
  kind: "obligation" | "maintenance" | "research" | "preservation",
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
