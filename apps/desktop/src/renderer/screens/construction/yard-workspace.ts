import type { LucideIcon } from "lucide-react";
import { Anchor, LayoutGrid, ScrollText, Waves } from "lucide-react";
import type { CompiledDesignVersion } from "@bluewave/campaign-engine";
import { KG_PER_TONNE } from "../../lib/presentation-format/units.js";
import type { PresentationFormat } from "../../lib/presentation-format/index.js";
import type { EngineeringReadout } from "../shipbuilding/engineering-status.js";
import type { ConstructionScreenProjection } from "../../../shared/construction-contract.js";
import type { ProjectRow } from "./project-progress.js";

export type YardPlaceId = "slipways" | "catalog" | "orders" | "dock";

export interface YardTab {
  readonly id: string;
  readonly label: string;
}

export interface YardPlace {
  readonly id: YardPlaceId;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tabs: readonly YardTab[];
}

export const YARD_PLACES: readonly YardPlace[] = [
  {
    id: "slipways",
    label: "Slipways",
    icon: Waves,
    tabs: [
      { id: "project", label: "Ship" },
      { id: "yard", label: "Yard" },
    ],
  },
  {
    id: "catalog",
    label: "Design catalog",
    icon: LayoutGrid,
    tabs: [
      { id: "design", label: "Design" },
      { id: "order", label: "Order" },
    ],
  },
  {
    id: "orders",
    label: "Orders",
    icon: ScrollText,
    tabs: [
      { id: "command", label: "Order" },
      { id: "yard", label: "Yard" },
    ],
  },
  {
    id: "dock",
    label: "Dock",
    icon: Anchor,
    tabs: [{ id: "yard", label: "Yard" }],
  },
];

export const placeOf = (id: YardPlaceId): YardPlace =>
  YARD_PLACES.find((place) => place.id === id) ?? YARD_PLACES[0]!;

export type RailTone = "quiet" | "attention" | "alert";

export interface RailMark {
  readonly text: string;
  readonly meaning: string;
  readonly tone: RailTone;
}

export interface YardFigures {
  readonly projects: readonly ProjectRow[];
  readonly designs: readonly CompiledDesignVersion[];
  readonly commands: ConstructionScreenProjection["workspace"]["commands"];
  readonly economy: ConstructionScreenProjection["economy"];
}

export const isBuilding = (row: ProjectRow): boolean => row.status !== "COMPLETED";

export function railMarks(figures: YardFigures): Readonly<Record<YardPlaceId, RailMark>> {
  const building = figures.projects.filter(isBuilding);
  const held = building.filter((row) => HELD_STATUSES.has(row.status)).length;
  const submitted = figures.commands.filter((command) => command.status === "submitted").length;
  const open = figures.designs.filter((design) => design.available).length;
  const { committedNewConstructionMassKg: used, maxConcurrentConstructionMassKg: cap } =
    figures.economy;
  return {
    slipways: {
      text: String(building.length),
      meaning: `${building.length} building${held > 0 ? `, ${held} held` : ""}`,
      tone: held > 0 ? "attention" : "quiet",
    },
    catalog: { text: String(open), meaning: `${open} available`, tone: "quiet" },
    orders: {
      text: String(submitted),
      meaning: `${submitted} awaiting the month`,
      tone: submitted > 0 ? "attention" : "quiet",
    },
    dock: {
      text: used > cap ? "!" : "–",
      meaning: used > cap ? "over the concurrency cap" : "within the concurrency cap",
      tone: used > cap ? "alert" : "quiet",
    },
  };
}

export const HELD_STATUSES: ReadonlySet<string> = new Set([
  "HALTED",
  "DELAYED",
  "AWAITING_CAPACITY",
]);

export type StatusTone = "live" | "fast" | "held" | "bad" | "done";

export const STATUS_META: Readonly<Record<string, { label: string; tone: StatusTone }>> = {
  ACTIVE: { label: "active", tone: "live" },
  ACCELERATED: { label: "accelerated", tone: "fast" },
  HALTED: { label: "halted", tone: "held" },
  DELAYED: { label: "delayed", tone: "held" },
  AWAITING_CAPACITY: { label: "awaiting capacity", tone: "held" },
  IMPOUNDED: { label: "impounded", tone: "bad" },
  COMPLETED: { label: "completed", tone: "done" },
};

export const statusMeta = (status: string): { label: string; tone: StatusTone } =>
  STATUS_META[status] ?? { label: status.toLowerCase().replaceAll("_", " "), tone: "live" };

