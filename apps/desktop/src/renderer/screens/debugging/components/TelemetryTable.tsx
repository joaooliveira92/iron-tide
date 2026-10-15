import { Code } from "lucide-react";
import { Badge } from "../../../components/ui/badge.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import { ScrollArea } from "../../../components/ui/scroll-area.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import type { WideTelemetryEvent } from "../../../lib/telemetry.js";
import { formatEventTime } from "../utils/format.js";

export interface TelemetryTableProps {
  readonly events: readonly WideTelemetryEvent[];
  readonly onSelectEvent: (event: WideTelemetryEvent) => void;
}

export function TelemetryTable({ events, onSelectEvent }: TelemetryTableProps) {
  return (
    <ScrollArea className="h-[300px] rounded-md border">
      {events.length === 0 ? (
        <Empty className="h-full border-none">
          <EmptyIcon>
            <Code />
          </EmptyIcon>
          <EmptyTitle>No telemetry recorded</EmptyTitle>
          <EmptyDescription>
            Perform some turns or build actions to populate wide events.
          </EmptyDescription>
        </Empty>
      ) : (
        <Table className="font-mono text-[12px]">
          <TableHeader>
            <TableRow className="h-8">
              <TableHead className="p-2">Timestamp</TableHead>
              <TableHead className="p-2">Action</TableHead>
              <TableHead className="p-2">Outcome</TableHead>
              <TableHead className="p-2 text-right">Duration (ms)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event, idx) => (
              <TableRow
                key={idx}
                className="h-8 cursor-pointer hover:bg-muted/40"
                onClick={() => onSelectEvent(event)}
              >
                <TableCell className="p-2 text-muted-foreground">
                  {formatEventTime(event.timestamp)}
                </TableCell>
                <TableCell className="p-2 font-medium">{event.action}</TableCell>
                <TableCell className="p-2">
                  <Badge
                    variant={event.outcome === "success" ? "default" : "destructive"}
                    className="px-1 text-[11px] uppercase"
                  >
                    {event.outcome}
                  </Badge>
                </TableCell>
                <TableCell className="p-2 text-right">{event.duration_ms}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </ScrollArea>
  );
}
