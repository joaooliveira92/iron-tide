import type { PlayerProjection } from "@bluewave/campaign-engine";

import { economyStatusLabel, researchNote } from "../lib/economy-wording.js";

/**
 * Pure view model for the bottom status strip (campaign-command-screen CC-3, ADR-0059 s1).
 * Every value is real or derived from `inspectCampaign` / `inspectMap`; anything the engine does
 * not model is a visible "Not yet modelled" row with its reason, never a number.
 *
 * Foreign-station rule (`FOREIGN_STATION_RULE_V1`): a ship counts in an area held by another nation
 * (not own areas or open sea). Tonnage is the sum of design displacement in metric tons, shown only
 * when every ship in the sum has one; the count is always shown.
 */
export const FOREIGN_STATION_RULE_V1 = "controlled-by-another-nation";

const groupDigits = new Intl.NumberFormat("en-GB", { useGrouping: true });

/** Exact, grouped money ("-£1,200"): the strip is for reading figures, so it never abbreviates. */
export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return `${value < 0 ? "-" : ""}£${groupDigits.format(Math.abs(value))}`;
}

export const NOT_YET_MODELLED = "Not yet modelled";

export type StripTone = "normal" | "alert";

export interface StripRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly deferred: boolean;
  /** A reason (deferred rows) or a caveat (proxy rows); empty when there is nothing to add. */
  readonly note: string;
  readonly tone: StripTone;
  /** A text status shown beside the value so tone is never the only signal. */
  readonly status?: string;
}

export interface StatusStripSummary {
  readonly balance: { readonly value: string; readonly status: string; readonly tone: StripTone };
  readonly treasury: string;
  readonly alerts: string;
}

export interface AllocationSegment {
  readonly id: "obligations" | "maintenance" | "research" | "construction";
  readonly label: string;
  readonly value: string;
  /** `committed` lines are charged every month; `planned` is the "up to" construction bound. */
  readonly kind: "committed" | "planned";
  /** Share of the monthly appropriation as a whole-number percent, or "—" when there is none. */
  readonly percent: string;
  /** Bar width as a fraction (0..1) of the bar's scale: the larger of appropriation and outlay. */
  readonly fraction: number;
  /** Share of the committed total ("—" for the planned construction bound, which is not in it). */
  readonly shareOfCommitted: string;
  /** The line over twelve months, so a monthly figure can be read as a yearly commitment. */
  readonly yearly: string;
}

/** How the monthly appropriation is spent, for the stacked bar and its legend. */
export interface BudgetAllocation {
  readonly appropriation: string;
  readonly segments: readonly AllocationSegment[];
  readonly committed: { readonly value: string; readonly percent: string };
  /** Committed lines alone exceed the appropriation. */
  readonly overCommitted: boolean;
}

/** One step of the monthly waterfall: the appropriation less each committed line down to the balance. */
export interface WaterfallStep {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  /** Running remainder after this step, as money. */
  readonly remainder: string;
  /** Running remainder as a fraction (0..1) of the appropriation, clamped for drawing. */
  readonly remainderFraction: number;
}

/** The numbers behind the balance and treasury hovers. */
export interface OutlookDetail {
  readonly appropriation: string;
  readonly steps: readonly WaterfallStep[];
  readonly balance: { readonly value: string; readonly status: string; readonly tone: StripTone };
  /** The balance with construction spent at its upper bound: the worst case the treasury must carry. */
  readonly afterConstruction: { readonly value: string; readonly tone: StripTone };
  readonly treasury: string;
  readonly monthEndTreasury: string;
  readonly runway: string | null;
  readonly shortfall: string | null;
  readonly research: { readonly requested: string; readonly cap: string; readonly note: string };
}

export interface StationShip {
  readonly name: string;
  /** Displacement in metric tons, or null when the ship's design is not loaded. */
  readonly tons: number | null;
}

export interface ForeignStationGroup {
  readonly areaId: string;
  readonly areaName: string;
  readonly controller: string;
  readonly ships: readonly StationShip[];
  /** The group's tonnage, or null when any of its ships has none (a partial sum would mislead). */
  readonly tons: string | null;
}

/** Where the player's ships sit, for the "ships on foreign stations" hover. */
export interface StationDetail {
  readonly total: number;
  readonly foreign: number;
  /** Tonnage of every foreign-station ship, or null when any of them has none. */
  readonly foreignTons: string | null;
  /** Tonnage of the whole fleet, or null when any ship has none. */
  readonly totalTons: string | null;
  /** Foreign share of the fleet by tonnage (0..1) when both are known, else null. */
  readonly foreignTonsFraction: number | null;
  readonly foreignGroups: readonly ForeignStationGroup[];
  /** True when the map could not be read, so the split is unknown. */
  readonly unknown: boolean;
}

