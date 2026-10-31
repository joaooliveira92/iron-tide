import {
  Flag,
  GraduationCap,
  MapPinned,
  Network,
  Route,
  ScrollText,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { IndexTab } from "../../components/slate/IndexTabs.js";

export type FleetDepartment =
  | "organization"
  | "station"
  | "training"
  | "exercises"
  | "orders"
  | "areas"
  | "reports";

export interface FleetDepartmentMeta {
  readonly id: FleetDepartment;
  readonly label: string;
  readonly summary: string;
  readonly icon: LucideIcon;
  readonly width: "narrow" | "wide";
}

export interface FleetDepartmentFacts {
  readonly divisions: number;
  readonly orders: number;
  readonly areas: number;
  readonly stationsShort: number | null;
}

const GROUPS: readonly (readonly FleetDepartmentMeta[])[] = [
  [
    {
      id: "organization",
      label: "Organization",
      summary: "Create, regroup and dissolve divisions.",
      icon: Network,
      width: "wide",
    },
    {
      id: "station",
      label: "Station",
      summary: "Post ships to foreign stations or hold them in reserve.",
      icon: Flag,
      width: "wide",
    },
  ],
  [
    {
      id: "training",
      label: "Training",
      summary: "Fund special training for crews.",
      icon: GraduationCap,
      width: "wide",
    },
    {
      id: "exercises",
      label: "Exercises",
      summary: "Schedule the annual fleet exercise.",
      icon: Target,
      width: "wide",
    },
  ],
  [
    {
      id: "orders",
      label: "Orders",
      summary: "Movement commands sealed this month.",
      icon: Route,
      width: "narrow",
    },
    {
      id: "areas",
      label: "Areas",
      summary: "Ports, sea links and divisions in each area.",
      icon: MapPinned,
      width: "wide",
    },
    {
      id: "reports",
      label: "Reports",
      summary: "Losses, officers and features not yet modelled.",
      icon: ScrollText,
      width: "narrow",
    },
  ],
];

export function fleetDepartmentMeta(id: FleetDepartment): FleetDepartmentMeta {
  const found = GROUPS.flat().find((meta) => meta.id === id);
  if (found === undefined) throw new Error(`Unknown fleet department ${id}`);
  return found;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

function detail(
  id: FleetDepartment,
  facts: FleetDepartmentFacts,
): { readonly text: string; readonly attention: boolean } {
  switch (id) {
    case "organization":
      return { text: plural(facts.divisions, "division", "divisions"), attention: false };
    case "station":
      if (facts.stationsShort === null) return { text: "Not configured", attention: false };
      return facts.stationsShort === 0
        ? { text: "All covered", attention: false }
        : { text: `${facts.stationsShort} short`, attention: true };
    case "training":
      return { text: "Crew drills", attention: false };
    case "exercises":
      return { text: "Annual exercise", attention: false };
    case "orders":
      return facts.orders === 0
        ? { text: "None sealed", attention: false }
        : { text: `${facts.orders} sealed`, attention: true };
    case "areas":
      return { text: plural(facts.areas, "area", "areas"), attention: false };
    case "reports":
      return { text: "Losses, officers", attention: false };
  }
}

export function fleetIndexTabs(
  facts: FleetDepartmentFacts,
): readonly (readonly IndexTab<FleetDepartment>[])[] {
  return GROUPS.map((group) =>
    group.map((meta) => {
      const { text, attention } = detail(meta.id, facts);
      return { id: meta.id, label: meta.label, icon: meta.icon, detail: text, attention };
    }),
  );
}
