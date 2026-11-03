import { memo } from "react";
import { Badge } from "../../../components/ui/badge.js";
import { DEBUG_MODE } from "../../../shell/debug-flag.js";
import { Empty, EmptyDescription, EmptyIcon, EmptyTitle } from "../../../components/ui/empty.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import type { MovementCommandRow } from "../fleet-screen-state.js";

export function movementStatusVariant(
  status: MovementCommandRow["status"],
): "default" | "secondary" | "outline" {
  switch (status) {
    case "submitted":
      return "default";
    case "accepted":
      return "secondary";
    default:
      return "outline";
  }
}

export interface MovementCommandsTableProps {
  readonly rows: readonly MovementCommandRow[];
  readonly compact?: boolean;
}

export const MovementCommandsTable = memo(function MovementCommandsTable({
  rows,
  compact = false,
}: MovementCommandsTableProps) {
  return (
    <section>
      {!compact && (
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-medium">Movement commands</h3>
          <Badge variant="secondary" className="text-xs">
            {rows.length}
          </Badge>
        </div>
      )}
      {rows.length === 0 && compact ? (
        <p className="py-1 text-muted-foreground">No orders submitted this month.</p>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyIcon />
          <EmptyTitle>No movement commands</EmptyTitle>
          <EmptyDescription>No movement command has been submitted this month.</EmptyDescription>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {DEBUG_MODE && <TableHead>Command</TableHead>}
                <TableHead>Division</TableHead>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Status</TableHead>
                {DEBUG_MODE && <TableHead className="text-right">Revision</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.commandId}>
                  {DEBUG_MODE && (
                    <TableCell className="font-mono text-xs">{row.commandId}</TableCell>
                  )}
                  <TableCell className="font-medium">{row.divisionName}</TableCell>
                  <TableCell>{row.fromName}</TableCell>
                  <TableCell>{row.toName}</TableCell>
                  <TableCell>
                    <Badge variant={movementStatusVariant(row.status)}>{row.status}</Badge>
                  </TableCell>
                  {DEBUG_MODE && (
                    <TableCell className="text-right font-mono text-xs">
                      {row.submittedAtRevision}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
});
