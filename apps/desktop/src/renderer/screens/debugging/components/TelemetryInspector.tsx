import { Code, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../../../components/ui/alert-dialog.js";
import { Button } from "../../../components/ui/button.js";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card.js";
import type { WideTelemetryEvent } from "../../../lib/telemetry.js";
import type { OutcomeFilter } from "../types.js";
import { TelemetryEventSheet } from "./TelemetryEventSheet.js";
import { TelemetryFilters } from "./TelemetryFilters.js";
import { TelemetryTable } from "./TelemetryTable.js";

export interface TelemetryInspectorProps {
  readonly events: readonly WideTelemetryEvent[];
  readonly filteredEvents: readonly WideTelemetryEvent[];
  readonly eventSearchTerm: string;
  readonly outcomeFilter: OutcomeFilter;
  readonly selectedEvent: WideTelemetryEvent | null;
  readonly onEventSearchChange: (term: string) => void;
  readonly onOutcomeFilterChange: (filter: OutcomeFilter) => void;
  readonly onSelectEvent: (event: WideTelemetryEvent) => void;
  readonly onCloseEvent: () => void;
  readonly onClearEvents: () => void;
}

export function TelemetryInspector({
  events,
  filteredEvents,
  eventSearchTerm,
  outcomeFilter,
  selectedEvent,
  onEventSearchChange,
  onOutcomeFilterChange,
  onSelectEvent,
  onCloseEvent,
  onClearEvents,
}: TelemetryInspectorProps) {
  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-1.5 text-sm font-semibold">
                <Code className="h-4 w-4 text-primary" />
                Wide Event Telemetry Inspector
              </CardTitle>
              <CardDescription className="text-xs">
                Audit the canonical user action telemetries following Wide Event principles.
              </CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={events.length === 0}
                    className="shrink-0"
                  />
                }
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear telemetry log?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently removes all {events.length} recorded wide events from local
                    storage. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={onClearEvents}>Clear log</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <TelemetryFilters
            searchTerm={eventSearchTerm}
            outcomeFilter={outcomeFilter}
            onSearchChange={onEventSearchChange}
            onOutcomeFilterChange={onOutcomeFilterChange}
          />

          <div className="flex items-center justify-between text-[12px] text-muted-foreground">
            <span>
              Showing {filteredEvents.length} of {events.length} events
            </span>
            <span>Click a row for full diagnostics & payload</span>
          </div>

          <TelemetryTable events={filteredEvents} onSelectEvent={onSelectEvent} />
        </CardContent>
      </Card>

      <TelemetryEventSheet event={selectedEvent} onClose={onCloseEvent} />
    </>
  );
}
