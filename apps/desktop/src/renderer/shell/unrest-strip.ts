import { UNREST_MAX } from "@bluewave/campaign";
import type { PlayerProjection } from "@bluewave/campaign-engine";

import { translate } from "../lib/strings.js";
import type { StripRow } from "./status-strip-state.js";

export interface UnrestGauge {
  readonly current: number;
  readonly max: number;
  readonly fraction: number;
}

export function buildUnrestGauge(projection: Pick<PlayerProjection, "unrest">): UnrestGauge {
  const current = projection.unrest ?? 0;
  return {
    current,
    max: UNREST_MAX,
    fraction: Math.min(1, Math.max(0, current / UNREST_MAX)),
  };
}

export function buildUnrestRow(projection: PlayerProjection): StripRow {
  const unrest = projection.unrest ?? 0;
  const last = projection.unrestChange;
  const parts = [
    translate("shell.unrest.description"),
    ...(last === undefined
      ? []
      : [
          translate("shell.unrest.lastChange", {
            delta: last.delta > 0 ? `+${String(last.delta)}` : String(last.delta),
            reasons: last.reasonCodes
              .map((code) => translate(`shell.unrest.reason.${code}`))
              .join(", "),
            month: last.month,
          }),
        ]),
  ];
  return {
    id: "unrest",
    label: translate("shell.unrest.label"),
    value: translate("shell.unrest.value", { current: unrest }),
    deferred: false,
    note: parts.join(" "),
    tone: "normal",
  };
}
