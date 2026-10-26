import type { PrioritySeverity, StrategicPriority } from "@bluewave/campaign-engine";
import {
  Anchor,
  Coins,
  Flame,
  FlaskConical,
  Hammer,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";

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

export const PRIORITY_TYPE_ICON: Readonly<Record<StrategicPriority["type"], LucideIcon>> = {
  monthly_deficit: TrendingDown,
  critical_cash_reserve: Coins,
  low_research_spending: FlaskConical,
  construction_near_completion: Hammer,
  high_foreign_tension: Flame,
  no_active_construction: Anchor,
};

export interface PrioritySeverityStyle {
  readonly row: string;
  readonly rowStatic: string;
  readonly tile: string;
  readonly label: string;
}

export const PRIORITY_SEVERITY_STYLE: Readonly<Record<PrioritySeverity, PrioritySeverityStyle>> = {
  critical: {
    row: "border-destructive/50 bg-destructive/10 hover:bg-destructive/15",
    rowStatic: "border-destructive/50 bg-destructive/10",
    tile: "bg-destructive/20 text-destructive",
    label: "text-destructive",
  },
  warning: {
    row: "border-warning/40 bg-warning/5 hover:bg-warning/10",
    rowStatic: "border-warning/40 bg-warning/5",
    tile: "bg-warning/20 text-warning",
    label: "text-warning",
  },
  advisory: {
    row: "border-border bg-muted/30 hover:bg-muted/60",
    rowStatic: "border-border bg-muted/30",
    tile: "bg-muted text-muted-foreground",
    label: "text-muted-foreground",
  },
  information: {
    row: "border-border bg-muted/30 hover:bg-muted/60",
    rowStatic: "border-border bg-muted/30",
    tile: "bg-primary/15 text-primary",
    label: "text-muted-foreground",
  },
};
