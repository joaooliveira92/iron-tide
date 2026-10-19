import type { PlayerProjection } from "@bluewave/campaign-engine";

import { economyStatusLabel, researchNote } from "../lib/economy-wording.js";

/**
 * Pure view model for the bottom status strip (campaign-command-screen CC-3, ADR-0059 s1).
 * Every value is real or derived from `inspectCampaign` / `inspectMap`; anything the engine does
 * not model is a visible "Not yet modelled" row with its reason, never a number.
 *
 * Foreign-station rule (`FOREIGN_STATION_RULE_V1`): a player ship counts when it sits in an area
 * controlled by another nation. Own areas and unclaimed seas do not count. The engine views carry
 * no per-ship displacement, so this is a ship count, not RTW3's tonnage.
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
}

/** How the monthly appropriation is spent, for the stacked bar and its legend. */
export interface BudgetAllocation {
  readonly appropriation: string;
  readonly segments: readonly AllocationSegment[];
  readonly committed: { readonly value: string; readonly percent: string };
  /** Committed lines alone exceed the appropriation. */
  readonly overCommitted: boolean;
}

export interface StatusStripModel {
  readonly nationName: string;
  readonly allocation: BudgetAllocation;
  readonly nation: readonly StripRow[];
  readonly budget: readonly StripRow[];
  /** Every deferred row from both groups, for the single "Not yet modelled" disclosure. */
  readonly deferredRows: readonly StripRow[];
  readonly summary: StatusStripSummary;
}

export type StatusStripAreas = readonly {
  readonly id: string;
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

function countForeignStationShips(projection: PlayerProjection, areas: StatusStripAreas): number {
  const own = new Set(projection.strategicAreas.map((a) => a.id));
  const foreign = new Set(
    areas.filter((a) => a.controller !== null && !own.has(a.id)).map((a) => a.id),
  );
  return projection.fleet
    .flatMap((f) => f.divisions)
    .filter((d) => foreign.has(d.areaId))
    .reduce((sum, d) => sum + d.ships.length, 0);
}

function alertsLabel(count: number | null): string {
  if (count === null) return "Alerts unavailable";
  return `${count} ${count === 1 ? "alert" : "alerts"}`;
}

function percentOf(amount: number, whole: number): string {
  return whole > 0 ? `${String(Math.round((amount / whole) * 100))}%` : "—";
}

function buildAllocation(economy: PlayerProjection["economy"]): BudgetAllocation {
  const lines = [
    { id: "obligations", label: "Obligations", amount: economy.obligations, kind: "committed" },
    { id: "maintenance", label: "Maintenance", amount: economy.maintenanceCost, kind: "committed" },
    { id: "research", label: "Research", amount: economy.researchSpend, kind: "committed" },
    {
      id: "construction",
      label: "Construction (up to)",
      amount: economy.plannedConstruction,
      kind: "planned",
    },
  ] as const;
  const committed = lines.filter((l) => l.kind === "committed").reduce((n, l) => n + l.amount, 0);
  const outlay = lines.reduce((n, l) => n + l.amount, 0);
  const scale = Math.max(economy.monthlyAppropriation, outlay);
  return {
    appropriation: formatMoney(economy.monthlyAppropriation),
    segments: lines.map((l) => ({
      id: l.id,
      label: l.label,
      value: formatMoney(l.amount),
      kind: l.kind,
      percent: percentOf(l.amount, economy.monthlyAppropriation),
      fraction: scale > 0 ? l.amount / scale : 0,
    })),
    committed: {
      value: formatMoney(committed),
      percent: percentOf(committed, economy.monthlyAppropriation),
    },
    overCommitted: committed > economy.monthlyAppropriation,
  };
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
          (() => {
            const n = countForeignStationShips(projection, areas);
            return `${n} ${n === 1 ? "ship" : "ships"}`;
          })(),
          "A ship count in areas held by another nation, not tonnage: ship displacement is not in the campaign views.",
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