export interface DockGauge {
  readonly capKg: number;
  readonly usedKg: number;
  readonly exemptKg: number;
  readonly freeKg: number;
  readonly usedPct: number;
  readonly hullPct: number | null;
  readonly over: boolean;
}

const clampPct = (value: number): number => Math.max(0, Math.min(100, value));

export type DockFigures = Pick<
  ConstructionScreenProjection["economy"],
  | "maxConcurrentConstructionMassKg"
  | "committedNewConstructionMassKg"
  | "exemptNewConstructionMassKg"
  | "dockMaxBuildDisplacementKg"
>;

export function dockGauge(economy: DockFigures): DockGauge {
  const cap = economy.maxConcurrentConstructionMassKg;
  const used = economy.committedNewConstructionMassKg;
  const hull = economy.dockMaxBuildDisplacementKg;
  return {
    capKg: cap,
    usedKg: used,
    exemptKg: economy.exemptNewConstructionMassKg,
    freeKg: Math.max(0, cap - used),
    usedPct: cap > 0 ? clampPct((used / cap) * 100) : used > 0 ? 100 : 0,
    hullPct: hull === null || cap <= 0 ? null : clampPct((hull / cap) * 100),
    over: used > cap,
  };
}

export interface DesignFit {
  readonly massKg: number;
  readonly dockPct: number | null;
  readonly overDock: boolean;
  readonly freeTreasury: number;
  readonly freeCapacity: number;
  readonly affordable: boolean;
  readonly fitsCapacity: boolean;
  readonly costPct: number;
}

export function designFit(
  design: CompiledDesignVersion,
  economy: ConstructionScreenProjection["economy"],
  workspace: ConstructionScreenProjection["workspace"],
): DesignFit {
  const massKg = design.mass * KG_PER_TONNE;
  const dock = economy.dockMaxBuildDisplacementKg;
  const freeTreasury = economy.treasury - workspace.treasuryReserved;
  const freeCapacity = economy.shipyardCapacity - workspace.capacityReserved;
  return {
    massKg,
    dockPct: dock === null || dock <= 0 ? null : clampPct((massKg / dock) * 100),
    overDock: dock !== null && massKg > dock,
    freeTreasury,
    freeCapacity,
    affordable: design.projectedCost <= freeTreasury,
    fitsCapacity: design.projectedCapacityUnits <= freeCapacity,
    costPct: freeTreasury > 0 ? clampPct((design.projectedCost / freeTreasury) * 100) : 100,
  };
}

export type CatalogSort = "year" | "size" | "cost" | "name";

export const CATALOG_SORTS: readonly { readonly id: CatalogSort; readonly label: string }[] = [
  { id: "year", label: "Newest first" },
  { id: "size", label: "Largest first" },
  { id: "cost", label: "Cheapest first" },
  { id: "name", label: "Name" },
];

const SORTERS: Readonly<
  Record<CatalogSort, (a: CompiledDesignVersion, b: CompiledDesignVersion) => number>
> = {
  year: (a, b) => b.year - a.year,
  size: (a, b) => b.mass - a.mass,
  cost: (a, b) => a.projectedCost - b.projectedCost,
  name: (a, b) => a.className.localeCompare(b.className),
};

export function catalogShipTypes(designs: readonly CompiledDesignVersion[]): readonly string[] {
  return [...new Set(designs.map((design) => design.shipType))].sort();
}

export function catalogView(
  designs: readonly CompiledDesignVersion[],
  shipType: string | null,
  sort: CatalogSort,
): readonly CompiledDesignVersion[] {
  const compare = SORTERS[sort];
  return designs
    .filter((design) => shipType === null || design.shipType === shipType)
    .toSorted(
      (a, b) =>
        Number(b.available) - Number(a.available) ||
        compare(a, b) ||
        a.className.localeCompare(b.className) ||
        a.designId.localeCompare(b.designId),
    );
}

export function nextProjectSelection(
  current: string | null,
  rows: readonly ProjectRow[],
): string | null {
  return current !== null && rows.some((row) => row.projectId === current) ? current : null;
}

const mass = (format: PresentationFormat, kg: number): string =>
  format.measurement(kg, "mass", { maximumFractionDigits: 0 });

const share = (format: PresentationFormat, part: number, whole: number): string =>
  `${format.number(whole > 0 ? (part / whole) * 100 : 0, { maximumFractionDigits: 1 })}%`;

const toneOfLoad = (used: number, total: number): EngineeringReadout["tone"] =>
  used > total ? "bad" : total > 0 && used / total >= 0.85 ? "warn" : "neutral";

