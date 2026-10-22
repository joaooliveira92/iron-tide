import { ARCHETYPE_DIMENSIONS, type ArchetypeDimension } from "@bluewave/campaign-engine";
import { Coins, Factory, Swords, type LucideIcon } from "lucide-react";

export interface ArchetypeDimensionDescriptor {
  readonly dimension: ArchetypeDimension;
  readonly label: string;
  readonly hint: string;
  readonly icon: LucideIcon;
  readonly accentClassName: string;
  readonly barClassName: string;
}

const DESCRIPTORS: Readonly<Record<ArchetypeDimension, ArchetypeDimensionDescriptor>> = {
  economy: {
    dimension: "economy",
    label: "Economy",
    hint: "Starting treasury and monthly appropriation",
    icon: Coins,
    accentClassName: "text-sky-500",
    barClassName: "bg-sky-500",
  },
  industry: {
    dimension: "industry",
    label: "Industry",
    hint: "Shipyard capacity",
    icon: Factory,
    accentClassName: "text-amber-500",
    barClassName: "bg-amber-500",
  },
  combat: {
    dimension: "combat",
    label: "Combat",
    hint: "Battle power",
    icon: Swords,
    accentClassName: "text-rose-500",
    barClassName: "bg-rose-500",
  },
};

export const ARCHETYPE_DIMENSION_DESCRIPTORS: readonly ArchetypeDimensionDescriptor[] =
  ARCHETYPE_DIMENSIONS.map(archetypeDimensionDescriptor);

export function archetypeDimensionDescriptor(
  dimension: ArchetypeDimension,
): ArchetypeDimensionDescriptor {
  return DESCRIPTORS[dimension];
}

export function archetypeDimensionLabel(dimension: ArchetypeDimension): string {
  return DESCRIPTORS[dimension].label;
}
