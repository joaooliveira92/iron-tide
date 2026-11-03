import type { PlayerProjection } from "@bluewave/campaign-engine";
import type { ExplanationTree } from "@bluewave/events";

import { monthName } from "../lib/campaign-month.js";
import { economyStatusLabel, researchNote } from "../lib/economy-wording.js";
import type { PresentationFormat } from "../lib/presentation-format/index.js";
import { KG_PER_TONNE } from "../lib/presentation-format/units.js";
import { translate } from "../lib/strings.js";

export const FOREIGN_STATION_RULE_V1 = "controlled-by-another-nation";

export const NOT_YET_MODELLED = "Not yet modelled";

export type StripTone = "normal" | "alert";

export interface StripRow {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly deferred: boolean;
  readonly note: string;
  readonly tone: StripTone;
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
  readonly kind: "committed" | "planned";
  readonly percent: string;
  readonly fraction: number;
  readonly shareOfCommitted: string;
  readonly yearly: string;
}

export interface BudgetAllocation {
  readonly appropriation: string;
  readonly segments: readonly AllocationSegment[];
  readonly committed: { readonly value: string; readonly percent: string };
  readonly overCommitted: boolean;
  readonly limit: number;
}

export interface WaterfallStep {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly remainder: string;
  readonly remainderFraction: number;
}

export interface OutlookDetail {
  readonly appropriation: string;
  readonly steps: readonly WaterfallStep[];
  readonly balance: { readonly value: string; readonly status: string; readonly tone: StripTone };
  readonly afterConstruction: { readonly value: string; readonly tone: StripTone };
  readonly treasury: string;
  readonly monthEndTreasury: string;
  readonly runway: string | null;
  readonly runwayMonths: number | null;
  readonly monthEndTreasuryValue: number;
  readonly shortfall: string | null;
  readonly research: { readonly requested: string; readonly cap: string; readonly note: string };
}

export interface StationShip {
  readonly name: string;
  readonly tons: number | null;
}

export interface ForeignStationGroup {
  readonly areaId: string;
  readonly areaName: string;
  readonly controller: string;
  readonly ships: readonly StationShip[];
  readonly tons: string | null;
}

export interface StationDetail {
  readonly total: number;
  readonly foreign: number;
  readonly foreignTons: string | null;
  readonly totalTons: string | null;
  readonly foreignTonsFraction: number | null;
  readonly foreignGroups: readonly ForeignStationGroup[];
  readonly unknown: boolean;
}

export interface PortDetail {
  readonly id: string;
  readonly name: string;
  readonly areaName: string;
  readonly capacity: number;
  readonly fraction: number;
}

export interface PrestigeGauge {
  readonly current: number;
  readonly threshold: number;
  readonly fraction: number;
  readonly thresholdFraction: number;
  readonly atRisk: boolean;
}

export interface StatusStripModel {
  readonly nationName: string;
  readonly prestige: PrestigeGauge;
  readonly prestigeExplanation?: ExplanationTree;
  readonly outlook: OutlookDetail;
  readonly stations: StationDetail;
  readonly ports: readonly PortDetail[];
  readonly allocation: BudgetAllocation;
  readonly nation: readonly StripRow[];
  readonly budget: readonly StripRow[];
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
  readonly areas: StatusStripAreas | null;
  readonly alertsCount: number | null;
  readonly format: PresentationFormat;
}

function real(id: string, label: string, value: string, note = "", tone: StripTone = "normal") {
  return { id, label, value, deferred: false, note, tone } satisfies StripRow;
}

function deferred(id: string, label: string, reason: string): StripRow {
  return { id, label, value: NOT_YET_MODELLED, deferred: true, note: reason, tone: "normal" };
}

export function formatTons(tons: number, format: PresentationFormat): string {
  return format.measurement(tons * KG_PER_TONNE, "mass", { maximumFractionDigits: 0 });
}

function sumTons(ships: readonly StationShip[]): number | null {
  let total = 0;
  for (const ship of ships) {
    if (ship.tons === null) return null;
    total += ship.tons;
  }
  return total;
}