export interface PortDetail {
  readonly id: string;
  readonly name: string;
  readonly areaName: string;
  readonly capacity: number;
  /** Fraction (0..1) of the largest port, for a comparative bar. */
  readonly fraction: number;
}

export interface StatusStripModel {
  readonly nationName: string;
  readonly outlook: OutlookDetail;
  readonly stations: StationDetail;
  readonly ports: readonly PortDetail[];
  readonly allocation: BudgetAllocation;
  readonly nation: readonly StripRow[];
  readonly budget: readonly StripRow[];
  /** Every deferred row from both groups, for the single "Not yet modelled" disclosure. */
  readonly deferredRows: readonly StripRow[];
  readonly summary: StatusStripSummary;
}

export type StatusStripAreas = readonly {
  readonly id: string;
  readonly name?: string;
  readonly controller: string | null;
}[];

export interface StatusStripInput {
  readonly projection: PlayerProjection;
  /** `inspectMap` areas, or null when the map could not be read. */
  readonly areas: StatusStripAreas | null;
  /** Engine alert count, or null when the priorities projection is unavailable. */
  readonly alertsCount: number | null;
}

function real(id: string, label: string, value: string, note = "", tone: StripTone = "normal") {
  return { id, label, value, deferred: false, note, tone } satisfies StripRow;
}

function deferred(id: string, label: string, reason: string): StripRow {
  return { id, label, value: NOT_YET_MODELLED, deferred: true, note: reason, tone: "normal" };
}

/** "11,880 t", the one tonnage format on the strip. */
export function formatTons(tons: number): string {
  return `${groupDigits.format(tons)} t`;
}

/** Sum of tonnages, or null when any is unknown: a partial total would read as the whole. */
function sumTons(ships: readonly StationShip[]): number | null {
  let total = 0;
  for (const ship of ships) {
    if (ship.tons === null) return null;
    total += ship.tons;
  }
  return total;
}

function foreignStationsValue(projection: PlayerProjection, areas: StatusStripAreas): string {
  const { foreign, foreignTons } = buildStations(projection, areas);
  const count = `${String(foreign)} ${foreign === 1 ? "ship" : "ships"}`;
  return foreignTons === null || foreign === 0 ? count : `${count} · ${foreignTons}`;
}

function alertsLabel(count: number | null): string {
  if (count === null) return "Alerts unavailable";
  return `${count} ${count === 1 ? "alert" : "alerts"}`;
}

/**
 * Whole-number share of `whole`. A non-zero amount never reads "0%" (it is "<1%"), and a missing
 * amount or no usable appropriation reads "—" rather than a made-up figure.
 */
function percentOf(amount: number | null, whole: number | null): string {
  if (amount === null || whole === null || whole <= 0) return "—";
  const percent = Math.round((amount / whole) * 100);
  if (percent === 0 && amount > 0) return "<1%";
  return `${String(percent)}%`;
}

/** A figure the engine actually reported: non-finite values are missing, never coerced to zero. */
function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function buildAllocation(economy: PlayerProjection["economy"]): BudgetAllocation {
  const appropriation = finiteOrNull(economy.monthlyAppropriation);
  const lines = [
    {
      id: "obligations",
      label: "Obligations",
      amount: finiteOrNull(economy.obligations),
      kind: "committed",
    },
    {
      id: "maintenance",
      label: "Maintenance",
      amount: finiteOrNull(economy.maintenanceCost),
      kind: "committed",
    },
    {
      id: "research",
      label: "Research",
      amount: finiteOrNull(economy.researchSpend),
      kind: "committed",
    },
    {
      id: "construction",
      label: "Construction (up to)",
      amount: finiteOrNull(economy.plannedConstruction),
      kind: "planned",
    },
  ] as const;
  const known = (amount: number | null) => Math.max(0, amount ?? 0);
  const committed = lines
    .filter((l) => l.kind === "committed")
    .reduce((n, l) => n + (l.amount ?? 0), 0);
  // Bar widths are display-only: they share one scale (the larger of the appropriation and the
  // total outlay) so the bar never exceeds its container, while the legend keeps the true share.
  const outlay = lines.reduce((n, l) => n + known(l.amount), 0);
  const scale = Math.max(known(appropriation), outlay);
  return {
    appropriation: appropriation === null ? "—" : formatMoney(appropriation),
    segments: lines.map((l) => ({
      id: l.id,
      label: l.label,
      value: l.amount === null ? "—" : formatMoney(l.amount),
      kind: l.kind,
      percent: percentOf(l.amount, appropriation),
      fraction: scale > 0 ? known(l.amount) / scale : 0,
      shareOfCommitted: l.kind === "planned" ? "—" : percentOf(l.amount, committed),
      yearly: l.amount === null ? "—" : formatMoney(l.amount * 12),
    })),
    committed: { value: formatMoney(committed), percent: percentOf(committed, appropriation) },
    // No appropriation at all with committed lines is over-committed; an unknown one is not judged.
    overCommitted: appropriation !== null && committed > Math.max(0, appropriation),
  };
}

