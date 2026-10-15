import { memo } from "react";
import { Card, CardContent } from "../../../components/ui/card.js";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table.js";
import type { AreaOverviewRow } from "../fleet-screen-state.js";

const NONE = <span className="text-muted-foreground">None</span>;
const list = (items: readonly string[]) => (items.length === 0 ? NONE : items.join(", "));

/** Per-area overview: what the player has there and what it borders. */
export const AreaOverviewTable = memo(function AreaOverviewTable({
  rows,
}: {
  readonly rows: readonly AreaOverviewRow[];
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No areas in this campaign.</p>;
  }
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Area</TableHead>
              <TableHead>Your ports</TableHead>
              <TableHead>Your fleets</TableHead>
              <TableHead>Borders</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.areaId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{list(row.ports)}</TableCell>
                <TableCell>{list(row.divisions)}</TableCell>
                <TableCell className="text-muted-foreground">{list(row.neighbours)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
});
