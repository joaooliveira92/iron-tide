import { memo, useMemo } from "react";

import { activeAlertsCount, type CampaignReads } from "../campaign-reads.js";
import { usePresentationFormat } from "../usePresentationFormat.js";
import { buildStatusStrip, type StatusStripModel } from "../status-strip-state.js";
import { buildTrend, type TrendDetail } from "../status-strip-trend.js";
import { AlertsChip } from "./chips/AlertsChip.js";
import { BalanceChip } from "./chips/BalanceChip.js";
import { BudgetChip } from "./chips/BudgetChip.js";
import { PrestigeChip } from "./chips/PrestigeChip.js";
import { TreasuryChip } from "./chips/TreasuryChip.js";
import { NationPanel } from "./panels/NationPanel.js";
import { BudgetPanel } from "./panels/budget/BudgetPanel.js";
import { OutlookPanel } from "./panels/OutlookPanel.js";
import { StatusStripControls } from "./StatusStripControls.js";
import {
  StatusStripProvider,
  useStatusStripMeta,
  useStatusStripState,
} from "./StatusStripContext.js";

function StatusStripPanels() {
  return (
    <div className="grid gap-1.5 py-1.5 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_minmax(0,2fr)]">
      <NationPanel />
      <BudgetPanel />
      <OutlookPanel />
    </div>
  );
}

function StatusStripChips() {
  const { model, trend } = useStatusStripState();
  const { summary } = useStatusStripMeta();
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 py-1">
        <BalanceChip model={model} trend={trend} />
        <TreasuryChip model={model} trend={trend} />
        <BudgetChip model={model} />
        <PrestigeChip model={model} />
        <AlertsChip alerts={summary.alerts} />
      </div>
      <div className="ml-auto">
        <StatusStripControls />
      </div>
    </div>
  );
}

function StatusStripRegion() {
  const { expanded } = useStatusStripState();
  return (
    <section
      aria-label="Status strip"
      data-testid="status-strip"
      data-expanded={expanded}
      className="relative shrink-0 border-t bg-background/70 px-3 py-0 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 group-data-[underlay=true]/chrome:border-transparent group-data-[underlay=true]/chrome:bg-linear-to-t group-data-[underlay=true]/chrome:from-background/75 group-data-[underlay=true]/chrome:to-background/10 group-data-[underlay=true]/chrome:backdrop-blur-sm group-data-[underlay=true]/chrome:supports-[backdrop-filter]:bg-transparent"
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-admiralty-accent/60 to-transparent"
      />
      {expanded ? <StatusStripPanels /> : <StatusStripChips />}
    </section>
  );
}

export const StatusStripView = memo(function StatusStripView({
  model,
  trend = null,
  startCollapsed = false,
}: {
  readonly model: StatusStripModel;
  readonly trend?: TrendDetail | null;
  readonly startCollapsed?: boolean;
}) {
  return (
    <StatusStripProvider model={model} trend={trend} startCollapsed={startCollapsed}>
      <StatusStripRegion />
    </StatusStripProvider>
  );
});

export interface StatusStripProps {
  readonly reads: CampaignReads;
  readonly startCollapsed?: boolean;
}

export function useStatusStripReads(reads: CampaignReads): {
  readonly model: StatusStripModel | null;
  readonly trend: TrendDetail | null;
} {
  const { projection, areas, reports } = reads;
  const format = usePresentationFormat();
  const model = useMemo(
    () =>
      projection.status === "ready"
        ? buildStatusStrip({
            projection: projection.value,
            areas: areas.status === "ready" ? areas.value : null,
            alertsCount: activeAlertsCount(reads),
            format,
          })
        : null,
    [projection, areas, reads, format],
  );
  const trend = useMemo(
    () => buildTrend(reports.status === "ready" ? reports.value : null, format),
    [reports, format],
  );
  return { model, trend };
}

export function StatusStrip({ reads, startCollapsed = false }: StatusStripProps) {
  const { model, trend } = useStatusStripReads(reads);
  if (model === null) return null;
  return <StatusStripView model={model} trend={trend} startCollapsed={startCollapsed} />;
}