function buildOutlook(
  projection: PlayerProjection,
  balanceStatus: string,
  balanceTone: StripTone,
  researchRemark: string,
): OutlookDetail {
  const economy = projection.economy;
  const appropriation = economy.monthlyAppropriation;
  const scale = appropriation > 0 ? appropriation : 1;
  let remainder = appropriation;
  const steps = (
    [
      ["obligations", "Obligations", economy.obligations],
      ["maintenance", "Maintenance", economy.maintenanceCost],
      ["research", "Research", economy.researchSpend],
    ] as const
  ).map(([id, label, amount]) => {
    remainder -= amount;
    return {
      id,
      label,
      value: `-${formatMoney(amount)}`,
      remainder: formatMoney(remainder),
      remainderFraction: Math.min(1, Math.max(0, remainder / scale)),
    } satisfies WaterfallStep;
  });
  const afterConstruction = projection.projectedSurplusDeficit - economy.plannedConstruction;
  return {
    appropriation: formatMoney(appropriation),
    steps,
    balance: {
      value: formatMoney(projection.projectedSurplusDeficit),
      status: balanceStatus,
      tone: balanceTone,
    },
    afterConstruction: {
      value: formatMoney(afterConstruction),
      tone: afterConstruction < 0 ? "alert" : "normal",
    },
    treasury: formatMoney(economy.treasury),
    monthEndTreasury: formatMoney(economy.monthEndTreasury),
    runway:
      economy.runwayMonths === undefined
        ? null
        : `${String(economy.runwayMonths)} ${economy.runwayMonths === 1 ? "month" : "months"}`,
    shortfall: economy.shortfall > 0 ? formatMoney(economy.shortfall) : null,
    research: {
      requested: formatMoney(economy.researchRequested),
      cap: formatMoney(economy.researchCap),
      note: researchRemark,
    },
  };
}

function buildStations(
  projection: PlayerProjection,
  areas: StatusStripAreas | null,
): StationDetail {
  const divisions = projection.fleet.flatMap((f) => f.divisions);
  const toShip = (ship: { name: string; displacementTons?: number }): StationShip => ({
    name: ship.name,
    tons: ship.displacementTons ?? null,
  });
  const all = divisions.flatMap((d) => d.ships.map(toShip));
  const totalTons = sumTons(all);
  if (areas === null) {
    return {
      total: all.length,
      foreign: 0,
      foreignTons: null,
      totalTons: totalTons === null ? null : formatTons(totalTons),
      foreignTonsFraction: null,
      foreignGroups: [],
      unknown: true,
    };
  }
  const own = new Set(projection.strategicAreas.map((a) => a.id));
  const foreignAreas = new Map(
    areas.filter((a) => a.controller !== null && !own.has(a.id)).map((a) => [a.id, a]),
  );
  const groups = new Map<string, { area: StatusStripAreas[number]; ships: StationShip[] }>();
  for (const division of divisions) {
    const area = foreignAreas.get(division.areaId);
    if (area === undefined) continue;
    const group = groups.get(area.id) ?? { area, ships: [] };
    group.ships.push(...division.ships.map(toShip));
    groups.set(area.id, group);
  }
  const foreignGroups = [...groups.values()]
    .map(({ area, ships }) => {
      const tons = sumTons(ships);
      return {
        areaId: area.id,
        areaName: area.name ?? area.id,
        controller: area.controller ?? "",
        ships: ships.toSorted((a, b) => a.name.localeCompare(b.name, "en")),
        tons: tons === null ? null : formatTons(tons),
      };
    })
    .toSorted((a, b) => b.ships.length - a.ships.length || a.areaId.localeCompare(b.areaId, "en"));
  const foreignShips = foreignGroups.flatMap((g) => g.ships);
  const foreignTons = sumTons(foreignShips);
  return {
    total: all.length,
    foreign: foreignShips.length,
    foreignTons: foreignTons === null ? null : formatTons(foreignTons),
    totalTons: totalTons === null ? null : formatTons(totalTons),
    foreignTonsFraction:
      foreignTons === null || totalTons === null || totalTons === 0
        ? null
        : foreignTons / totalTons,
    foreignGroups,
    unknown: false,
  };
}

function buildPorts(projection: PlayerProjection): readonly PortDetail[] {
  const areaNames = new Map(projection.strategicAreas.map((a) => [a.id, a.name]));
  const largest = Math.max(1, ...projection.ports.map((p) => p.capacity));
  return projection.ports
    .map((port) => ({
      id: port.id,
      name: port.name,
      areaName: areaNames.get(port.areaId) ?? port.areaId,
      capacity: port.capacity,
      fraction: port.capacity / largest,
    }))
    .toSorted((a, b) => b.capacity - a.capacity || a.id.localeCompare(b.id, "en"));
}