export function yardReadouts(
  figures: YardFigures,
  workspace: ConstructionScreenProjection["workspace"],
  format: PresentationFormat,
): readonly EngineeringReadout[] {
  const { economy, projects } = figures;
  const building = projects.filter(isBuilding);
  const accelerated = building.filter((row) => row.status === "ACCELERATED").length;
  const held = building.filter((row) => HELD_STATUSES.has(row.status)).length;
  const gauge = dockGauge(economy);
  const freeTreasury = economy.treasury - workspace.treasuryReserved;
  const freeCapacity = economy.shipyardCapacity - workspace.capacityReserved;
  return [
    {
      id: "treasury",
      label: "Treasury",
      value: format.money(economy.treasury),
      tone: toneOfLoad(workspace.treasuryReserved, economy.treasury),
      breakdown: {
        title: "Treasury committed to construction this month",
        rows: [
          { label: "In the treasury", value: format.money(economy.treasury) },
          { label: "Reserved by orders", value: format.money(workspace.treasuryReserved) },
        ],
        footer: [
          { label: "Free to commit", value: format.money(freeTreasury) },
          {
            label: "Committed",
            value: share(format, workspace.treasuryReserved, economy.treasury),
          },
        ],
        causes:
          freeTreasury < 0
            ? ["Reservations exceed the treasury; an order that cannot be paid is refused."]
            : [],
      },
    },
    {
      id: "appropriation",
      label: "Appropriation",
      value: `${format.money(economy.monthlyAppropriation)}/mo`,
      tone: "neutral",
      hint: {
        title: "Monthly appropriation",
        lines: [
          { label: "Granted each month", value: format.money(economy.monthlyAppropriation) },
          {
            label: "Months of cover",
            value:
              economy.monthlyAppropriation > 0
                ? format.number(economy.treasury / economy.monthlyAppropriation, {
                    maximumFractionDigits: 1,
                  })
                : "none",
          },
        ],
      },
    },
    {
      id: "capacity",
      label: "Yard capacity",
      value: `${format.count(workspace.capacityReserved)} / ${format.count(economy.shipyardCapacity)}`,
      tone: toneOfLoad(workspace.capacityReserved, economy.shipyardCapacity),
      breakdown: {
        title: "Drydock capacity committed this month",
        rows: [
          { label: "Total capacity", value: format.count(economy.shipyardCapacity) },
          { label: "Reserved by orders", value: format.count(workspace.capacityReserved) },
        ],
        footer: [{ label: "Available", value: format.count(freeCapacity) }],
        causes:
          freeCapacity < 0
            ? ["Reservations exceed capacity; further orders are refused as insufficient."]
            : [],
      },
    },
    {
      id: "building",
      label: "Building",
      value: `${building.length} ${building.length === 1 ? "ship" : "ships"}`,
      tone: held > 0 ? "warn" : "neutral",
      hint: {
        title: "Ships on the slipways",
        lines: [
          { label: "Under way", value: String(building.length - held) },
          { label: "Accelerated", value: String(accelerated) },
          { label: "Held", value: String(held) },
        ],
      },
    },
    {
      id: "dock",
      label: "Largest hull",
      value:
        economy.dockMaxBuildDisplacementKg === null
          ? "no dock"
          : mass(format, economy.dockMaxBuildDisplacementKg),
      tone: "neutral",
      hint: {
        title: "Dock",
        lines: [
          {
            label: "Expansion time",
            value: `${format.count(economy.dockExpansionDurationMonths)} months`,
          },
          {
            label: "Next step",
            value:
              economy.dockExpansionNextStepKg === null
                ? "no era step"
                : mass(format, economy.dockExpansionNextStepKg),
          },
        ],
      },
    },
    {
      id: "ways",
      label: "On the ways",
      value: `${mass(format, gauge.usedKg)} / ${mass(format, gauge.capKg)}`,
      tone: toneOfLoad(gauge.usedKg, gauge.capKg),
      breakdown: {
        title: "New tonnage under construction at once",
        rows: [
          { label: "Concurrency cap", value: mass(format, gauge.capKg) },
          { label: "Counted against it", value: mass(format, gauge.usedKg) },
          { label: "Exempt (AMC / small corvette)", value: mass(format, gauge.exemptKg) },
        ],
        footer: [{ label: "Room left", value: mass(format, gauge.freeKg) }],
        causes: gauge.over ? ["Tonnage in use is over the concurrency cap."] : [],
      },
    },
  ];
}
