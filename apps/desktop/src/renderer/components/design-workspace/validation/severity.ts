import { SEVERITY_ORDER, type Severity } from "@bluewave/ship-design";
import { Info, OctagonX, ShieldAlert, TriangleAlert, type LucideIcon } from "lucide-react";

export { SEVERITY_ORDER };

export type MarkerShape = "octagon" | "diamond" | "triangle" | "circle";

export interface SeverityStyle {
  readonly label: string;
  readonly Icon: LucideIcon;
  readonly tone: string;
  readonly fill: string;
  readonly shape: MarkerShape;
  readonly badge: "destructive" | "secondary" | "outline";
}

export const SEVERITY_STYLE: { readonly [S in Severity]: SeverityStyle } = {
  BLOCKING: {
    label: "Blocking",
    Icon: OctagonX,
    tone: "text-destructive",
    fill: "fill-destructive stroke-background",
    shape: "octagon",
    badge: "destructive",
  },
  CRITICAL: {
    label: "Critical",
    Icon: ShieldAlert,
    tone: "text-destructive",
    fill: "fill-destructive stroke-background",
    shape: "diamond",
    badge: "destructive",
  },
  WARNING: {
    label: "Warning",
    Icon: TriangleAlert,
    tone: "text-warning",
    fill: "fill-warning stroke-foreground",
    shape: "triangle",
    badge: "secondary",
  },
  ADVISORY: {
    label: "Advisory",
    Icon: Info,
    tone: "text-info",
    fill: "fill-info stroke-background",
    shape: "circle",
    badge: "outline",
  },
};

export const severityRank = (s: Severity): number => SEVERITY_ORDER.indexOf(s);

export const FINDING_CLASSES = ["blocking", "warning", "advisory"] as const;
export type FindingClass = (typeof FINDING_CLASSES)[number];

export const CLASS_OF: { readonly [S in Severity]: FindingClass } = {
  BLOCKING: "blocking",
  CRITICAL: "blocking",
  WARNING: "warning",
  ADVISORY: "advisory",
};

export const CLASS_LABEL: { readonly [C in FindingClass]: string } = {
  blocking: "Blocking errors",
  warning: "Warnings",
  advisory: "Advisory observations",
};

export const SEVERITY_FILTERS = ["all", "serious", "warning", "advisory"] as const;
export type SeverityFilter = (typeof SEVERITY_FILTERS)[number];

export const FILTER_LABEL: { readonly [F in SeverityFilter]: string } = {
  all: "All severities",
  serious: "Blocking and critical",
  warning: "Warnings",
  advisory: "Advisories",
};

export function passesFilter(s: Severity, filter: SeverityFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "serious":
      return s === "BLOCKING" || s === "CRITICAL";
    case "warning":
      return s === "WARNING";
    case "advisory":
      return s === "ADVISORY";
  }
}