function foreignStationsValue(
  projection: PlayerProjection,
  areas: StatusStripAreas,
  format: PresentationFormat,
): string {
  const { foreign, foreignTons } = buildStations(projection, areas, format);
  const count = `${String(foreign)} ${foreign === 1 ? "ship" : "ships"}`;
  return foreignTons === null || foreign === 0 ? count : `${count} · ${foreignTons}`;
}

function alertsLabel(count: number | null): string {
  if (count === null) return "Alerts unavailable";
  return `${count} ${count === 1 ? "alert" : "alerts"}`;
}

function percentOf(amount: number | null, whole: number | null): string {
  if (amount === null || whole === null || whole <= 0) return "—";
  const percent = Math.round((amount / whole) * 100);
  if (percent === 0 && amount > 0) return "<1%";
  return `${String(percent)}%`;
}

function finiteOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

function buildAllocation(
  economy: PlayerProjection["economy"],
  format: PresentationFormat,
): BudgetAllocation {
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
  const outlay = lines.reduce((n, l) => n + known(l.amount), 0);
  const scale = Math.max(known(appropriation), outlay);
  return {
    appropriation: appropriation === null ? "—" : format.money(appropriation),
    segments: lines.map((l) => ({
      id: l.id,
      label: l.label,
      value: l.amount === null ? "—" : format.money(l.amount),
      kind: l.kind,
      percent: percentOf(l.amount, appropriation),
      fraction: scale > 0 ? known(l.amount) / scale : 0,
      shareOfCommitted: l.kind === "planned" ? "—" : percentOf(l.amount, committed),
      yearly: l.amount === null ? "—" : format.money(l.amount * 12),
    })),
    committed: { value: format.money(committed), percent: percentOf(committed, appropriation) },
    overCommitted: appropriation !== null && committed > Math.max(0, appropriation),
    limit: scale > 0 ? known(appropriation) / scale : 0,
  };
}

function buildOutlook(
  projection: PlayerProjection,
  balanceStatus: string,
  balanceTone: StripTone,
  researchRemark: string,
  format: PresentationFormat,
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
      value: `-${format.money(amount)}`,
      remainder: format.money(remainder),
      remainderFraction: Math.min(1, Math.max(0, remainder / scale)),
    } satisfies WaterfallStep;
  });
  const afterConstruction = projection.projectedSurplusDeficit - economy.plannedConstruction;
  return {
    appropriation: format.money(appropriation),
    steps,
    balance: {
      value: format.money(projection.projectedSurplusDeficit),
      status: balanceStatus,
      tone: balanceTone,
    },
    afterConstruction: {
      value: format.money(afterConstruction),
      tone: afterConstruction < 0 ? "alert" : "normal",
    },
    treasury: format.money(economy.treasury),
    monthEndTreasury: format.money(economy.monthEndTreasury),
    runwayMonths: economy.runwayMonths ?? null,
    monthEndTreasuryValue: economy.monthEndTreasury,
    runway:
      economy.runwayMonths === undefined
        ? null
        : `${String(economy.runwayMonths)} ${economy.runwayMonths === 1 ? "month" : "months"}`,
    shortfall: economy.shortfall > 0 ? format.money(economy.shortfall) : null,
    research: {
      requested: format.money(economy.researchRequested),
      cap: format.money(economy.researchCap),
      note: researchRemark,
    },
  };
}

