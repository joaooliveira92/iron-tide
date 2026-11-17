import type { PlayerProjection } from "@bluewave/campaign-engine";

import { translate } from "../lib/strings.js";
import type { StripRow } from "./status-strip-state.js";

export interface FleetMoraleGauge {
  readonly current: number;
  readonly max: number;
  readonly fraction: number;
  readonly lowered: boolean;
}

export function buildFleetMoraleGauge(morale: PlayerProjection["fleetMorale"]): FleetMoraleGauge {
  return {
    current: morale.current,
    max: morale.max,
    fraction: Math.min(1, Math.max(0, morale.current / morale.max)),
    lowered: morale.current < morale.max,
  };
}

export function buildFleetMoraleRow(morale: PlayerProjection["fleetMorale"]): StripRow {
  const last = morale.lastChange;
  const parts = [
    translate("shell.fleetMorale.description"),
    ...(last === undefined
      ? []
      : [
          translate("shell.fleetMorale.lastChange", {
            delta: last.delta > 0 ? `+${String(last.delta)}` : String(last.delta),
            reasons: last.reasonCodes
              .map((code) => translate(`shell.fleetMorale.reason.${code}`))
              .join(", "),
            month: last.month,
          }),
        ]),
  ];
  return {
    id: "fleet-morale",
    label: translate("shell.fleetMorale.label"),
    value: translate("shell.fleetMorale.value", { current: morale.current, max: morale.max }),
    deferred: false,
    note: parts.join(" "),
    tone: morale.current < morale.max ? "alert" : "normal",
  };
}
