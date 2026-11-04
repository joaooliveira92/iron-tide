import { useCallback, useMemo, useState } from "react";

import { useDensity } from "../DensityContext.js";
import type { StatusStripModel, StatusStripSummary, StripRow } from "../status-strip-state.js";
import type { TrendDetail } from "../status-strip-trend.js";

export interface StatusStripInput {
  readonly model: StatusStripModel;
  readonly trend: TrendDetail | null;
  readonly startCollapsed: boolean;
}

export interface StatusStripState {
  readonly model: StatusStripModel;
  readonly trend: TrendDetail | null;
  readonly expanded: boolean;
}

export interface StatusStripActions {
  readonly setExpanded: (expanded: boolean) => void;
  readonly toggle: () => void;
}

export interface StatusStripMeta {
  readonly summary: StatusStripSummary;
  readonly nationRows: readonly StripRow[];
  readonly budgetRows: readonly StripRow[];
  readonly deferredRows: readonly StripRow[];
}

export interface StatusStripWorkspace {
  readonly state: StatusStripState;
  readonly actions: StatusStripActions;
  readonly meta: StatusStripMeta;
}

export function useStatusStripWorkspace({
  model,
  trend,
  startCollapsed,
}: StatusStripInput): StatusStripWorkspace {
  const { density } = useDensity();
  const [chosen, setChosen] = useState<boolean | null>(null);
  const expanded = chosen ?? (density !== "compact" && !startCollapsed);

  const setExpanded = useCallback((next: boolean) => setChosen(next), []);
  const toggle = useCallback(() => setChosen(!expanded), [expanded]);

  const state = useMemo<StatusStripState>(
    () => ({ model, trend, expanded }),
    [model, trend, expanded],
  );
  const actions = useMemo<StatusStripActions>(
    () => ({ setExpanded, toggle }),
    [setExpanded, toggle],
  );
  const meta = useMemo<StatusStripMeta>(
    () => ({
      summary: model.summary,
      nationRows: model.nation.filter((row) => !row.deferred),
      budgetRows: model.budget.filter((row) => !row.deferred),
      deferredRows: model.deferredRows,
    }),
    [model],
  );

  return { state, actions, meta };
}