function buildStations(
  projection: PlayerProjection,
  areas: StatusStripAreas | null,
  format: PresentationFormat,
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
      totalTons: totalTons === null ? null : formatTons(totalTons, format),
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
        tons: tons === null ? null : formatTons(tons, format),
      };
    })
    .toSorted((a, b) => b.ships.length - a.ships.length || a.areaId.localeCompare(b.areaId, "en"));
  const foreignShips = foreignGroups.flatMap((g) => g.ships);
  const foreignTons = sumTons(foreignShips);
  return {
    total: all.length,
    foreign: foreignShips.length,
    foreignTons: foreignTons === null ? null : formatTons(foreignTons, format),
    totalTons: totalTons === null ? null : formatTons(totalTons, format),
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

function buildPrestigeGauge(prestige: PlayerProjection["prestige"]): PrestigeGauge {
  const scale = Math.max(prestige.current, prestige.sackingThreshold, 1) * 1.5;
  return {
    current: prestige.current,
    threshold: prestige.sackingThreshold,
    fraction: Math.min(1, Math.max(0, prestige.current / scale)),
    thresholdFraction: Math.min(1, Math.max(0, prestige.sackingThreshold / scale)),
    atRisk: prestige.dismissalRisk,
  };
}

function signed(value: number): string {
  return value > 0 ? `+${String(value)}` : String(value);
}

function prestigeRow(projection: PlayerProjection): StripRow {
  const { prestige } = projection;
  const last = prestige.lastChange;
  const parts = [
    translate("shell.prestige.description", { threshold: prestige.sackingThreshold }),
    ...(last === undefined
      ? []
      : [
          translate("shell.prestige.lastChange", {
            delta: signed(last.delta),
            reason: translate(`shell.prestige.reason.${last.reasonCode}`),
            month: last.month,
          }),
        ]),
    ...(prestige.dismissalRisk
      ? [translate("shell.prestige.riskNote", { threshold: prestige.sackingThreshold })]
      : []),
  ];
  return real(
    "prestige",
    translate("shell.header.metric.prestige"),
    prestige.dismissalRisk
      ? translate("shell.prestige.valueAtRisk", { value: prestige.current })
      : String(prestige.current),
    parts.join(" "),
    prestige.dismissalRisk ? "alert" : "normal",
  );
}

function careerRow(career: NonNullable<PlayerProjection["career"]>): StripRow {
  const sacked = career.reason === "SACKED";
  return real(
    "career",
    translate("shell.career.label"),
    translate(sacked ? "shell.prestige.careerSacked" : "shell.prestige.careerCampaignEnd", {
      score: career.score,
    }),
    translate("shell.career.note", {
      score: career.score,
      month: monthName(career.month.month) ?? String(career.month.month),
      year: career.month.year,
      reason: translate(`shell.career.reason.${career.reason}`),
    }),
    sacked ? "alert" : "normal",
  );
}

export function buildStatusStrip(input: StatusStripInput): StatusStripModel {
  const { projection, areas, alertsCount, format } = input;
  const economy = projection.economy;
  const totalExpenses = economy.obligations + economy.maintenanceCost + economy.researchSpend;
  const balance = projection.projectedSurplusDeficit;
  const inDeficit = balance < 0;
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
          foreignStationsValue(projection, areas, format),
          "Ships in areas held by another nation. Tonnage is shown when every one of those ships has a known design displacement.",
        );

  const nation: StripRow[] = [
    prestigeRow(projection),
    ...(projection.career === undefined ? [] : [careerRow(projection.career)]),
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

  const budget: StripRow[] = [
    real("treasury", "Treasury", format.money(economy.treasury)),
    real("monthly-budget", "Monthly appropriation", format.money(economy.monthlyAppropriation)),
    real("obligations", "Obligations", format.money(economy.obligations)),
    real("maintenance", "Maintenance", format.money(economy.maintenanceCost)),
    real("research", "Research", format.money(economy.researchSpend), researchRemark),
    real(
      "construction",
      "Construction (up to)",
      format.money(economy.plannedConstruction),
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
      format.money(totalExpenses),
      "Obligations + maintenance + research; deferred lines are omitted, not zeroed.",
    ),
    ...(economy.shortfall > 0
      ? [
          real(
            "shortfall",
            "Shortfall",
            format.money(economy.shortfall),
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
      value: format.money(balance),
      deferred: false,
      note: "",
      tone: balanceTone,
      status: balanceStatus,
    },
  ];

  return {
    nationName: projection.nationName,
    prestige: buildPrestigeGauge(projection.prestige),
    ...(projection.prestige.changeExplanation === undefined
      ? {}
      : { prestigeExplanation: projection.prestige.changeExplanation }),
    outlook: buildOutlook(projection, balanceStatus, balanceTone, researchRemark, format),
    stations: buildStations(projection, areas, format),
    ports: buildPorts(projection),
    allocation: buildAllocation(economy, format),
    nation,
    budget,
    deferredRows: [...nation, ...budget].filter((r) => r.deferred),
    summary: {
      balance: { value: format.money(balance), status: balanceStatus, tone: balanceTone },
      treasury: format.money(economy.treasury),
      alerts: alertsLabel(alertsCount),
    },
  };
}
