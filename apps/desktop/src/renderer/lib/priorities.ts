import type { PrioritySeverity, StrategicPriority } from "@bluewave/campaign-engine";

export function countActiveAlerts(priorities: readonly StrategicPriority[]): number {
  return priorities.filter((p) => p.severity === "warning" || p.severity === "critical").length;
}

export const SEVERITY_LABELS: Readonly<Record<PrioritySeverity, string>> = {
  critical: "Critical",
  warning: "Warning",
  advisory: "Advisory",
  information: "Information",
};

export const SEVERITY_VARIANT = {
  critical: "destructive",
  warning: "default",
  advisory: "secondary",
  information: "outline",
} as const satisfies Record<PrioritySeverity, string>;

const DESTINATION_LABELS: Readonly<Record<StrategicPriority["destination"], string>> = {
  overview: "Overview",
  construction: "Construction",
  fleet: "Fleet",
  research: "Research",
  diplomacy: "Diplomacy & War",
};

export function destinationLabel(destination: StrategicPriority["destination"]): string {
  return DESTINATION_LABELS[destination];
}
