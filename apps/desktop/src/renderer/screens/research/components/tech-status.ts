import {
  Check,
  CalendarClock,
  CircleDashed,
  Lock,
  Microscope,
  type LucideIcon,
} from "lucide-react";
import type { ResearchTechStatus } from "@bluewave/campaign-engine";

export interface TechStatusStyle {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly node: string;
  readonly iconTone: string;
}

export const TECH_STATUS: Readonly<Record<ResearchTechStatus, TechStatusStyle>> = {
  discovered: {
    label: "Discovered",
    icon: Check,
    node: "border-primary/50 bg-primary/10",
    iconTone: "text-primary",
  },
  researching: {
    label: "Researching",
    icon: Microscope,
    node: "border-primary bg-card ring-2 ring-primary/30",
    iconTone: "text-primary",
  },
  open: {
    label: "Open",
    icon: CircleDashed,
    node: "border-border bg-card hover:border-primary/60",
    iconTone: "text-foreground",
  },
  locked: {
    label: "Locked",
    icon: Lock,
    node: "border-dashed border-border bg-muted/30 text-muted-foreground",
    iconTone: "text-muted-foreground",
  },
  future: {
    label: "Not yet invented",
    icon: CalendarClock,
    node: "border-dashed border-border bg-muted/20 text-muted-foreground",
    iconTone: "text-muted-foreground",
  },
};

export const TECH_STATUS_ORDER: readonly ResearchTechStatus[] = [
  "discovered",
  "researching",
  "open",
  "locked",
  "future",
];
