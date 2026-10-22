import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import { Card, CardContent } from "../../../components/ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import type { StationAssignmentIntent } from "../../../../shared/fleet-contract.js";
import type { CommandOutcome } from "../../../lib/command-screen-workflow.js";
import { translate } from "../../../lib/strings.js";
import {
  format,
  presenceReadout,
  type PresenceReadoutView,
  type StationRow,
} from "./fleet-station-state.js";
import type { FleetStationState } from "./fleet-station-model.js";
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
  readonly onSend: (intent: StationAssignmentIntent) => Promise<CommandOutcome>;
  readonly onRetry: () => void;
  readonly onReload: () => void;
}

function StatusCell({ row }: { readonly row: StationRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5">
      <abbr title={row.statusLabel} className="font-mono no-underline">
        {row.statusCode}
        {row.overBase ? <span aria-hidden="true">*</span> : null}
      </abbr>
      <span className="text-xs text-muted-foreground">{row.statusLabel}</span>
      {row.overBase ? (
        <span className="text-xs font-medium text-foreground">{row.overBaseLabel}</span>
      ) : null}
    </span>
  );
}

function FlagCell({ row, code }: { readonly row: StationRow; readonly code: "c" | "a" | "S" }) {
  const flag = row.flags.find((candidate) => candidate.code === code);
  return flag ? (
    <abbr title={flag.label} className="font-mono no-underline">
      {flag.code}
      <span className="sr-only"> {flag.label}</span>
    </abbr>
  ) : (
    <span className="text-muted-foreground">
      <span aria-hidden="true">-</span>
      <span className="sr-only">{translate("fleet.flag.none")}</span>
    </span>
  );
}

function PresenceReadout({ readout }: { readonly readout: PresenceReadoutView }) {
  return (
    <section className="space-y-3" data-testid="fleet-presence" aria-labelledby="fleet-presence-h">
      <h4 id="fleet-presence-h" className="text-sm font-medium">
        {translate("fleet.presence.title")}
      </h4>
      {readout.kind === "not-configured" ? (
        <p className="text-sm text-muted-foreground" data-testid="fleet-presence-not-configured">
          {translate("fleet.presence.notConfigured")}
        </p>
      ) : (
        <>
          {readout.exempt ? (
            <p
              role="status"
              className="rounded-md border px-3 py-2 text-sm"
              data-testid="fleet-presence-exempt"
            >
              {translate("fleet.presence.exempt")}
            </p>
          ) : null}
          {readout.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">{translate("fleet.presence.noAreas")}</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{translate("fleet.presence.col.area")}</TableHead>
                      <TableHead>{translate("fleet.presence.col.required")}</TableHead>
                      <TableHead>{translate("fleet.presence.col.present")}</TableHead>
                      <TableHead>{translate("fleet.presence.col.shortfall")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {readout.rows.map((row) => (
                      <TableRow key={row.areaId}>
                        <TableCell className="font-medium">{row.areaName}</TableCell>
                        <TableCell>{row.required}</TableCell>
                        <TableCell>{row.present}</TableCell>
                        <TableCell className={row.short ? "font-medium" : "text-muted-foreground"}>
                          {row.shortfall}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
      <div data-testid="fleet-over-base">
        <h5 className="text-sm font-medium">{translate("fleet.overBase.title")}</h5>
        {readout.overBase.length === 0 ? (
          <p className="text-sm text-muted-foreground">{translate("fleet.overBase.none")}</p>
        ) : (
          <ul className="list-disc pl-5 text-sm">
            {readout.overBase.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
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
  onSend,
  onRetry,
  onReload,
}: FleetStationViewProps) {
  const readout = presenceReadout(state.presence, state.overBaseShips, areaName);
  const none = selected.length === 0;
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
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{translate("fleet.station.col.select")}</TableHead>
                  <TableHead>{translate("fleet.station.col.ship")}</TableHead>
                  <TableHead>{translate("fleet.station.col.area")}</TableHead>
                  <TableHead>{translate("fleet.station.col.status")}</TableHead>
                  <TableHead>
                    <abbr title={translate("fleet.station.col.colonial.label")}>
                      {translate("fleet.station.col.colonial")}
                    </abbr>
                  </TableHead>
                  <TableHead>
                    <abbr title={translate("fleet.station.col.cramped.label")}>
                      {translate("fleet.station.col.cramped")}
                    </abbr>
                  </TableHead>
                  <TableHead>
                    <abbr title={translate("fleet.station.col.range.label")}>
                      {translate("fleet.station.col.range")}
                    </abbr>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.shipId} data-testid={`fleet-station-row-${row.shipId}`}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={selected.includes(row.shipId)}
                        onChange={() => onToggle(row.shipId)}
                        aria-label={format("fleet.station.selectShip", {
                          ship: row.name,
                        })}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-muted-foreground">{row.areaName}</TableCell>
                    <TableCell>
                      <StatusCell row={row} />
                    </TableCell>
                    <TableCell>
                      <FlagCell row={row} code="c" />
                    </TableCell>
                    <TableCell>
                      <FlagCell row={row} code="a" />
                    </TableCell>
                    <TableCell>
                      <FlagCell row={row} code="S" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
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
      onSend={station.send}
      onRetry={station.request.retry}
      onReload={() => void station.loadScreen()}
    />
  );
}
