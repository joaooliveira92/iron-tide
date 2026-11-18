import { useCallback, useMemo } from "react";
import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import type {
  CommandableReadiness,
  StationAssignmentIntent,
} from "../../../../shared/fleet-contract.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import { translate } from "../../../lib/strings.js";
import {
  format,
  presenceReadout,
  type StationOption,
  type StationRow,
} from "./fleet-station-state.js";
import { PresenceReadout } from "./PresenceReadout.js";
import { StationShipTable } from "./StationShipTable.js";
import { PresenceWarnings } from "../components/PresenceWarnings.js";
import type { FleetStationState } from "./fleet-station-model.js";
import { useFleetHotkeys } from "../hooks/useFleetHotkeys.js";
import { useStationAssignment } from "./useStationAssignment.js";

export interface FleetStationViewProps {
  readonly state: FleetStationState;
  readonly rows: readonly StationRow[];
  readonly areaName: (areaId: string) => string;
  readonly selected: readonly string[];
  readonly loadError: string | null;
  readonly busy: boolean;
  readonly outcomeUnknown: boolean;
  readonly onToggle: (shipId: string) => void;
  readonly stations: readonly StationOption[];
  readonly station: string;
  readonly onStationChange: (areaId: string) => void;
  readonly onSend: (intent: StationAssignmentIntent) => Promise<CommandOutcome>;
  readonly onSendReadiness: (readiness: CommandableReadiness) => Promise<CommandOutcome>;
  readonly onRetry: () => void;
  readonly onReload: () => void;
}

export function FleetStationView({
  state,
  rows,
  areaName,
  selected,
  loadError,
  busy,
  outcomeUnknown,
  onToggle,
  stations,
  station,
  onStationChange,
  onSend,
  onSendReadiness,
  onRetry,
  onReload,
}: FleetStationViewProps) {
  const readout = presenceReadout(state.presence, state.overBaseShips, areaName);
  const none = selected.length === 0;
  const selectedIds = useMemo(() => new Set(selected), [selected]);
  return (
    <section className="space-y-4" data-testid="fleet-station" aria-labelledby="fleet-station-h">
      <div className="flex items-center gap-2">
        <h3 id="fleet-station-h" className="text-sm font-medium">
          {translate("fleet.station.title")}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {rows.length}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{translate("fleet.station.intro")}</p>

      {loadError !== null && (
        <div role="alert" className="space-y-2 rounded-md border border-destructive/50 p-3 text-sm">
          <p className="whitespace-pre-line text-destructive">{loadError}</p>
          <Button type="button" size="sm" variant="outline" onClick={onReload}>
            {translate("fleet.station.reload")}
          </Button>
        </div>
      )}

      {state.notice !== null && (
        <div
          role="status"
          className="space-y-2 rounded-md border px-3 py-2 text-sm"
          data-testid="fleet-station-notice"
        >
          <p className="whitespace-pre-line">{state.notice}</p>
          {state.requiresRefresh && (
            <Button type="button" size="sm" variant="outline" onClick={onReload}>
              {translate("fleet.station.refresh")}
            </Button>
          )}
        </div>
      )}

      <PresenceWarnings warnings={state.presenceWarnings} areaName={areaName} />

      {outcomeUnknown && (
        <div role="alert" className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <span>{translate("fleet.station.retry")}</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {translate("fleet.station.retry.action")}
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{translate("fleet.station.empty")}</p>
      ) : (
        <StationShipTable rows={rows} selectedIds={selectedIds} onToggle={onToggle} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {translate("fleet.station.picker.label")}
          <select
            className="h-8 rounded-md border bg-background px-2 text-sm text-foreground"
            data-testid="fleet-station-picker"
            value={station}
            disabled={busy}
            onChange={(event) => onStationChange(event.target.value)}
          >
            <option value="">{translate("fleet.station.picker.any")}</option>
            {stations.map((option) => (
              <option key={option.areaId} value={option.areaId}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          disabled={none || busy}
          onClick={() => void onSend("assign")}
        >
          {translate("fleet.station.action.assign")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={none || busy}
          onClick={() => void onSend("clear")}
        >
          {translate("fleet.station.action.clear")}
        </Button>
        {(["ACTIVE", "RESERVE", "MOTHBALLED"] as const).map((readiness) => (
          <Button
            key={readiness}
            type="button"
            size="sm"
            variant="outline"
            disabled={none || busy}
            data-testid={`fleet-readiness-${readiness.toLowerCase()}`}
            onClick={() => void onSendReadiness(readiness)}
          >
            {translate(`fleet.readiness.action.${readiness}`)}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {none
            ? translate("fleet.station.selectedNone")
            : format("fleet.station.selected", { n: selected.length })}
        </span>
      </div>

      <PresenceReadout readout={readout} />
    </section>
  );
}

export function FleetStationSection({ sessionId }: { readonly sessionId: string }) {
  const station = useStationAssignment(sessionId);
  const { selected, busy, sendReadiness, loadScreen } = station;
  const onReload = useCallback(() => void loadScreen(), [loadScreen]);
  useFleetHotkeys({
    "reserve-selected": () => {
      if (selected.length === 0 || busy) return;
      void sendReadiness("RESERVE");
    },
  });
  return (
    <FleetStationView
      state={station.state}
      rows={station.rows}
      areaName={station.areaName}
      selected={station.selected}
      loadError={station.loadError}
      busy={station.busy}
      outcomeUnknown={station.request.outcomeUnknown}
      onToggle={station.toggle}
      stations={station.stations}
      station={station.station}
      onStationChange={station.setStation}
      onSend={station.send}
      onSendReadiness={station.sendReadiness}
      onRetry={station.request.retry}
      onReload={onReload}
    />
  );
}