export function buildStatusStrip(input: StatusStripInput): StatusStripModel {
  const { projection, areas, alertsCount } = input;
  const economy = projection.economy;
  // Committed monthly flows; construction is an "up to" bound and is not in the total.
  const totalExpenses = economy.obligations + economy.maintenanceCost + economy.researchSpend;
  const balance = projection.projectedSurplusDeficit;
  const inDeficit = balance < 0;
  // The same band the Treasury screen's chip shows (spec #138): one status, never two.
  const balanceStatus = economyStatusLabel(economy.status);
  const balanceTone: StripTone =
    inDeficit || economy.status === "deficit" || economy.status === "critical" ? "alert" : "normal";
  const researchRemark =
    researchNote({
      researchCap: economy.researchCap,
      researchRequested: economy.researchRequested,
      researchUnfundedReason: economy.researchUnfundedReason,
    }) ?? "";

  const foreignStations: StripRow =
    areas === null
      ? deferred("foreign-stations", "Ships on foreign stations", "The map could not be read.")
      : real(
          "foreign-stations",
          "Ships on foreign stations",
          foreignStationsValue(projection, areas),
          "Ships in areas held by another nation. Tonnage is shown when every one of those ships has a known design displacement.",
        );

  const nation: StripRow[] = [
    deferred("prestige", "Prestige", "No prestige mechanic exists in the campaign yet."),
    deferred(
      "fleet-morale",
      "Fleet morale",
      "Only per-division cohesion exists, not a national figure.",
    ),
    foreignStations,
    deferred(
      "dock-size",
      "Dock size",
      "Yards are one reference environment until per-port facilities land.",
    ),
    real(
      "shipyard-capacity",
      "Shipyard capacity (port levels)",
      String(economy.shipyardCapacity),
      "Sum of your ports' levels, a stand-in for RTW3 shipyard capacity.",
    ),
    deferred("unrest", "Unrest level", "There is no domestic-politics model."),
    deferred("build-requirement", "Build requirement", "No required building programme exists."),
    deferred("treaty-limits", "Treaty limits", "Naval treaties are not wired into the campaign."),
  ];
  // Real rows first would reorder the RTW3 grouping; keep the order stable and let the UI group.

  const budget: StripRow[] = [
    real("treasury", "Treasury", formatMoney(economy.treasury)),
    real("monthly-budget", "Monthly appropriation", formatMoney(economy.monthlyAppropriation)),
    real("obligations", "Obligations", formatMoney(economy.obligations)),
    real("maintenance", "Maintenance", formatMoney(economy.maintenanceCost)),
    real("research", "Research", formatMoney(economy.researchSpend), researchRemark),
    real(
      "construction",
      "Construction (up to)",
      formatMoney(economy.plannedConstruction),
      "An upper bound limited by yard capacity, before the treasury limits it.",
    ),
    deferred(
      "naval-aircraft",
      "Naval aircraft",
      "Aircraft are tactical-only; no campaign budget line.",
    ),
    deferred("extra-training", "Extra training", "Training programmes are not modelled."),
    deferred("intelligence", "Intelligence", "Intelligence spending is not modelled."),
    real(
      "total-expenses",
      "Committed expenses",
      formatMoney(totalExpenses),
      "Obligations + maintenance + research; deferred lines are omitted, not zeroed.",
    ),
    ...(economy.shortfall > 0
      ? [
          real(
            "shortfall",
            "Shortfall",
            formatMoney(economy.shortfall),
            "Costs the treasury cannot pay this month.",
            "alert",
          ),
        ]
      : []),
    ...(economy.runwayMonths === undefined
      ? []
      : [
          real(
            "runway",
            "Runway",
            `${String(economy.runwayMonths)} ${economy.runwayMonths === 1 ? "month" : "months"}`,
            "How long the treasury lasts at the current net.",
          ),
        ]),
    {
      id: "balance",
      label: "Monthly balance (projected)",
      value: formatMoney(balance),
      deferred: false,
      note: "",
      tone: balanceTone,
      status: balanceStatus,
    },
  ];

  return {
    nationName: projection.nationName,
    outlook: buildOutlook(projection, balanceStatus, balanceTone, researchRemark),
    stations: buildStations(projection, areas),
    ports: buildPorts(projection),
    allocation: buildAllocation(economy),
    nation,
    budget,
    deferredRows: [...nation, ...budget].filter((r) => r.deferred),
    summary: {
      balance: { value: formatMoney(balance), status: balanceStatus, tone: balanceTone },
      treasury: formatMoney(economy.treasury),
      alerts: alertsLabel(alertsCount),
    },
  };
}
